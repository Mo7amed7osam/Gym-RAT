import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AccountSection } from '@/components/settings/AccountSection';
import { seedExercises, seedPlans } from '@/data/db/seed';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import { createAuthSession } from '@/services/auth/session';
import { createMemoryAuthStorage } from '@/services/auth/storage';
import { AuthApiError, type AuthApi, type SessionResponse } from '@/services/auth/types';
import { configureAuthSession, useAuthStore } from '@/store/useAuthStore';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, useWorkoutStore } from '@/store/useWorkoutStore';

/**
 * Sign-in, forgot-password and the Settings account section against a fake
 * server, in English and Arabic, with the VoiceOver labels the brief asks for.
 */

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }) }));
jest.mock('@/data/db/boot', () => ({
  probeLegacyData: jest.fn(async () => ({ source: null, sessions: 0, customExercises: 0, userPlans: 0, bodyEntries: 0, goals: 0, hasUserData: false })),
  removeAccountData: jest.fn(async () => {}),
  claimLegacyData: jest.fn(async () => ({ source: null, hasUserData: false })),
  EMPTY_PROBE: { source: null, sessions: 0, customExercises: 0, userPlans: 0, bodyEntries: 0, goals: 0, hasUserData: false },
}));

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'amr@example.com', displayName: 'Amr' };
const T0 = Date.parse('2026-11-02T10:00:00.000Z');
const DAY = 86_400_000;

function response(): SessionResponse {
  return {
    accessToken: 'a',
    accessExpiresIn: 900,
    refreshToken: 'r',
    user,
    lease: { userId: user.id, issuedAt: new Date(T0).toISOString(), expiresAt: new Date(T0 + 7 * DAY).toISOString() },
    serverTime: new Date(T0).toISOString(),
  };
}

function install(api: Partial<AuthApi>, options: { language?: 'en' | 'ar' } = {}) {
  const full: AuthApi = {
    login: async () => response(),
    refresh: async () => response(),
    me: async () => ({ user, lease: response().lease, serverTime: response().serverTime }),
    logout: async () => {},
    forgotPassword: async () => {},
    ...api,
  };
  const storage = createMemoryAuthStorage();
  const session = createAuthSession({ api: full, storage, now: () => T0 });
  configureAuthSession(session);
  useAuthStore.setState({ signingIn: false, signInError: null, signInRetryAfter: null });
  useWorkoutStore.setState({
    previewDayIndex: null,
    persistenceError: null,
    ...seedExercises(seedPlans({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: { ...DEFAULT_SETTINGS, language: options.language ?? 'en' } })),
  });
  return { session, storage };
}

beforeEach(() => jest.clearAllMocks());

describe('LoginScreen', () => {
  it('has no sign-up, validates before sending, and signs in', async () => {
    const login = jest.fn(async () => response());
    const { storage } = install({ login });
    await act(async () => {
      await useAuthStore.getState().restore();
    });
    await render(<LoginScreen />);

    expect(screen.queryByText(/sign up/i)).toBeNull();
    expect(screen.getByText('Accounts are created by the administrator. There is no sign-up.')).toBeTruthy();
    expect(screen.getByLabelText('Show password')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'x');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'Amr@Example.com');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(useAuthStore.getState().snapshot.status).toBe('signedIn'));
    expect(login).toHaveBeenCalledWith(expect.objectContaining({ email: 'amr@example.com', password: 'x' }));
    expect(storage.session?.user.id).toBe(user.id);
  });

  it('shows a generic error for a wrong password and the disabled / rate-limited / offline messages', async () => {
    let next: AuthApiError = new AuthApiError('invalid_credentials');
    install({
      login: async () => {
        throw next;
      },
    });
    await act(async () => {
      await useAuthStore.getState().restore();
    });
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'amr@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');

    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('That email and password do not match.')).toBeTruthy();
    expect(screen.queryByText(/no account/i)).toBeNull();

    next = new AuthApiError('account_disabled');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('This account is disabled. Contact your coach.')).toBeTruthy();

    next = new AuthApiError('rate_limited', undefined, 42);
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Too many attempts. Try again in 42 seconds.')).toBeTruthy();

    next = new AuthApiError('network');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('No connection. The first sign-in needs the internet.')).toBeTruthy();

    // Typing clears the banner.
    await fireEvent.changeText(screen.getByLabelText('Password'), 'again');
    expect(screen.queryByText('No connection. The first sign-in needs the internet.')).toBeNull();
  });

  it('explains an expired offline lease and prefills the email', async () => {
    const { storage } = install({
      me: async () => {
        throw new AuthApiError('network');
      },
      refresh: async () => {
        throw new AuthApiError('network');
      },
    });
    await storage.save({ version: 1, user, tokens: { accessToken: 'a', accessExpiresAt: 0, refreshToken: 'r' }, lease: { userId: user.id, issuedAt: new Date(T0 - 9 * DAY).toISOString(), expiresAt: new Date(T0 - 2 * DAY).toISOString() }, validatedAt: new Date(T0 - 9 * DAY).toISOString() });
    await act(async () => {
      await useAuthStore.getState().restore();
    });
    expect(useAuthStore.getState().snapshot.status).toBe('leaseExpired');
    await render(<LoginScreen />);
    expect(screen.getByText('Offline access ended')).toBeTruthy();
    expect(screen.getByText(/more than 7 days/)).toBeTruthy();
    expect(screen.getByLabelText('Email').props.value).toBe(user.email);
  });

  it('renders in Arabic with Arabic labels and a forgot-password link', async () => {
    install({}, { language: 'ar' });
    await act(async () => {
      await useAuthStore.getState().restore();
    });
    await render(<LoginScreen />);
    expect(screen.getByText('أهلًا بعودتك')).toBeTruthy();
    expect(screen.getByLabelText('البريد الإلكتروني')).toBeTruthy();
    expect(screen.getByLabelText('كلمة المرور')).toBeTruthy();
    expect(screen.getByLabelText('إظهار كلمة المرور')).toBeTruthy();
    await fireEvent.press(screen.getByText('نسيت كلمة المرور؟'));
    expect(mockPush).toHaveBeenCalledWith('/auth/forgot');
  });

  it('toggles password visibility', async () => {
    install({});
    await act(async () => {
      await useAuthStore.getState().restore();
    });
    await render(<LoginScreen />);
    const field = screen.getByLabelText('Password');
    expect(field.props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Hide password')).toBeTruthy();
  });
});

describe('ForgotPasswordScreen', () => {
  it('always ends in the same received state and never reveals whether the email exists', async () => {
    const forgotPassword = jest.fn(async () => {});
    install({ forgotPassword });
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'nobody@example.com');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByText('Request received')).toBeTruthy();
    expect(screen.getByText(/If an account exists for nobody@example.com/)).toBeTruthy();
    expect(forgotPassword).toHaveBeenCalledWith('nobody@example.com');
  });

  it('reports only a transport failure', async () => {
    install({
      forgotPassword: async () => {
        throw new AuthApiError('network');
      },
    });
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'amr@example.com');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByText('Could not reach the server. Check your connection and try again.')).toBeTruthy();
  });
});

describe('AccountSection', () => {
  it('shows who is signed in and the lease, signs out after confirmation and keeps local data', async () => {
    const logout = jest.fn(async () => {});
    const { storage, session } = install({ logout });
    await act(async () => {
      await session.signIn(user.email, 'pw');
    });
    useWorkoutStore.getState().updateSettings({ onboardingComplete: true });
    const started = useWorkoutStore.getState().startWorkout();
    expect(started.ok).toBe(true);
    useWorkoutStore.getState().finishWorkout('advance');

    await render(<AccountSection />);
    expect(screen.getByText('Amr')).toBeTruthy();
    expect(screen.getByText(user.email)).toBeTruthy();
    expect(screen.getByText(/Works offline until/)).toBeTruthy();
    expect(screen.getByText(/Signing in on another phone starts with an empty history/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Sign out'));
    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(screen.getByText(/Your 1 logged sessions stay on this phone/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Sign out'));
    await waitFor(() => expect(useAuthStore.getState().snapshot.status).toBe('signedOut'));
    expect(storage.session).toBeNull();
    expect(logout).toHaveBeenCalledWith('r');
    expect(useWorkoutStore.getState().history).toHaveLength(1); // the layout, not this component, closes the file
  });

  it('removing data asks for confirmation, deletes the account files and signs out', async () => {
    const { removeAccountData } = jest.requireMock('@/data/db/boot') as { removeAccountData: jest.Mock };
    const { session } = install({});
    await act(async () => {
      await session.signIn(user.email, 'pw');
    });
    await render(<AccountSection />);
    await fireEvent.press(screen.getByText('Remove my data from this phone'));
    expect(screen.getByText('Remove your data from this phone?')).toBeTruthy();
    expect(removeAccountData).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Remove and sign out'));
    await waitFor(() => expect(removeAccountData).toHaveBeenCalledWith(user.id));
    await waitFor(() => expect(useAuthStore.getState().snapshot.status).toBe('signedOut'));
  });
});

import { create } from 'zustand';

import { authApiBaseUrl, deviceLabel } from '@/config/auth';
import { createAuthApi } from '@/services/auth/api';
import { createAuthSession, type AuthSession, type AuthSnapshot, type SignOutReason } from '@/services/auth/session';
import { secureAuthStorage } from '@/services/auth/storage';
import { AuthApiError, type AuthErrorCode } from '@/services/auth/types';

/**
 * React-facing view of the auth session (ADR-015). The session manager owns
 * credentials; this store mirrors its snapshot and exposes the actions the
 * login screen and Settings need. `configureAuthSession` lets tests inject a
 * fake API and storage.
 */

interface AuthState {
  snapshot: AuthSnapshot;
  /** True while a sign-in request is in flight. */
  signingIn: boolean;
  /** The last sign-in failure, cleared on the next attempt or by `clearError`. */
  signInError: AuthErrorCode | null;
  signInRetryAfter: number | null;
  /** Server missing from the build configuration: the login screen explains instead of failing silently. */
  configured: boolean;
}

interface AuthActions {
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: (reason?: SignOutReason) => Promise<void>;
  revalidate: () => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;

let session: AuthSession | null = null;
let unsubscribe: (() => void) | null = null;

function buildDefaultSession(): AuthSession | null {
  const baseUrl = authApiBaseUrl();
  if (!baseUrl) return null;
  return createAuthSession({ api: createAuthApi({ baseUrl, userAgent: deviceLabel() }), storage: secureAuthStorage, deviceName: deviceLabel() });
}

/** Installs the session the store talks to. Tests pass a fake; the app uses the default once. */
export function configureAuthSession(next: AuthSession | null): void {
  unsubscribe?.();
  unsubscribe = null;
  session = next;
  if (!session) {
    useAuthStore.setState({ configured: false, snapshot: { status: 'signedOut', reason: null } });
    return;
  }
  unsubscribe = session.subscribe((snapshot) => useAuthStore.setState({ snapshot }));
  useAuthStore.setState({ configured: true, snapshot: session.getSnapshot() });
}

function ensureSession(): AuthSession | null {
  if (session) return session;
  const built = buildDefaultSession();
  configureAuthSession(built);
  return built;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  snapshot: { status: 'restoring' },
  signingIn: false,
  signInError: null,
  signInRetryAfter: null,
  configured: true,

  async restore() {
    const current = ensureSession();
    if (!current) return;
    await current.restore();
  },

  async signIn(email, password) {
    const current = ensureSession();
    if (!current) {
      set({ signInError: 'server' });
      return false;
    }
    set({ signingIn: true, signInError: null, signInRetryAfter: null });
    try {
      await current.signIn(email, password);
      set({ signingIn: false });
      return true;
    } catch (error) {
      const code = error instanceof AuthApiError ? error.code : 'server';
      const retry = error instanceof AuthApiError ? error.retryAfterSeconds : null;
      set({ signingIn: false, signInError: code, signInRetryAfter: retry });
      return false;
    }
  },

  async signOut(reason = 'user') {
    await session?.signOut(reason);
  },

  async revalidate() {
    await session?.revalidate();
  },

  async forgotPassword(email) {
    const current = ensureSession();
    if (!current) return false;
    try {
      await current.forgotPassword(email);
      return true;
    } catch (error) {
      // The server answers 202 whatever the address; only transport failures surface.
      return !(error instanceof AuthApiError && error.code === 'network');
    }
  },

  clearError: () => set({ signInError: null, signInRetryAfter: null }),
}));

/** The signed-in user id, or null while signed out / restoring / lease expired. */
export const selectAuthUserId = (state: AuthStore): string | null => (state.snapshot.status === 'signedIn' ? state.snapshot.user.id : null);

/** Convenience for non-React code (integrations, boot). */
export const currentAuthUserId = (): string | null => selectAuthUserId(useAuthStore.getState());

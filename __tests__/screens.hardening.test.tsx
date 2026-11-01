import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { EXERCISE_LIST, MUSCLE_LABELS } from '@/data/exercisesData';
import { resetAllData } from '@/data/db/boot';
import { seedPlans } from '@/data/db/seed';
import { PDF_PROGRAM_ID } from '@/data/seeds/pdfProgram';
import { STARTER_PLAN_ID } from '@/data/seeds/starterPlan';
import LibraryScreen from '@/screens/LibraryScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import PlanScreen from '@/screens/PlanScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';

/**
 * Flows the Phase 1 report listed as "not exercised" on a device: onboarding
 * past the first step, Library search, Plan "Make next" / "Use this plan" and
 * the Reset All Data confirmation. Rendered against the real store.
 */

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));
jest.mock('@/data/db/boot', () => ({
  resetAllData: jest.fn(async () => {
    const { DEFAULT_SETTINGS, IDLE_REST_TIMER, useWorkoutStore } = require('@/store/useWorkoutStore');
    const { seedPlans } = require('@/data/db/seed');
    useWorkoutStore
      .getState()
      .hydrate(seedPlans({ plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }));
  }),
  getBootStatus: () => 'ready',
}));

const freshInstall = () =>
  useWorkoutStore.setState({
    previewDayIndex: null,
    persistenceError: null,
    ...seedPlans({ plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  freshInstall();
});

describe('OnboardingScreen', () => {
  it('walks every step to the end and marks onboarding complete', async () => {
    await render(<OnboardingScreen />);
    expect(useWorkoutStore.getState().settings.onboardingComplete).toBe(false);

    await fireEvent.press(screen.getByText('Get started'));
    expect(screen.getByText('What are you training for?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Get stronger'));
    await fireEvent.press(screen.getByText('Next'));

    expect(screen.getByText('How long have you been lifting?')).toBeTruthy();
    await fireEvent.press(screen.getByText('1–3 years'));
    await fireEvent.press(screen.getByText('Next'));

    expect(screen.getByText('A bit about you')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Bodyweight (kg)'), '82.5');
    await fireEvent.changeText(screen.getByLabelText('Height (cm)'), '١٨٠');
    await fireEvent.press(screen.getByText('Next'));

    expect(screen.getByText('Rest between sets')).toBeTruthy();
    await fireEvent.press(screen.getByText('Next'));

    expect(screen.getByText('Choose a plan')).toBeTruthy();
    await fireEvent.press(screen.getByText('Next'));

    expect(screen.getByText('You are set')).toBeTruthy();
    await fireEvent.press(screen.getByText('Start training'));

    const { settings } = useWorkoutStore.getState();
    expect(settings.onboardingComplete).toBe(true);
    expect(settings.profile.goal).toBe('strength');
    expect(settings.profile.experience).toBe('intermediate');
    expect(settings.profile.bodyweightKg).toBe(82.5);
    expect(settings.profile.heightCm).toBe(180);
    expect(selectActivePlan(useWorkoutStore.getState())?.sourcePlanId).toBe(STARTER_PLAN_ID);
  });

  it('Skip finishes immediately with defaults', async () => {
    await render(<OnboardingScreen />);
    await fireEvent.press(screen.getByText('Skip'));
    expect(useWorkoutStore.getState().settings.onboardingComplete).toBe(true);
    expect(useWorkoutStore.getState().settings.profile).toEqual(DEFAULT_SETTINGS.profile);
  });

  it('Back returns to the previous step', async () => {
    await render(<OnboardingScreen />);
    await fireEvent.press(screen.getByText('Get started'));
    await fireEvent.press(screen.getByText('Next'));
    expect(screen.getByText('How long have you been lifting?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Back'));
    expect(screen.getByText('What are you training for?')).toBeTruthy();
  });
});

describe('LibraryScreen search', () => {
  const matches = (query: string) => {
    const q = query.toLowerCase();
    return EXERCISE_LIST.filter(
      (e) =>
        e.name.en.toLowerCase().includes(q) ||
        e.name.ar.includes(query) ||
        [...e.primaryMuscles, ...e.secondaryMuscles].some((m) => MUSCLE_LABELS[m].en.toLowerCase().includes(q)),
    ).length;
  };

  it('filters by English name, Arabic name and muscle, and shows the empty state', async () => {
    await render(<LibraryScreen />);
    expect(screen.getByText(`${EXERCISE_LIST.length} exercises`)).toBeTruthy();

    const input = screen.getByLabelText('Search exercises');
    await fireEvent.changeText(input, 'press');
    expect(matches('press')).toBeGreaterThan(0);
    expect(screen.getByText(`${matches('press')} exercises`)).toBeTruthy();

    await fireEvent.changeText(input, 'chest');
    expect(screen.getByText(`${matches('chest')} exercises`)).toBeTruthy();

    const arabic = EXERCISE_LIST[0].name.ar.slice(0, 4);
    await fireEvent.changeText(input, arabic);
    expect(screen.getByText(`${matches(arabic)} exercises`)).toBeTruthy();

    await fireEvent.changeText(input, 'zzzz-no-such-exercise');
    expect(screen.getByText('0 exercises')).toBeTruthy();
    expect(screen.getByText('No exercises match.')).toBeTruthy();

    await fireEvent.changeText(input, '  ');
    expect(screen.getByText(`${EXERCISE_LIST.length} exercises`)).toBeTruthy();
  });
});

describe('PlanScreen', () => {
  it('"Make next" moves the rotation pointer', async () => {
    await render(<PlanScreen />);
    const active = selectActivePlan(useWorkoutStore.getState())!;
    expect(active.nextDayIndex).toBe(0);
    expect(screen.getAllByText('Make next')).toHaveLength(active.days.length - 1);

    await fireEvent.press(screen.getAllByText('Make next')[1]); // day 3
    expect(selectActivePlan(useWorkoutStore.getState())!.nextDayIndex).toBe(2);
    expect(screen.getAllByText('Make next')).toHaveLength(active.days.length - 1);
  });

  it('"Use this plan" asks for confirmation, then adopts the template and restarts the rotation', async () => {
    useWorkoutStore.getState().setNextDay(1);
    await render(<PlanScreen />);
    // Starter is the active plan's source, so only the PDF reference offers the button.
    const buttons = screen.getAllByText('Use this plan');
    expect(buttons).toHaveLength(1);

    await fireEvent.press(buttons[0]);
    expect(screen.getByText(/Switch to /)).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(selectActivePlan(useWorkoutStore.getState())!.sourcePlanId).toBe(STARTER_PLAN_ID);

    await fireEvent.press(screen.getAllByText('Use this plan')[0]);
    await fireEvent.press(screen.getByText('Switch'));

    const state = useWorkoutStore.getState();
    const active = selectActivePlan(state)!;
    expect(active.sourcePlanId).toBe(PDF_PROGRAM_ID);
    expect(active.nextDayIndex).toBe(0);
    expect(state.plans.filter((plan) => plan.kind === 'active')).toHaveLength(1);
    expect(state.plans.map((plan) => plan.id)).toEqual(expect.arrayContaining([PDF_PROGRAM_ID, STARTER_PLAN_ID]));
    // The template list now offers the Starter instead.
    expect(screen.getAllByText('Use this plan')).toHaveLength(1);
  });
});

describe('SettingsScreen reset', () => {
  it('Reset All Data needs confirmation, wipes everything and returns to first launch', async () => {
    useWorkoutStore.getState().updateSettings({ onboardingComplete: true, restWarningSeconds: 30 });
    const start = useWorkoutStore.getState().startWorkout();
    expect(start.ok).toBe(true);
    useWorkoutStore.getState().finishWorkout('advance');
    expect(useWorkoutStore.getState().history).toHaveLength(1);

    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText('Reset All Data'));
    expect(screen.getByText(/1 logged sessions/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(resetAllData).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState().history).toHaveLength(1);

    await fireEvent.press(screen.getByText('Reset All Data'));
    await act(async () => {
      await fireEvent.press(screen.getByText('Erase everything'));
    });

    expect(resetAllData).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    const state = useWorkoutStore.getState();
    expect(state.history).toEqual([]);
    expect(state.activeSession).toBeNull();
    expect(state.settings.onboardingComplete).toBe(false);
    expect(state.settings.restWarningSeconds).toBe(DEFAULT_SETTINGS.restWarningSeconds);
    expect(selectActivePlan(state)?.sourcePlanId).toBe(STARTER_PLAN_ID);
    expect(selectActivePlan(state)?.nextDayIndex).toBe(0);
  });
});

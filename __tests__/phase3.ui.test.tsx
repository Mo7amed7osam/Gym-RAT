import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CoachCard } from '@/components/CoachCard';
import { ExerciseDetail } from '@/components/ExerciseDetail';
import { RecommendationChip } from '@/components/RecommendationChip';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, selectExercise, useWorkoutStore } from '@/store/useWorkoutStore';

/** Phase 3 W4 / W6 — recommendation chip, coach card and records section render against the real store. */

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const empty = () => ({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
const session = () => useWorkoutStore.getState().activeSession!;

function logTwoSessions(weightKg: number, reps: number) {
  const store = useWorkoutStore.getState();
  for (let i = 0; i < 2; i += 1) {
    jest.setSystemTime(new Date(Date.parse('2026-10-20T10:00:00.000Z') + i * 4 * 86_400_000));
    const started = store.startWorkout({ dayIndex: 0 });
    if (!started.ok) throw new Error(started.reason);
    const ex = session().exercises[0];
    for (const set of ex.sets) store.completeSet(ex.id, set.id, { weightKg, reps });
    store.finishWorkout('repeat');
  }
  jest.setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
}

beforeEach(() => {
  attachPersistence(null);
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
  useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...seedExercises(seedPlans(empty())) });
});
afterEach(() => jest.useRealTimers());

describe('RecommendationChip', () => {
  it('explains the suggestion, applies it to unlogged sets, and can be ignored', async () => {
    logTwoSessions(100, 12);
    useWorkoutStore.getState().startWorkout({ dayIndex: 0 });
    const ex = session().exercises[0];
    const onEdit = jest.fn();
    const view = await render(<RecommendationChip sessionExercise={ex} onEdit={onEdit} />);
    expect(screen.getByText('102.5 kg × 8–12')).toBeTruthy();
    expect(screen.getByText(/Try 102.5 kg/)).toBeTruthy();
    expect(screen.getByText('Based on 2 sessions')).toBeTruthy();

    await fireEvent.press(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Use'));
    const after = session().exercises[0];
    expect(after.sets.every((set) => set.weightKg === 102.5 && set.reps === 8)).toBe(true);
    expect(after.recommendation?.decision).toBe('accepted');
    await view.rerender(<RecommendationChip sessionExercise={after} onEdit={onEdit} />);
    expect(screen.getByText('Applied to the sets you have not logged yet')).toBeTruthy();

    useWorkoutStore.getState().dismissRecommendation(ex.id);
    await view.rerender(<RecommendationChip sessionExercise={session().exercises[0]} onEdit={onEdit} />);
    expect(screen.queryByText('Suggested')).toBeNull();
  });

  it('renders nothing without history or when disabled, and Arabic strings resolve', async () => {
    useWorkoutStore.getState().startWorkout({ dayIndex: 0 });
    await render(<RecommendationChip sessionExercise={session().exercises[0]} onEdit={() => {}} />);
    expect(screen.queryByText('Suggested')).toBeNull();
    useWorkoutStore.getState().cancelWorkout();
    logTwoSessions(100, 12);
    useWorkoutStore.getState().updateSettings({ language: 'ar' });
    useWorkoutStore.getState().startWorkout({ dayIndex: 0 });
    await render(<RecommendationChip sessionExercise={session().exercises[0]} onEdit={() => {}} />);
    expect(screen.getByText('مقترح')).toBeTruthy();
    expect(screen.getByText('102.5 كجم × 8–12')).toBeTruthy();
    useWorkoutStore.getState().updateSettings({ language: 'en', recommendationsEnabled: false });
    await render(<RecommendationChip sessionExercise={session().exercises[0]} onEdit={() => {}} />);
    expect(screen.queryByText('Suggested')).toBeNull();
  });
});

describe('CoachCard', () => {
  it('shows the insufficient-data insight, dismisses it, and hides when the coach is off', async () => {
    const now = Date.parse('2026-11-02T10:00:00.000Z');
    await render(<CoachCard now={now} />);
    expect(screen.getByText('Not enough data yet')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByLabelText(/^Dismiss: /));
    });
    expect(useWorkoutStore.getState().settings.dismissedInsights.insufficient_data).toBe('2026-11-02T10:00:00.000Z');
    expect(screen.queryByText('Not enough data yet')).toBeNull();
    useWorkoutStore.getState().updateSettings({ dismissedInsights: {}, coachEnabled: false });
    await render(<CoachCard now={now} />);
    expect(screen.queryByText('Coach')).toBeNull();
  });
});

describe('ExerciseDetail records', () => {
  it('lists records with a PR history and respects hidden kinds', async () => {
    logTwoSessions(100, 12);
    // Third session beats the top weight.
    const store = useWorkoutStore.getState();
    store.startWorkout({ dayIndex: 0 });
    const ex = session().exercises[0];
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 110, reps: 10 });
    store.finishWorkout('repeat');
    const exercise = selectExercise('leg_press')(useWorkoutStore.getState())!;
    await render(<ExerciseDetail exercise={exercise} onOpenExercise={() => {}} />);
    expect(screen.getByText('Records')).toBeTruthy();
    expect(screen.getByText(/^110 kg · /)).toBeTruthy();
    expect(screen.getByText('PR history')).toBeTruthy();
    expect(screen.getByText(/Heaviest set: 110 kg \(was 100 kg\)/)).toBeTruthy();
    useWorkoutStore.getState().updateSettings({ hiddenRecordKinds: ['top_weight'] });
    await render(<ExerciseDetail exercise={exercise} onOpenExercise={() => {}} />);
    expect(screen.queryByText(/Heaviest set: 110 kg/)).toBeNull();
  });
});

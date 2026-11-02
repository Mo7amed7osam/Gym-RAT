import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { EffortPicker } from '@/components/EffortPicker';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { evaluateSession } from '@/domain/progression';
import { setCurrentLocale } from '@/i18n';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';

const empty = () => ({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });

function loggedSet() {
  const store = useWorkoutStore.getState();
  const started = store.startWorkout();
  if (!started.ok) throw new Error(started.reason);
  const session = useWorkoutStore.getState().activeSession!;
  const ex = session.exercises[session.currentExerciseIndex];
  store.completeSet(ex.id, ex.sets[0].id, { weightKg: 60, reps: 10 });
  const current = () => useWorkoutStore.getState().activeSession!.exercises.find((item) => item.id === ex.id)!.sets[0];
  return { ex, current };
}

describe('effort entry on the rest sheet (RPE / RIR)', () => {
  beforeEach(() => {
    setCurrentLocale('en');
    attachPersistence(null);
    useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...seedExercises(seedPlans(empty())) });
  });

  it('defaults to RPE and records and replaces a rating on the logged set', async () => {
    expect(DEFAULT_SETTINGS.effortScale).toBe('rpe');
    const { ex, current } = loggedSet();
    await render(<EffortPicker scale="rpe" sessionExerciseId={ex.id} set={current()} />);
    expect(screen.getByText(/How hard was set 1\?/)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'RPE 9.5' })));
    expect(current()).toMatchObject({ rpe: 9.5, rir: null });
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'RPE 8' })));
    expect(current().rpe).toBe(8);
  });

  it('records and clears reps in reserve, and a 0-RIR set marks the weight as at the limit', async () => {
    const { ex, current } = loggedSet();
    const view = await render(<EffortPicker scale="rir" sessionExerciseId={ex.id} set={current()} />);
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: '0 reps in reserve' })));
    expect(current().rir).toBe(0);
    await view.rerender(<EffortPicker scale="rir" sessionExerciseId={ex.id} set={current()} />);
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: '0 reps in reserve' })));
    expect(current().rir).toBeNull();
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: '4+ reps in reserve' })));
    expect(current().rir).toBe(4);

    const session = useWorkoutStore.getState().activeSession!;
    const exercise = session.exercises.find((item) => item.id === ex.id)!;
    exercise.sets[0] = { ...exercise.sets[0], rir: 0 };
    const performance = evaluateSession({ ...session, status: 'completed' }, exercise.exerciseId, exercise.prescription.reps);
    expect(performance?.atLimit).toBe(true);
  });
});

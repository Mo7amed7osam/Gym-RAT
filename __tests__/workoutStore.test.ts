import { DEFAULT_SETTINGS, IDLE_REST_TIMER, getRestRemainingMs, useWorkoutStore } from '@/store/useWorkoutStore';
import type { RestTimerState } from '@/types/workout';

const resetStore = () =>
  useWorkoutStore.setState({
    selectedWeekday: null,
    activeSession: null,
    history: [],
    restTimer: IDLE_REST_TIMER,
    settings: DEFAULT_SETTINGS,
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-31T18:00:00.000Z'));
  resetStore();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getRestRemainingMs', () => {
  it('derives remaining time from endsAt and freezes while paused', () => {
    const running: RestTimerState = { ...IDLE_REST_TIMER, status: 'running', durationMs: 90_000, endsAt: Date.now() + 30_000 };
    expect(getRestRemainingMs(running)).toBe(30_000);
    expect(getRestRemainingMs(running, Date.now() + 45_000)).toBe(-15_000);
    const paused: RestTimerState = { ...running, status: 'paused', endsAt: null, pausedRemainingMs: 12_345 };
    expect(getRestRemainingMs(paused)).toBe(12_345);
    expect(getRestRemainingMs(IDLE_REST_TIMER)).toBe(0);
  });
});

describe('session lifecycle', () => {
  it('refuses to start on a non-training day and when a session exists', () => {
    expect(useWorkoutStore.getState().startWorkout('friday')).toEqual({ ok: false, reason: 'not_training_day' });
    expect(useWorkoutStore.getState().startWorkout('saturday').ok).toBe(true);
    expect(useWorkoutStore.getState().startWorkout('sunday')).toEqual({ ok: false, reason: 'session_in_progress' });
  });

  it('builds sets from the prescription and prefills from history on the next session', () => {
    const store = useWorkoutStore.getState();
    const first = store.startWorkout('saturday');
    if (!first.ok) throw new Error('expected session');
    const bench = first.session.exercises[0];
    expect(bench.sets).toHaveLength(bench.prescription.sets);
    expect(bench.sets[0].weightKg).toBeNull();

    store.completeSet(bench.id, bench.sets[0].id, { weightKg: 60, reps: 12 });
    const finished = useWorkoutStore.getState().finishWorkout();
    expect(finished?.status).toBe('completed');
    expect(finished?.summary?.totalVolumeKg).toBe(720);
    expect(useWorkoutStore.getState().history).toHaveLength(1);
    expect(useWorkoutStore.getState().activeSession).toBeNull();

    const second = useWorkoutStore.getState().startWorkout('saturday');
    if (!second.ok) throw new Error('expected session');
    expect(second.session.exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 12, completed: false });
  });

  it('cancelling discards the session and the rest timer', () => {
    const store = useWorkoutStore.getState();
    const result = store.startWorkout('saturday');
    if (!result.ok) throw new Error('expected session');
    const ex = result.session.exercises[0];
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 60, reps: 12 });
    expect(useWorkoutStore.getState().restTimer.status).toBe('running');
    store.cancelWorkout();
    expect(useWorkoutStore.getState().activeSession).toBeNull();
    expect(useWorkoutStore.getState().restTimer).toEqual(IDLE_REST_TIMER);
  });
});

describe('set logging', () => {
  it('fills missing inputs, carries values to the next set and starts rest with the prescribed default', () => {
    const store = useWorkoutStore.getState();
    const result = store.startWorkout('saturday');
    if (!result.ok) throw new Error('expected session');
    const ex = result.session.exercises[0];

    store.completeSet(ex.id, ex.sets[0].id, {});
    const after = useWorkoutStore.getState().activeSession!.exercises[0];
    expect(after.sets[0]).toMatchObject({ completed: true, weightKg: 0, reps: ex.prescription.reps.max });
    expect(after.sets[1]).toMatchObject({ completed: false, weightKg: 0, reps: ex.prescription.reps.max });

    const timer = useWorkoutStore.getState().restTimer;
    expect(timer.status).toBe('running');
    expect(timer.durationMs).toBe(ex.prescription.rest.defaultSeconds * 1000);
    expect(timer.context).toMatchObject({ sessionExerciseId: ex.id, completedSetId: ex.sets[0].id, nextSetId: ex.sets[1].id });
  });

  it('does not start rest after the very last set of the workout', () => {
    const store = useWorkoutStore.getState();
    const result = store.startWorkout('saturday');
    if (!result.ok) throw new Error('expected session');
    for (const ex of result.session.exercises) {
      for (const s of ex.sets) store.completeSet(ex.id, s.id, { weightKg: 10, reps: 10 });
    }
    expect(useWorkoutStore.getState().restTimer).toEqual(IDLE_REST_TIMER);
  });

  it('uncompleting the set that started rest clears the timer; add/remove/toggle work', () => {
    const store = useWorkoutStore.getState();
    const result = store.startWorkout('saturday');
    if (!result.ok) throw new Error('expected session');
    const ex = result.session.exercises[0];
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 60, reps: 12 });
    store.uncompleteSet(ex.id, ex.sets[0].id);
    expect(useWorkoutStore.getState().restTimer).toEqual(IDLE_REST_TIMER);

    store.addSet(ex.id);
    let sets = useWorkoutStore.getState().activeSession!.exercises[0].sets;
    expect(sets).toHaveLength(ex.sets.length + 1);
    expect(sets[sets.length - 1].setNumber).toBe(sets.length);

    store.toggleSetType(ex.id, sets[0].id);
    expect(useWorkoutStore.getState().activeSession!.exercises[0].sets[0].type).toBe('warmup');

    store.removeSet(ex.id, sets[0].id);
    sets = useWorkoutStore.getState().activeSession!.exercises[0].sets;
    expect(sets.map((s) => s.setNumber)).toEqual(sets.map((_, i) => i + 1));
  });

  it('rejects negative or non-finite numbers', () => {
    const store = useWorkoutStore.getState();
    const result = store.startWorkout('saturday');
    if (!result.ok) throw new Error('expected session');
    const ex = result.session.exercises[0];
    store.updateSet(ex.id, ex.sets[0].id, { weightKg: -5, reps: Number.NaN });
    expect(useWorkoutStore.getState().activeSession!.exercises[0].sets[0]).toMatchObject({ weightKg: null, reps: null });
  });
});

describe('rest timer actions', () => {
  it('runs on wall-clock time, pauses, resumes and adjusts without going below zero', () => {
    const store = useWorkoutStore.getState();
    store.startRestTimer(90);
    expect(getRestRemainingMs(useWorkoutStore.getState().restTimer)).toBe(90_000);

    jest.advanceTimersByTime(30_000);
    expect(getRestRemainingMs(useWorkoutStore.getState().restTimer)).toBe(60_000);

    store.pauseRestTimer();
    jest.advanceTimersByTime(10_000);
    expect(getRestRemainingMs(useWorkoutStore.getState().restTimer)).toBe(60_000);

    store.resumeRestTimer();
    store.adjustRestTimer(30);
    expect(getRestRemainingMs(useWorkoutStore.getState().restTimer)).toBe(90_000);
    expect(useWorkoutStore.getState().restTimer.durationMs).toBe(120_000);

    store.adjustRestTimer(-500);
    expect(getRestRemainingMs(useWorkoutStore.getState().restTimer)).toBe(0);

    store.skipRestTimer();
    expect(useWorkoutStore.getState().restTimer).toEqual(IDLE_REST_TIMER);
  });

  it('enforces a minimum duration and marks elapsed once', () => {
    const store = useWorkoutStore.getState();
    store.startRestTimer(1);
    expect(useWorkoutStore.getState().restTimer.durationMs).toBe(5_000);
    store.markRestTimerElapsed(123);
    store.markRestTimerElapsed(456);
    expect(useWorkoutStore.getState().restTimer.elapsedAt).toBe(123);
  });
});

describe('history & settings', () => {
  it('deletes sessions and merges settings', () => {
    const store = useWorkoutStore.getState();
    const result = store.startWorkout('saturday');
    if (!result.ok) throw new Error('expected session');
    const finished = store.finishWorkout()!;
    store.deleteSession(finished.id);
    expect(useWorkoutStore.getState().history).toHaveLength(0);
    store.updateSettings({ restWarningSeconds: 10 });
    expect(useWorkoutStore.getState().settings).toMatchObject({ ...DEFAULT_SETTINGS, restWarningSeconds: 10 });
  });
});

describe('navigation, checklists, selectors, migration', () => {
  it('clamps exercise navigation and toggles checklist ids', () => {
    const store = useWorkoutStore.getState();
    const result = store.startWorkout('saturday');
    if (!result.ok) throw new Error('expected session');
    const last = result.session.exercises.length - 1;

    store.goToPreviousExercise();
    expect(useWorkoutStore.getState().activeSession!.currentExerciseIndex).toBe(0);
    store.goToExercise(99);
    expect(useWorkoutStore.getState().activeSession!.currentExerciseIndex).toBe(last);
    store.goToNextExercise();
    expect(useWorkoutStore.getState().activeSession!.currentExerciseIndex).toBe(last);
    store.goToExercise(1);
    store.goToPreviousExercise();
    expect(useWorkoutStore.getState().activeSession!.currentExerciseIndex).toBe(0);

    const ex = result.session.exercises[0];
    store.setExerciseSkipped(ex.id, true);
    store.setExerciseNotes(ex.id, 'felt heavy');
    expect(useWorkoutStore.getState().activeSession!.exercises[0]).toMatchObject({ skipped: true, notes: 'felt heavy' });

    store.toggleWarmupItem('a');
    store.toggleWarmupItem('b');
    store.toggleWarmupItem('a');
    expect(useWorkoutStore.getState().activeSession!.warmupCompletedIds).toEqual(['b']);
    store.toggleCooldownItem('x');
    expect(useWorkoutStore.getState().activeSession!.cooldownCompletedIds).toEqual(['x']);
  });

  it('navigation and checklist actions are no-ops without a session', () => {
    const store = useWorkoutStore.getState();
    store.goToExercise(3);
    store.toggleWarmupItem('a');
    store.toggleCooldownItem('b');
    store.setExerciseSkipped('nope', true);
    expect(useWorkoutStore.getState().activeSession).toBeNull();
    expect(store.finishWorkout()).toBeNull();
  });

  it('selectors follow the selected weekday and expose the current exercise', () => {
    const { selectActiveWeekday, selectActiveDaySchedule, selectCurrentSessionExercise, selectIsWorkoutActive, selectPreviousExercise, getRoutineHistory } =
      jest.requireActual<typeof import('@/store/useWorkoutStore')>('@/store/useWorkoutStore');
    const store = useWorkoutStore.getState();
    expect(selectIsWorkoutActive(useWorkoutStore.getState())).toBe(false);
    expect(selectCurrentSessionExercise(useWorkoutStore.getState())).toBeNull();

    store.selectWeekday('monday');
    expect(selectActiveWeekday(useWorkoutStore.getState())).toBe('monday');
    expect(selectActiveDaySchedule(useWorkoutStore.getState()).weekday).toBe('monday');
    store.selectWeekday(null);
    // 2026-10-31 is a Saturday.
    expect(selectActiveWeekday(useWorkoutStore.getState(), new Date('2026-10-31T12:00:00.000Z'))).toBe('saturday');

    const result = store.startWorkout('saturday');
    if (!result.ok) throw new Error('expected session');
    expect(selectIsWorkoutActive(useWorkoutStore.getState())).toBe(true);
    expect(selectCurrentSessionExercise(useWorkoutStore.getState())?.id).toBe(result.session.exercises[0].id);
    const ex = result.session.exercises[0];
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 50, reps: 10 });
    store.finishWorkout();
    expect(selectPreviousExercise(ex.exerciseId)(useWorkoutStore.getState())?.exerciseId).toBe(ex.exerciseId);
    expect(selectPreviousExercise('nope')(useWorkoutStore.getState())).toBeNull();
    expect(getRoutineHistory(useWorkoutStore.getState(), 'push_a')).toHaveLength(1);
    expect(getRoutineHistory(useWorkoutStore.getState(), 'pull_a')).toHaveLength(0);
  });

  it('clearHistory empties history', () => {
    const store = useWorkoutStore.getState();
    const a = store.startWorkout('saturday');
    if (!a.ok) throw new Error('expected session');
    store.finishWorkout();
    const b = store.startWorkout('sunday');
    if (!b.ok) throw new Error('expected session');
    store.finishWorkout();
    expect(useWorkoutStore.getState().history).toHaveLength(2);
    store.clearHistory();
    expect(useWorkoutStore.getState().history).toHaveLength(0);
  });

  it('persist migration v2→v3 drops the old sync queue; merge ignores unknown keys and deep-merges settings', () => {
    const options = useWorkoutStore.persist.getOptions();
    expect(options.version).toBe(3);
    const migrated = options.migrate!(
      { history: [{ id: 's1' }], syncQueue: [{ kind: 'upsert', sessionId: 's1', enqueuedAt: 1 }] } as never,
      2,
    ) as Record<string, unknown>;
    expect(migrated).not.toHaveProperty('syncQueue');
    expect(migrated.history).toEqual([{ id: 's1' }]);
    const untouched = options.migrate!({ history: [] } as never, 3) as Record<string, unknown>;
    expect(untouched).toEqual({ history: [] });

    const merged = options.merge!(
      { settings: { hapticsEnabled: false }, syncQueue: [{}] } as never,
      useWorkoutStore.getState(),
    ) as unknown as Record<string, unknown>;
    expect(merged.settings).toEqual({ ...DEFAULT_SETTINGS, hapticsEnabled: false });
    expect(merged).not.toHaveProperty('syncQueue');
  });
});

import { PERSISTED_STATE_VERSION, migratePersistedState } from '@/store/migratePersistedState';
import { seedPlans } from '@/data/db/seed';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, getRestRemainingMs, selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';
import type { RestTimerState } from '@/types/workout';

/** Fresh install state: bundled plans seeded, Starter active. */
const resetStore = () =>
  useWorkoutStore.setState({
    previewDayIndex: null,
    persistenceError: null,
    ...seedPlans({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }),
  });

const start = (dayIndex?: number) => {
  const result = useWorkoutStore.getState().startWorkout(dayIndex === undefined ? {} : { dayIndex });
  if (!result.ok) throw new Error(`expected session, got ${result.reason}`);
  return result.session;
};

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
  it('refuses to start without an active plan, with an unknown plan, or when a session exists', () => {
    useWorkoutStore.setState({ plans: [] });
    expect(useWorkoutStore.getState().startWorkout()).toEqual({ ok: false, reason: 'no_active_plan' });
    resetStore();
    expect(useWorkoutStore.getState().startWorkout({ planId: 'nope' })).toEqual({ ok: false, reason: 'unknown_plan' });
    expect(useWorkoutStore.getState().startWorkout().ok).toBe(true);
    expect(useWorkoutStore.getState().startWorkout()).toEqual({ ok: false, reason: 'session_in_progress' });
  });

  it('starts the rotation\'s next day by default and advances or repeats on finish', () => {
    const plan = selectActivePlan(useWorkoutStore.getState())!;
    expect(plan.nextDayIndex).toBe(0);
    const first = start();
    expect(first.planDayId).toBe(plan.days[0].id);
    expect(first.kind).toBe('plan');
    useWorkoutStore.getState().finishWorkout('advance');
    expect(selectActivePlan(useWorkoutStore.getState())!.nextDayIndex).toBe(1);

    const second = useWorkoutStore.getState().startWorkout();
    if (!second.ok) throw new Error('expected session');
    expect(second.session.planDayId).toBe(plan.days[1].id);
    useWorkoutStore.getState().finishWorkout('repeat');
    expect(selectActivePlan(useWorkoutStore.getState())!.nextDayIndex).toBe(1);

    // Rotation wraps and never depends on the calendar.
    useWorkoutStore.getState().setNextDay(plan.days.length - 1);
    start();
    useWorkoutStore.getState().finishWorkout();
    expect(selectActivePlan(useWorkoutStore.getState())!.nextDayIndex).toBe(0);
  });

  it('template sessions never move the rotation; adopting a plan replaces the active one', () => {
    const before = selectActivePlan(useWorkoutStore.getState())!;
    const result = useWorkoutStore.getState().startWorkout({ planId: 'pdf_ppl_ul_v5', dayIndex: 2 });
    if (!result.ok) throw new Error('expected session');
    expect(result.session.kind).toBe('template');
    expect(result.session.code).toBe('Leg A');
    useWorkoutStore.getState().finishWorkout('advance');
    expect(selectActivePlan(useWorkoutStore.getState())!.nextDayIndex).toBe(before.nextDayIndex);

    const adopted = useWorkoutStore.getState().adoptPlan('pdf_ppl_ul_v5')!;
    const plans = useWorkoutStore.getState().plans;
    expect(plans.filter((plan) => plan.kind === 'active')).toEqual([adopted]);
    expect(adopted.sourcePlanId).toBe('pdf_ppl_ul_v5');
    expect(adopted.locked).toBe(false);
    expect(adopted.days.map((day) => day.code)).toEqual(['Push A', 'Pull A', 'Leg A', 'Upper B', 'Lower B']);
    expect(plans.find((plan) => plan.id === 'pdf_ppl_ul_v5')?.kind).toBe('template');
  });

  it('pause excludes time from active seconds and finish closes an open pause', () => {
    const session = start();
    jest.advanceTimersByTime(60_000);
    useWorkoutStore.getState().pauseWorkout();
    jest.advanceTimersByTime(30_000);
    useWorkoutStore.getState().pauseWorkout(); // idempotent
    expect(useWorkoutStore.getState().activeSession!.pausedIntervals).toHaveLength(1);
    useWorkoutStore.getState().resumeWorkout();
    jest.advanceTimersByTime(10_000);
    useWorkoutStore.getState().pauseWorkout();
    jest.advanceTimersByTime(5_000);
    const finished = useWorkoutStore.getState().finishWorkout()!;
    expect(finished.id).toBe(session.id);
    expect(finished.pausedIntervals.every((interval) => interval.to !== null)).toBe(true);
    expect(finished.summary?.durationSeconds).toBe(105);
    expect(finished.summary?.activeSeconds).toBe(70);
  });

  it('do later moves the exercise to the end and keeps the pointer in place', () => {
    const session = start();
    const [first, second] = session.exercises;
    useWorkoutStore.getState().deferExercise(first.id);
    const after = useWorkoutStore.getState().activeSession!;
    expect(after.exercises[0].id).toBe(second.id);
    expect(after.exercises[after.exercises.length - 1].id).toBe(first.id);
    expect(after.deferredIds).toEqual([first.id]);
    expect(after.currentExerciseIndex).toBe(0);
    useWorkoutStore.getState().reorderExercise(first.id, 0);
    expect(useWorkoutStore.getState().activeSession!.exercises[0].id).toBe(first.id);
    expect(useWorkoutStore.getState().activeSession!.deferredIds).toEqual([]);
  });

  it('builds sets from the prescription and prefills from history on the next session', () => {
    const store = useWorkoutStore.getState();
    const first = { ok: true as const, session: start(0) };
    const bench = first.session.exercises[0];
    expect(bench.sets).toHaveLength(bench.prescription.sets);
    expect(bench.sets[0].weightKg).toBeNull();

    store.completeSet(bench.id, bench.sets[0].id, { weightKg: 60, reps: 12 });
    const finished = useWorkoutStore.getState().finishWorkout();
    expect(finished?.status).toBe('completed');
    expect(finished?.summary?.totalVolumeKg).toBe(720);
    expect(useWorkoutStore.getState().history).toHaveLength(1);
    expect(useWorkoutStore.getState().activeSession).toBeNull();

    const second = { session: start(0) };
    expect(second.session.exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 12, completed: false });
  });

  it('cancelling discards the session and the rest timer', () => {
    const store = useWorkoutStore.getState();
    const result = { ok: true as const, session: start(0) };
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
    const result = { ok: true as const, session: start(0) };
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
    const result = { ok: true as const, session: start(0) };
    for (const ex of result.session.exercises) {
      for (const s of ex.sets) store.completeSet(ex.id, s.id, { weightKg: 10, reps: 10 });
    }
    expect(useWorkoutStore.getState().restTimer).toEqual(IDLE_REST_TIMER);
  });

  it('uncompleting the set that started rest clears the timer; add/remove/toggle work', () => {
    const store = useWorkoutStore.getState();
    const result = { ok: true as const, session: start(0) };
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
    const result = { ok: true as const, session: start(0) };
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
    const result = { ok: true as const, session: start(0) };
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
    const result = { ok: true as const, session: start(0) };
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
  });

  it('navigation and checklist actions are no-ops without a session', () => {
    const store = useWorkoutStore.getState();
    store.goToExercise(3);
    store.toggleWarmupItem('a');
    store.setExerciseSkipped('nope', true);
    expect(useWorkoutStore.getState().activeSession).toBeNull();
    expect(store.finishWorkout()).toBeNull();
  });

  it('selectors expose the previewed day, the current exercise and previous performance', () => {
    const { selectPreviewedDay, selectNextDay, selectCurrentSessionExercise, selectIsWorkoutActive, selectPreviousExercise, getDayHistory } =
      jest.requireActual<typeof import('@/store/useWorkoutStore')>('@/store/useWorkoutStore');
    const store = useWorkoutStore.getState();
    const plan = selectActivePlan(useWorkoutStore.getState())!;
    expect(selectIsWorkoutActive(useWorkoutStore.getState())).toBe(false);
    expect(selectCurrentSessionExercise(useWorkoutStore.getState())).toBeNull();
    expect(selectPreviewedDay(useWorkoutStore.getState())?.id).toBe(plan.days[0].id);

    store.previewDay(2);
    expect(selectPreviewedDay(useWorkoutStore.getState())?.id).toBe(plan.days[2].id);
    expect(selectNextDay(useWorkoutStore.getState())?.id).toBe(plan.days[0].id);
    store.previewDay(null);

    const session = start();
    expect(selectIsWorkoutActive(useWorkoutStore.getState())).toBe(true);
    expect(selectCurrentSessionExercise(useWorkoutStore.getState())?.id).toBe(session.exercises[0].id);
    const ex = session.exercises[0];
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 50, reps: 10 });
    store.finishWorkout();
    expect(selectPreviousExercise(ex.exerciseId)(useWorkoutStore.getState())?.exerciseId).toBe(ex.exerciseId);
    expect(selectPreviousExercise('nope')(useWorkoutStore.getState())).toBeNull();
    expect(getDayHistory(useWorkoutStore.getState(), plan.days[0].id)).toHaveLength(1);
    expect(getDayHistory(useWorkoutStore.getState(), plan.days[1].id)).toHaveLength(0);
  });

  it('clearHistory empties history', () => {
    const store = useWorkoutStore.getState();
    const a = { ok: true as const, session: start(0) };
    store.finishWorkout();
    const b = { ok: true as const, session: start(1) };
    store.finishWorkout();
    expect(useWorkoutStore.getState().history).toHaveLength(2);
    store.clearHistory();
    expect(useWorkoutStore.getState().history).toHaveLength(0);
  });

  it('migratePersistedState strips cool-down ids and the weight increment (v3→v4)', () => {
    const migrated = migratePersistedState(
      {
        activeSession: { id: 'a', warmupCompletedIds: ['x'], cooldownCompletedIds: ['y'] },
        history: [{ id: 'h', cooldownCompletedIds: [] }],
        settings: { ...DEFAULT_SETTINGS, weightIncrementKg: 2.5 },
      },
      3,
    ) as { activeSession: Record<string, unknown>; history: Record<string, unknown>[]; settings: Record<string, unknown> };
    expect(migrated.activeSession).toMatchObject({ id: 'a', warmupCompletedIds: ['x'] });
    expect(migrated.activeSession).not.toHaveProperty('cooldownCompletedIds');
    expect(migrated.history[0]).toMatchObject({ id: 'h' });
    expect(migrated.history[0]).not.toHaveProperty('cooldownCompletedIds');
    expect(migrated.settings).toEqual({ ...DEFAULT_SETTINGS });
  });

  it('migratePersistedState drops the sync queue (v2→v3), maps weekdays onto plan days (v4→v5) and is a no-op at the current version', () => {
    expect(PERSISTED_STATE_VERSION).toBe(5);
    const migrated = migratePersistedState(
      { history: [{ id: 's1', routineId: 'pull_a', weekday: 'sunday', summary: { durationSeconds: 10 } }], syncQueue: [{ kind: 'upsert' }] },
      2,
    ) as { history: Record<string, unknown>[] };
    expect(migrated).not.toHaveProperty('syncQueue');
    expect(migrated.history[0]).toMatchObject({
      id: 's1',
      schemaVersion: 2,
      kind: 'plan',
      planId: 'pdf_ppl_ul_v5',
      planDayId: 'pdf_ppl_ul_v5:pull_a',
      pausedIntervals: [],
      deferredIds: [],
      notes: '',
      summary: { durationSeconds: 10, activeSeconds: 10 },
    });
    expect(migrated.history[0]).not.toHaveProperty('weekday');
    expect(migratePersistedState({ history: [] }, 5)).toEqual({ history: [] });
  });
});

describe('write-through persistence', () => {
  afterEach(() => attachPersistence(null));

  it('calls the adapter with the previous and next persisted slices before applying state', () => {
    const calls: { prevHistory: number; nextHistory: number }[] = [];
    attachPersistence({
      persist: (prev, next) => {
        calls.push({ prevHistory: prev.history.length, nextHistory: next.history.length });
        // State must not have changed yet.
        expect(useWorkoutStore.getState().history.length).toBe(prev.history.length);
      },
    });
    const store = useWorkoutStore.getState();
    store.previewDay(1); // not persisted → no call
    expect(calls).toHaveLength(0);
    const result = { ok: true as const, session: start(0) };
    store.finishWorkout();
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[calls.length - 1]).toEqual({ prevHistory: 0, nextHistory: 1 });
  });

  it('discards the state change and records the error when the write throws', () => {
    attachPersistence({
      persist: () => {
        throw new Error('disk full');
      },
    });
    const store = useWorkoutStore.getState();
    const result = store.startWorkout();
    expect(result.ok).toBe(true);
    expect(useWorkoutStore.getState().activeSession).toBeNull();
    expect(useWorkoutStore.getState().persistenceError).toBe('disk full');
    store.reportPersistenceError(null);
    expect(useWorkoutStore.getState().persistenceError).toBeNull();
  });

  it('hydrate replaces persisted slices without writing', () => {
    let writes = 0;
    attachPersistence({ persist: () => void writes++ });
    useWorkoutStore.getState().hydrate({
      exercises: [],
      plans: [],
      activeSession: null,
      history: [],
      restTimer: { ...IDLE_REST_TIMER, durationMs: 1 },
      settings: { ...DEFAULT_SETTINGS, hapticsEnabled: false },
    });
    expect(writes).toBe(0);
    expect(useWorkoutStore.getState().settings.hapticsEnabled).toBe(false);
    expect(useWorkoutStore.getState().restTimer.durationMs).toBe(1);
  });
});

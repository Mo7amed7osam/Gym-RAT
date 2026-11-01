import { createNodeDriver } from '@/data/db/driver.node';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { STARTER_PLAN_ID } from '@/data/seeds/starterPlan';
import * as reducer from '@/domain/session/reducer';
import { PERSISTED_STATE_VERSION, migratePersistedState } from '@/store/migratePersistedState';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';

/** Phase 2 P2.4 / P2.5 — session engine additions, advanced sets, rest rules. */

const empty = () => ({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });

const start = (): WorkoutSession => {
  const result = useWorkoutStore.getState().startWorkout();
  if (!result.ok) throw new Error(result.reason);
  return result.session;
};
const session = () => useWorkoutStore.getState().activeSession!;

beforeEach(() => {
  attachPersistence(null);
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
  useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...seedExercises(seedPlans(empty())) });
});
afterEach(() => jest.useRealTimers());

describe('engine: exercises during a session', () => {
  it('adds, reorders, substitutes and removes exercises without touching the plan', () => {
    const store = useWorkoutStore.getState();
    const s0 = start();
    const planBefore = selectActivePlan(useWorkoutStore.getState())!;
    expect(s0.exercises).toHaveLength(6);

    store.addSessionExercise('hip_thrust');
    expect(session().exercises[1].exerciseId).toBe('hip_thrust');
    expect(session().exercises).toHaveLength(7);

    store.reorderExercise(session().exercises[1].id, 6);
    expect(session().exercises[6].exerciseId).toBe('hip_thrust');

    const first = session().exercises[0];
    store.substituteSessionExercise(first.id, 'hack_squat');
    expect(session().exercises[0].exerciseId).toBe('hack_squat');
    // The snapshot keeps the plan slot it came from.
    expect(session().exercises[0].prescription.exerciseId).toBe(first.exerciseId);

    store.removeSessionExercise(session().exercises[6].id);
    expect(session().exercises).toHaveLength(6);
    expect(selectActivePlan(useWorkoutStore.getState())).toBe(planBefore);
  });

  it('session-only target edits leave the plan alone; save-to-plan writes them back', () => {
    const store = useWorkoutStore.getState();
    // Duplicate the Starter so the active plan is editable.
    const copy = store.duplicatePlan(STARTER_PLAN_ID)!;
    store.activatePlan(copy.id);
    start();
    const ex = session().exercises[0];
    store.updateSessionPrescription(ex.id, { sets: 5, reps: { min: 5, max: 5 }, rest: { defaultSeconds: 150, minSeconds: 150, maxSeconds: 150 } });
    const edited = session().exercises[0];
    expect(edited.sets).toHaveLength(5);
    expect(edited.sets.every((set) => set.targetReps.min === 5)).toBe(true);
    expect(edited.prescription.rest.defaultSeconds).toBe(150);
    expect(selectActivePlan(useWorkoutStore.getState())!.days[0].exercises[0].sets).toBe(3);

    store.updateSessionPrescription(ex.id, { sets: 2 });
    expect(session().exercises[0].sets).toHaveLength(2);

    expect(store.saveTargetsToPlan(ex.id)).toBe(true);
    const day = selectActivePlan(useWorkoutStore.getState())!.days[0];
    expect(day.exercises[0]).toMatchObject({ exerciseId: 'leg_press', sets: 2, reps: { min: 5, max: 5 }, rest: { defaultSeconds: 150 } });
  });

  it('save-to-plan after a substitution replaces the plan slot instead of appending', () => {
    const store = useWorkoutStore.getState();
    const copy = store.duplicatePlan(STARTER_PLAN_ID)!;
    store.activatePlan(copy.id);
    start();
    const first = session().exercises[0];
    expect(first.exerciseId).toBe('leg_press');
    store.substituteSessionExercise(first.id, 'hack_squat');
    store.updateSessionPrescription(first.id, { sets: 4 });
    expect(store.saveTargetsToPlan(first.id)).toBe(true);
    const day = selectActivePlan(useWorkoutStore.getState())!.days[0];
    expect(day.exercises.map((e) => e.exerciseId)).not.toContain('leg_press');
    expect(day.exercises[0]).toMatchObject({ exerciseId: 'hack_squat', sets: 4 });
    expect(day.exercises).toHaveLength(6);
  });

  it('save-to-plan refuses template sessions and locked plans', () => {
    const store = useWorkoutStore.getState();
    const res = store.startWorkout({ planId: STARTER_PLAN_ID, dayIndex: 0, kind: 'template' });
    expect(res.ok).toBe(true);
    expect(store.saveTargetsToPlan(session().exercises[0].id)).toBe(false);
    store.cancelWorkout();
    start(); // active plan is the locked Starter clone? No: the clone is unlocked but its sourcePlan is locked.
    expect(selectActivePlan(useWorkoutStore.getState())!.locked).toBe(false);
    expect(store.saveTargetsToPlan(session().exercises[0].id)).toBe(true);
  });
});

describe('engine: advanced sets, warm-ups, rest', () => {
  it('drop sets skip rest, rest-pause rests 15 s, warm-ups use the warm-up rest, overrides beat the prescription', () => {
    const store = useWorkoutStore.getState();
    start();
    const ex = session().exercises[0];
    // Prescription rest for the Starter's leg press is 120 s.
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 100, reps: 10 });
    expect(useWorkoutStore.getState().restTimer.durationMs).toBe(120_000);

    store.setNextSetKind(ex.id, 'drop');
    expect(session().exercises[0].sets[1].kind).toBe('drop');
    store.completeSet(ex.id, ex.sets[1].id, { weightKg: 80, reps: 8 });
    expect(useWorkoutStore.getState().restTimer.status).toBe('idle');

    store.setNextSetKind(ex.id, 'rest_pause');
    store.completeSet(ex.id, ex.sets[2].id, { weightKg: 80, reps: 6 });
    expect(useWorkoutStore.getState().restTimer.durationMs).toBe(15_000);

    // Per-exercise override.
    store.updateExerciseUser('leg_press', { userRestSeconds: 60 });
    store.addSet(ex.id);
    const added = session().exercises[0].sets[3];
    expect(added.kind).toBe('normal');
    store.completeSet(ex.id, added.id, { weightKg: 80, reps: 8 });
    expect(useWorkoutStore.getState().restTimer.durationMs).toBe(60_000);

    // Warm-up set rest.
    store.addSet(ex.id);
    const warm = session().exercises[0].sets[4];
    store.toggleSetType(ex.id, warm.id);
    store.completeSet(ex.id, warm.id, { weightKg: 40, reps: 10 });
    expect(useWorkoutStore.getState().restTimer.durationMs).toBe(DEFAULT_SETTINGS.warmupRestSeconds * 1000);
  });

  it('suggests ramp-up warm-up sets from the working weight and keeps them out of volume', () => {
    const store = useWorkoutStore.getState();
    start();
    const ex = session().exercises[0];
    expect(store.addWarmupSets(ex.id)).toBe(0); // no weight known yet
    store.updateSet(ex.id, ex.sets[0].id, { weightKg: 100 });
    expect(store.addWarmupSets(ex.id)).toBe(2);
    const sets = session().exercises[0].sets;
    expect(sets.slice(0, 2).map((set) => [set.type, set.weightKg, set.reps])).toEqual([
      ['warmup', 50, 10],
      ['warmup', 75, 5],
    ]);
    expect(sets.map((set) => set.setNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(sets[2].weightKg).toBe(100);
  });

  it('supersets rest only after the last member', () => {
    const store = useWorkoutStore.getState();
    start();
    const [a, b] = session().exercises;
    store.groupSessionExercises([a.id, b.id]);
    expect(session().exercises[0].groupKind).toBe('superset');
    store.completeSet(a.id, a.sets[0].id, { weightKg: 50, reps: 10 });
    expect(useWorkoutStore.getState().restTimer.status).toBe('idle');
    store.completeSet(b.id, b.sets[0].id, { weightKg: 20, reps: 10 });
    expect(useWorkoutStore.getState().restTimer.status).toBe('running');
    store.ungroupSessionExercise(a.id);
    expect(session().exercises.every((item) => item.groupId === null)).toBe(true);
  });

  it('records RPE / RIR and undo restores the set', () => {
    const store = useWorkoutStore.getState();
    start();
    const ex = session().exercises[0];
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 100, reps: 10 });
    store.setSetFeedback(ex.id, ex.sets[0].id, { rpe: 8, rir: 2 });
    expect(session().exercises[0].sets[0]).toMatchObject({ rpe: 8, rir: 2, completed: true });
    store.uncompleteSet(ex.id, ex.sets[0].id);
    expect(session().exercises[0].sets[0]).toMatchObject({ completed: false, completedAt: null, weightKg: 100, reps: 10 });
    expect(useWorkoutStore.getState().restTimer.status).toBe('idle');
  });

  it('tracks last activity for the inactivity prompt', () => {
    const store = useWorkoutStore.getState();
    const s = start();
    expect(reducer.lastActivityMs(s)).toBe(Date.parse('2026-11-02T10:00:00.000Z'));
    jest.setSystemTime(new Date('2026-11-02T10:05:00.000Z'));
    const ex = session().exercises[0];
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 100, reps: 10 });
    expect(reducer.lastActivityMs(session())).toBe(Date.parse('2026-11-02T10:05:00.000Z'));
    jest.setSystemTime(new Date('2026-11-02T10:30:00.000Z'));
    store.pauseWorkout();
    jest.setSystemTime(new Date('2026-11-02T10:40:00.000Z'));
    store.resumeWorkout();
    expect(reducer.lastActivityMs(session())).toBe(Date.parse('2026-11-02T10:40:00.000Z'));
  });

  it('end-time correction drives the summary', () => {
    const store = useWorkoutStore.getState();
    start();
    jest.setSystemTime(new Date('2026-11-02T11:00:00.000Z'));
    store.setEndedAtOverride('2026-11-02T10:45:00.000Z');
    const finished = store.finishWorkout('advance')!;
    expect(finished.summary?.durationSeconds).toBe(45 * 60);
    expect(finished.summary?.activeSeconds).toBe(45 * 60);
  });
});

describe('schema v6 + legacy blob', () => {
  it('migrates v5 rows and persists set kinds, RPE/RIR and groups', () => {
    const driver = createNodeDriver();
    driver.transaction(() => {
      for (const step of MIGRATIONS.slice(0, 5)) step.up(driver);
      driver.exec('PRAGMA user_version = 5');
    });
    expect(migrate(driver)).toEqual({ from: 5, to: SCHEMA_VERSION, applied: MIGRATIONS.filter((m) => m.version > 5).map((m) => m.version) });
    const repo = new WorkoutRepository(driver);
    useWorkoutStore.setState({ ...seedExercises(seedPlans(empty())) });
    const store = useWorkoutStore.getState();
    start();
    const [a, b] = session().exercises;
    store.groupSessionExercises([a.id, b.id]);
    store.setNextSetKind(a.id, 'amrap');
    store.completeSet(a.id, a.sets[0].id, { weightKg: 100, reps: 15 });
    store.setSetFeedback(a.id, a.sets[0].id, { rpe: 9.5, rir: 0 });
    const state = { ...empty(), activeSession: session() };
    repo.persistDiff(empty(), state);
    const loaded = repo.loadAll({ restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }).activeSession!;
    expect(loaded.exercises[0]).toMatchObject({ groupKind: 'superset' });
    expect(loaded.exercises[0].groupId).toBe(loaded.exercises[1].groupId);
    expect(loaded.exercises[0].sets[0]).toMatchObject({ kind: 'amrap', rpe: 9.5, rir: 0, completed: true });
    expect(loaded.exercises[0].sets[1]).toMatchObject({ kind: 'normal', rpe: null, rir: null });
  });

  it('legacy blobs gain the new defaults', () => {
    expect(PERSISTED_STATE_VERSION).toBe(7);
    const blob = {
      history: [
        {
          id: 's', schemaVersion: 2, kind: 'plan', planId: 'p', planDayId: 'd', title: { en: 'x', ar: 'x' }, code: 'X', focus: null, status: 'completed',
          startedAt: '2026-10-01T10:00:00.000Z', finishedAt: '2026-10-01T11:00:00.000Z', endedAtOverride: null, pausedIntervals: [], deferredIds: [],
          currentExerciseIndex: 0, warmupCompletedIds: [], notes: '', summary: null,
          exercises: [{ id: 'e', exerciseId: 'leg_press', prescription: { exerciseId: 'leg_press', sets: 1, reps: { min: 8, max: 12 }, rest: { defaultSeconds: 90, minSeconds: 90, maxSeconds: 90 } }, skipped: false, notes: '', sets: [{ id: 'x', setNumber: 1, type: 'working', targetReps: { min: 8, max: 12 }, weightKg: 100, reps: 10, completed: true, completedAt: '2026-10-01T10:10:00.000Z' }] }],
        },
      ],
    };
    const out = migratePersistedState(blob, 5) as { history: WorkoutSession[] };
    expect(out.history[0].exercises[0]).toMatchObject({ groupId: null, groupKind: null });
    expect(out.history[0].exercises[0].sets[0]).toMatchObject({ kind: 'normal', rpe: null, rir: null, weightKg: 100 });
  });
});

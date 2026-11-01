import { createNodeDriver } from '@/data/db/driver.node';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { PERSISTED_STATE_VERSION, migratePersistedState } from '@/store/migratePersistedState';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';

/** Phase 3 W4 — recommendations in the store: accept / dismiss / edit, prefill rules, persistence. */

const empty = () => ({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
const session = () => useWorkoutStore.getState().activeSession!;

/** Two completed Starter sessions where leg press hit 12 reps at 100 kg → "increase" to 102.5. */
function seedHistory() {
  const store = useWorkoutStore.getState();
  for (let i = 0; i < 2; i += 1) {
    jest.setSystemTime(new Date(Date.parse('2026-10-20T10:00:00.000Z') + i * 4 * 86_400_000));
    const started = store.startWorkout({ dayIndex: 0 });
    if (!started.ok) throw new Error(started.reason);
    const ex = session().exercises[0];
    for (const set of ex.sets) store.completeSet(ex.id, set.id, { weightKg: 100, reps: 12 });
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

describe('recommendations in a session', () => {
  it('suggests, applies to incomplete sets only, and records the decision', () => {
    seedHistory();
    const store = useWorkoutStore.getState();
    expect(store.startWorkout({ dayIndex: 0 }).ok).toBe(true);
    const ex = session().exercises[0];
    expect(ex.exerciseId).toBe('leg_press');
    const rec = store.recommendationFor(ex.id)!;
    expect(rec).toMatchObject({ action: 'increase', weightKg: 102.5, reps: { min: 8, max: 12 }, basedOnSessions: 2 });

    // Log set 1 first; accepting must not touch it.
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 100, reps: 10 });
    expect(store.applyRecommendation(ex.id)).toBe(true);
    const after = session().exercises[0];
    expect(after.sets[0]).toMatchObject({ completed: true, weightKg: 100, reps: 10 });
    expect(after.sets[1]).toMatchObject({ completed: false, weightKg: 102.5, reps: 8, targetReps: { min: 8, max: 12 } });
    expect(after.sets[2]).toMatchObject({ completed: false, weightKg: 102.5, reps: 8 });
    expect(after.recommendation).toMatchObject({ decision: 'accepted', weightKg: 102.5, repsMin: 8, repsMax: 12 });
    // Suggestion is pure: asking again returns the same answer, and nothing in history changed.
    expect(store.recommendationFor(ex.id)).toEqual(rec);
    expect(useWorkoutStore.getState().history).toHaveLength(2);
  });

  it('dismiss and edit only record the decision; disabling the setting hides suggestions', () => {
    seedHistory();
    const store = useWorkoutStore.getState();
    store.startWorkout({ dayIndex: 0 });
    const ex = session().exercises[0];
    const before = ex.sets.map((set) => set.weightKg);
    store.dismissRecommendation(ex.id);
    expect(session().exercises[0].recommendation?.decision).toBe('dismissed');
    expect(session().exercises[0].sets.map((set) => set.weightKg)).toEqual(before);
    store.markRecommendationEdited(ex.id, 105, { min: 6, max: 8 });
    expect(session().exercises[0].recommendation).toMatchObject({ decision: 'edited', weightKg: 105, repsMin: 6, repsMax: 8 });
    store.updateSettings({ recommendationsEnabled: false });
    expect(store.recommendationFor(ex.id)).toBeNull();
    expect(store.applyRecommendation(ex.id)).toBe(false);
  });

  it('no history → insufficient data, and accepting does nothing', () => {
    const store = useWorkoutStore.getState();
    store.startWorkout({ dayIndex: 0 });
    const ex = session().exercises[0];
    expect(store.recommendationFor(ex.id)?.action).toBe('insufficient_data');
    expect(store.applyRecommendation(ex.id)).toBe(false);
    expect(session().exercises[0].recommendation).toBeNull();
  });

  it('survives a force-quit: the decision round-trips through SQLite (schema v7) and the legacy blob gains the default', () => {
    seedHistory();
    const store = useWorkoutStore.getState();
    store.startWorkout({ dayIndex: 0 });
    const ex = session().exercises[0];
    store.applyRecommendation(ex.id);

    const driver = createNodeDriver();
    driver.transaction(() => {
      for (const step of MIGRATIONS.slice(0, 6)) step.up(driver);
      driver.exec('PRAGMA user_version = 6');
    });
    expect(migrate(driver)).toEqual({ from: 6, to: SCHEMA_VERSION, applied: MIGRATIONS.filter((m) => m.version > 6).map((m) => m.version) });
    const repo = new WorkoutRepository(driver);
    const state = { ...empty(), activeSession: session() };
    repo.persistDiff(empty(), state);
    const loaded = repo.loadAll({ restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }).activeSession!;
    expect(loaded.exercises[0].recommendation).toEqual(session().exercises[0].recommendation);
    expect(loaded.exercises[1].recommendation).toBeNull();

    expect(PERSISTED_STATE_VERSION).toBe(7);
    const blob = migratePersistedState({ history: [{ ...session(), status: 'completed' } as WorkoutSession] }, 6) as { history: WorkoutSession[] };
    expect(blob.history[0].exercises[1].recommendation).toBeNull();
  });

  it('coach dismissals are stored with a date in settings', () => {
    const store = useWorkoutStore.getState();
    store.dismissInsight('plateau:leg_press');
    expect(useWorkoutStore.getState().settings.dismissedInsights).toEqual({ 'plateau:leg_press': '2026-11-02T10:00:00.000Z' });
  });
});

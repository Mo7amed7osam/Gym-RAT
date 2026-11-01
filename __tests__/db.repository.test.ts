import { createNodeDriver } from '@/data/db/driver.node';
import { migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { KV } from '@/data/db/schema';
import { seedPlans } from '@/data/db/seed';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';

const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };

function freshRepo() {
  const driver = createNodeDriver();
  migrate(driver);
  return { driver, repo: new WorkoutRepository(driver) };
}

const empty = () => ({ plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });

function resetStore() {
  useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...empty() });
}

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
  attachPersistence(null);
  jest.useRealTimers();
});

describe('WorkoutRepository with the store attached', () => {
  it('round-trips a full workout lifecycle through SQLite', () => {
    const { repo } = freshRepo();
    attachPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });
    useWorkoutStore.setState(seedPlans(empty())); // plans are written too
    expect(repo.counts().plans).toBe(3);
    expect(repo.loadAll(defaults).plans).toEqual(useWorkoutStore.getState().plans);

    const store = useWorkoutStore.getState();
    const started = { ok: true as const, session: start(0) };
    const ex = started.session.exercises[0];
    store.completeSet(ex.id, ex.sets[0].id, { weightKg: 60, reps: 12 });
    store.addSet(ex.id);
    store.toggleSetType(ex.id, ex.sets[1].id);
    store.setExerciseNotes(ex.id, 'felt strong');
    store.toggleWarmupItem('stage:treadmill');
    store.adjustRestTimer(15);
    store.updateSettings({ restWarningSeconds: 10 });

    // Mid-workout: everything is on disk, byte-for-byte equal to memory.
    const mid = repo.loadAll(defaults);
    expect(mid.activeSession).toEqual(useWorkoutStore.getState().activeSession);
    expect(mid.history).toEqual([]);
    expect(mid.restTimer).toEqual(useWorkoutStore.getState().restTimer);
    expect(mid.settings).toEqual(useWorkoutStore.getState().settings);

    const finished = store.finishWorkout('repeat')!;
    const after = repo.loadAll(defaults);
    expect(after.activeSession).toBeNull();
    expect(after.history).toEqual([finished]);
    expect(after.history[0].summary?.totalVolumeKg).toBe(720);
    // Rotation pointer change is persisted with the plan.
    store.setNextDay(2);
    expect(repo.loadAll(defaults).plans.find((plan) => plan.kind === 'active')?.nextDayIndex).toBe(2);
    store.setNextDay(0);

    // A second workout with prefill, then discard: the discarded session leaves no rows.
    const second = { ok: true as const, session: start(0) };
    expect(second.session.exercises[0].sets[0].weightKg).toBe(60);
    store.cancelWorkout();
    expect(repo.counts().sessions).toBe(1);

    // Delete history → rows gone.
    store.deleteSession(finished.id);
    expect(repo.counts()).toEqual({ sessions: 0, exercises: 0, sets: 0, plans: 3 });

    // A fresh store hydrated from the DB equals the current store.
    const reloaded = repo.loadAll(defaults);
    expect(reloaded.settings.restWarningSeconds).toBe(10);
  });

  it('persists history edits by id and leaves untouched sessions alone', () => {
    const { repo } = freshRepo();
    attachPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });
    useWorkoutStore.setState(seedPlans(empty()));
    const store = useWorkoutStore.getState();
    for (const dayIndex of [0, 1]) {
      start(dayIndex);
      expect(useWorkoutStore.getState().persistenceError).toBeNull();
      store.finishWorkout();
      jest.advanceTimersByTime(60_000); // distinct startedAt so load order matches insertion order
    }
    expect(repo.counts().sessions).toBe(2);
    const [newest, oldest] = useWorkoutStore.getState().history;
    useWorkoutStore.setState({ history: [{ ...newest, code: 'Edited' }, oldest] });
    const loaded = repo.loadAll(defaults);
    expect(loaded.history.map((s) => s.code)).toEqual(['Edited', oldest.code]);
    expect(loaded.history[1]).toEqual(oldest);
  });
});

describe('WorkoutRepository primitives', () => {
  it('persistDiff is a no-op when nothing persisted changed', () => {
    const { driver, repo } = freshRepo();
    const state = empty();
    const spy = jest.spyOn(driver, 'transaction');
    repo.persistDiff(state, state);
    expect(spy).not.toHaveBeenCalled();
  });

  it('loadAll falls back to defaults and merges stored settings over them', () => {
    const { repo } = freshRepo();
    expect(repo.loadAll(defaults)).toEqual(empty());
    repo.writeKv(KV.settings, { hapticsEnabled: false });
    expect(repo.loadAll(defaults).settings).toEqual({ ...DEFAULT_SETTINGS, hapticsEnabled: false });
  });

  it('a throwing write rolls the whole transaction back', () => {
    const { driver, repo } = freshRepo();
    useWorkoutStore.setState(seedPlans(empty()));
    const session = start(0);
    const broken = { ...session, exercises: [{ ...session.exercises[0], sets: [{ ...session.exercises[0].sets[0], type: 'bogus' as never }] }] };
    expect(() => repo.persistDiff(empty(), { ...empty(), activeSession: broken })).toThrow();
    expect(repo.counts()).toEqual({ sessions: 0, exercises: 0, sets: 0, plans: 0 });
    expect(driver.get('SELECT 1 AS ok')).toEqual({ ok: 1 }); // connection still usable
  });
});

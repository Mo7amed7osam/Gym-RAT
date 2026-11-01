import { createNodeDriver } from '@/data/db/driver.node';
import { migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { KV } from '@/data/db/schema';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';

const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };

function freshRepo() {
  const driver = createNodeDriver();
  migrate(driver);
  return { driver, repo: new WorkoutRepository(driver) };
}

function resetStore() {
  useWorkoutStore.setState({
    selectedWeekday: null,
    persistenceError: null,
    activeSession: null,
    history: [],
    restTimer: IDLE_REST_TIMER,
    settings: DEFAULT_SETTINGS,
  });
}

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

    const store = useWorkoutStore.getState();
    const started = store.startWorkout('saturday');
    if (!started.ok) throw new Error('expected session');
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

    const finished = store.finishWorkout()!;
    const after = repo.loadAll(defaults);
    expect(after.activeSession).toBeNull();
    expect(after.history).toEqual([finished]);
    expect(after.history[0].summary?.totalVolumeKg).toBe(720);

    // A second workout with prefill, then discard: the discarded session leaves no rows.
    const second = store.startWorkout('saturday');
    if (!second.ok) throw new Error('expected session');
    expect(second.session.exercises[0].sets[0].weightKg).toBe(60);
    store.cancelWorkout();
    expect(repo.counts().sessions).toBe(1);

    // Delete history → rows gone.
    store.deleteSession(finished.id);
    expect(repo.counts()).toEqual({ sessions: 0, exercises: 0, sets: 0 });

    // A fresh store hydrated from the DB equals the current store.
    const reloaded = repo.loadAll(defaults);
    expect(reloaded.settings.restWarningSeconds).toBe(10);
  });

  it('persists history edits by id and leaves untouched sessions alone', () => {
    const { repo } = freshRepo();
    attachPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });
    const store = useWorkoutStore.getState();
    for (const day of ['saturday', 'sunday'] as const) {
      const r = store.startWorkout(day);
      if (!r.ok) throw new Error('expected session');
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
    const state = { activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };
    const spy = jest.spyOn(driver, 'transaction');
    repo.persistDiff(state, state);
    expect(spy).not.toHaveBeenCalled();
  });

  it('loadAll falls back to defaults and merges stored settings over them', () => {
    const { repo } = freshRepo();
    expect(repo.loadAll(defaults)).toEqual({ activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
    repo.writeKv(KV.settings, { hapticsEnabled: false });
    expect(repo.loadAll(defaults).settings).toEqual({ ...DEFAULT_SETTINGS, hapticsEnabled: false });
  });

  it('a throwing write rolls the whole transaction back', () => {
    const { driver, repo } = freshRepo();
    const store = useWorkoutStore.getState();
    const r = store.startWorkout('saturday');
    if (!r.ok) throw new Error('expected session');
    const session = r.session;
    const broken = { ...session, exercises: [{ ...session.exercises[0], sets: [{ ...session.exercises[0].sets[0], type: 'bogus' as never }] }] };
    expect(() =>
      repo.persistDiff({ activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }, {
        activeSession: broken,
        history: [],
        restTimer: IDLE_REST_TIMER,
        settings: DEFAULT_SETTINGS,
      }),
    ).toThrow();
    expect(repo.counts()).toEqual({ sessions: 0, exercises: 0, sets: 0 });
    expect(driver.get('SELECT 1 AS ok')).toEqual({ ok: 1 }); // connection still usable
  });
});

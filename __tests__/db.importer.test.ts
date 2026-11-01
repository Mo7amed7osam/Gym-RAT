import { createNodeDriver } from '@/data/db/driver.node';
import { LEGACY_STORAGE_KEY, importFromAsyncStorage, type KeyValueStorage } from '@/data/db/importer';
import { migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { KV } from '@/data/db/schema';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER } from '@/store/useWorkoutStore';

const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };
const now = new Date('2026-10-31T18:00:00.000Z');

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => void map.set(key, value),
    removeItem: async (key) => void map.delete(key),
  };
}

function fresh() {
  const driver = createNodeDriver();
  migrate(driver);
  return new WorkoutRepository(driver);
}

const set = (n: number, owner = 'x') => ({
  id: `${owner}-set-${n}`,
  setNumber: n,
  type: 'working',
  targetReps: { min: 10, max: 12 },
  weightKg: 60,
  reps: 12,
  completed: true,
  completedAt: '2026-10-24T18:10:00.000Z',
});
const session = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  schemaVersion: 1,
  routineId: 'push_a',
  weekday: 'saturday',
  title: { en: 'Push', ar: 'دفع' },
  code: 'Push A',
  focus: 'strength',
  status,
  startedAt: '2026-10-24T18:00:00.000Z',
  finishedAt: status === 'completed' ? '2026-10-24T19:00:00.000Z' : null,
  exercises: [
    {
      id: `${id}-ex1`,
      exerciseId: 'flat_barbell_bench_press',
      prescription: { exerciseId: 'flat_barbell_bench_press', sets: 2, reps: { min: 10, max: 12 }, rest: { defaultSeconds: 120, minSeconds: 120, maxSeconds: 120 } },
      sets: [set(1, id), set(2, id)],
      skipped: false,
      notes: '',
    },
  ],
  currentExerciseIndex: 0,
  warmupCompletedIds: ['stage:treadmill'],
  summary: status === 'completed' ? { totalVolumeKg: 1440, completedSets: 2, totalSets: 2, durationSeconds: 3600, personalRecords: [] } : null,
  ...extra,
});

describe('importFromAsyncStorage', () => {
  it('imports a v2 blob (with sync queue and cool-down fields), verifies counts and renames the key', async () => {
    const repo = fresh();
    const blob = JSON.stringify({
      state: {
        activeSession: session('active', 'in_progress', { cooldownCompletedIds: ['x'] }),
        history: [session('h1', 'completed', { cooldownCompletedIds: [] })],
        syncQueue: [{ kind: 'upsert', sessionId: 'h1', enqueuedAt: 1 }],
        restTimer: { ...IDLE_REST_TIMER, durationMs: 90_000 },
        settings: { ...DEFAULT_SETTINGS, hapticsEnabled: false, weightIncrementKg: 2.5 },
      },
      version: 2,
    });
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: blob });

    const result = await importFromAsyncStorage(repo, storage, defaults, now);
    expect(result).toEqual({ status: 'imported', sessions: 2, renamedTo: `${LEGACY_STORAGE_KEY}.imported-2026-10-31` });
    expect(repo.counts()).toEqual({ sessions: 2, exercises: 2, sets: 4, plans: 0 });

    const loaded = repo.loadAll(defaults);
    expect(loaded.activeSession?.id).toBe('active');
    expect(loaded.activeSession).toMatchObject({ kind: 'plan', planId: 'pdf_ppl_ul_v5', planDayId: 'pdf_ppl_ul_v5:push_a', schemaVersion: 2 });
    expect(loaded.history[0].summary).toMatchObject({ durationSeconds: 3600, activeSeconds: 3600 });
    expect(loaded.activeSession).not.toHaveProperty('cooldownCompletedIds');
    expect(loaded.history[0].id).toBe('h1');
    expect(loaded.settings).toEqual({ ...DEFAULT_SETTINGS, hapticsEnabled: false, weekStart: 'saturday' });
    expect(loaded.restTimer.durationMs).toBe(90_000);

    expect(storage.map.has(LEGACY_STORAGE_KEY)).toBe(false);
    expect(storage.map.get(`${LEGACY_STORAGE_KEY}.imported-2026-10-31`)).toBe(blob);
    expect(repo.readKv(KV.importedAt)).toBe(now.toISOString());

    // Second run is a no-op.
    expect(await importFromAsyncStorage(repo, storage, defaults, now)).toEqual({ status: 'skipped', reason: 'already_imported' });
  });

  it('imports a v4 blob unchanged', async () => {
    const repo = fresh();
    const storage = memoryStorage({
      [LEGACY_STORAGE_KEY]: JSON.stringify({ state: { activeSession: null, history: [session('h1', 'completed')], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }, version: 4 }),
    });
    expect((await importFromAsyncStorage(repo, storage, defaults, now)).status).toBe('imported');
    expect(repo.loadAll(defaults).history).toHaveLength(1);
  });

  it('marks nothing-to-import so a later install never re-checks', async () => {
    const repo = fresh();
    const storage = memoryStorage();
    expect(await importFromAsyncStorage(repo, storage, defaults, now)).toEqual({ status: 'skipped', reason: 'nothing_to_import' });
    expect(repo.readKv(KV.importedAt)).toBe(now.toISOString());
  });

  it('keeps the original key and records the error on a malformed blob', async () => {
    const repo = fresh();
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: '{"state":{"history":[{"id":1}]},"version":4}' });
    const result = await importFromAsyncStorage(repo, storage, defaults, now);
    expect(result.status).toBe('failed');
    expect(storage.map.has(LEGACY_STORAGE_KEY)).toBe(true);
    expect(repo.counts().sessions).toBe(0);
    expect(repo.readKv(KV.importError)).toMatchObject({ at: now.toISOString() });
    expect(await importFromAsyncStorage(repo, storage, defaults, now)).toEqual({ status: 'skipped', reason: 'previous_error' });
  });
});

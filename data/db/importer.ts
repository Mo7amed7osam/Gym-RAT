import { migratePersistedState } from '@/store/migratePersistedState';
import type { WorkoutSession } from '@/types/workout';

import { mergeSettings, type PersistedWorkoutState, type WorkoutRepository } from './repository';
import { KV } from './schema';

/** The AsyncStorage key the zustand `persist` middleware used before SQLite. */
export const LEGACY_STORAGE_KEY = 'gym-rat/workout-store';

/** Minimal async key/value interface (AsyncStorage in the app, a Map in tests). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type ImportResult =
  | { status: 'skipped'; reason: 'already_imported' | 'nothing_to_import' | 'previous_error' }
  | { status: 'imported'; sessions: number; renamedTo: string }
  | { status: 'failed'; error: string };

/**
 * One-time import of the pre-SQLite AsyncStorage blob. The original value is
 * never deleted: on success it is renamed, on failure it is left in place and
 * the error is recorded so the import is not retried automatically.
 */
export async function importFromAsyncStorage(
  repo: WorkoutRepository,
  storage: KeyValueStorage,
  defaults: Pick<PersistedWorkoutState, 'restTimer' | 'settings'>,
  now: Date = new Date(),
): Promise<ImportResult> {
  if (repo.readKv(KV.importedAt)) return { status: 'skipped', reason: 'already_imported' };
  if (repo.readKv(KV.importError)) return { status: 'skipped', reason: 'previous_error' };

  const raw = await storage.getItem(LEGACY_STORAGE_KEY);
  if (raw === null) {
    repo.writeKv(KV.importedAt, now.toISOString());
    return { status: 'skipped', reason: 'nothing_to_import' };
  }

  try {
    const state = parseLegacyBlob(raw, defaults);
    const expected = {
      sessions: state.history.length + (state.activeSession ? 1 : 0),
      exercises: countExercises(state),
      sets: countSets(state),
    };

    repo.replaceAll(state);
    const actual = repo.counts();
    if (actual.sessions !== expected.sessions || actual.exercises !== expected.exercises || actual.sets !== expected.sets) {
      throw new Error(`Import verification failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    repo.writeKv(KV.importedAt, now.toISOString());

    const renamedTo = `${LEGACY_STORAGE_KEY}.imported-${now.toISOString().slice(0, 10)}`;
    await storage.setItem(renamedTo, raw);
    await storage.removeItem(LEGACY_STORAGE_KEY);
    return { status: 'imported', sessions: expected.sessions, renamedTo };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      repo.writeKv(KV.importError, { at: now.toISOString(), message });
    } catch {
      // The database itself is unusable; the caller surfaces the original error.
    }
    return { status: 'failed', error: message };
  }
}

function parseLegacyBlob(raw: string, defaults: Pick<PersistedWorkoutState, 'restTimer' | 'settings'>): PersistedWorkoutState {
  const parsed = JSON.parse(raw) as { state?: unknown; version?: unknown };
  if (!parsed || typeof parsed !== 'object' || typeof parsed.state !== 'object' || parsed.state === null) {
    throw new Error('Legacy blob has no state object');
  }
  const version = typeof parsed.version === 'number' ? parsed.version : 0;
  const migrated = migratePersistedState(parsed.state as Record<string, unknown>, version) as Partial<PersistedWorkoutState>;

  const history = Array.isArray(migrated.history) ? migrated.history : [];
  const activeSession = migrated.activeSession && typeof migrated.activeSession === 'object' ? migrated.activeSession : null;
  for (const session of [...history, ...(activeSession ? [activeSession] : [])]) assertSessionShape(session);

  return {
    exercises: [],
    plans: [],
    activeSession,
    history,
    restTimer: migrated.restTimer ?? defaults.restTimer,
    settings: mergeSettings(defaults.settings, migrated.settings ?? null),
  };
}

function assertSessionShape(session: WorkoutSession): void {
  if (typeof session.id !== 'string' || typeof session.startedAt !== 'string' || !Array.isArray(session.exercises)) {
    throw new Error('Legacy session has an unexpected shape');
  }
  for (const exercise of session.exercises) {
    if (typeof exercise.id !== 'string' || !Array.isArray(exercise.sets)) throw new Error('Legacy exercise has an unexpected shape');
  }
}

const countExercises = (state: PersistedWorkoutState) =>
  [...state.history, ...(state.activeSession ? [state.activeSession] : [])].reduce((n, s) => n + s.exercises.length, 0);
const countSets = (state: PersistedWorkoutState) =>
  [...state.history, ...(state.activeSession ? [state.activeSession] : [])].reduce(
    (n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0),
    0,
  );

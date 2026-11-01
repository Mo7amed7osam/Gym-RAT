import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { AppState } from 'react-native';

import { deleteAllCustomExercisePhotos } from '@/lib/customMedia';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';

import { createExpoDriver } from './driver.expo';
import type { Driver } from './driver';
import { importFromAsyncStorage } from './importer';
import { SCHEMA_VERSION, getUserVersion, migrate } from './migrations';
import { WorkoutRepository } from './repository';
import { BACKUP_DATABASE_NAME, DATABASE_NAME } from './schema';
import { seedExercises, seedPlans } from './seed';

/**
 * Opens the database, migrates it, imports legacy AsyncStorage data once,
 * loads the store and attaches write-through persistence. Runs exactly once
 * per process; `useStoreHydrated` subscribes to its status.
 */

export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';

let status: BootStatus = 'idle';
let bootError: string | null = null;
let bootPromise: Promise<void> | null = null;
let openDb: SQLite.SQLiteDatabase | null = null;
let appStateSubscribed = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

function setStatus(next: BootStatus, error: string | null = null): void {
  status = next;
  bootError = error;
  notify();
}

export const getBootStatus = (): BootStatus => status;
export const getBootError = (): string | null => bootError;

export function subscribeBoot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Starts the boot sequence if it has not started; safe to call many times. */
export function ensureBooted(): Promise<void> {
  if (!bootPromise) bootPromise = boot();
  return bootPromise;
}

async function boot(): Promise<void> {
  setStatus('loading');
  try {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    openDb = db;
    const driver = createExpoDriver(db);

    // Pragmas must run outside a transaction.
    driver.exec('PRAGMA journal_mode = WAL');
    driver.exec('PRAGMA synchronous = NORMAL');
    driver.exec('PRAGMA foreign_keys = ON');

    await migrateWithBackup(db, driver);

    const repo = new WorkoutRepository(driver);
    const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };
    const imported = await importFromAsyncStorage(repo, AsyncStorage, defaults);
    if (imported.status === 'failed') console.error('[db] legacy import failed; starting empty', imported.error);
    else if (imported.status === 'imported') console.log(`[db] imported ${imported.sessions} legacy sessions`);

    const loaded = repo.loadAll(defaults);
    const seeded = seedExercises(seedPlans(loaded));
    if (seeded !== loaded) {
      repo.persistDiff(loaded, seeded);
      console.log('[db] seeded bundled plans and exercises');
    }
    useWorkoutStore.getState().hydrate(seeded);
    attachPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });

    if (!appStateSubscribed) {
      appStateSubscribed = true;
      AppState.addEventListener('change', (state) => {
        if (state === 'active' || !openDb) return;
        try {
          openDb.execSync('PRAGMA wal_checkpoint(TRUNCATE)');
        } catch (error) {
          console.warn('[db] checkpoint failed', error);
        }
      });
    }

    setStatus('ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[db] boot failed', error);
    useWorkoutStore.getState().reportPersistenceError(message);
    // Let the app open; writes will keep failing loudly rather than silently.
    setStatus('error', message);
  }
}

/**
 * Spec §21 "Reset All Data": wipes the database, its backup and every
 * AsyncStorage key, then boots again from scratch. The store ends up with
 * defaults (onboarding pending, Starter plan active). Irreversible.
 */
export async function resetAllData(): Promise<void> {
  attachPersistence(null);
  useWorkoutStore.getState().hydrate({
    exercises: [],
    plans: [],
    activeSession: null,
    history: [],
    restTimer: IDLE_REST_TIMER,
    settings: DEFAULT_SETTINGS,
  });
  if (openDb) {
    try {
      await openDb.closeAsync();
    } catch (error) {
      console.warn('[db] close before reset failed', error);
    }
    openDb = null;
  }
  for (const name of [DATABASE_NAME, BACKUP_DATABASE_NAME]) {
    try {
      await SQLite.deleteDatabaseAsync(name);
    } catch {
      // Missing file (e.g. no backup yet) is fine.
    }
  }
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.warn('[db] AsyncStorage clear failed', error);
  }
  await deleteAllCustomExercisePhotos();
  bootPromise = boot();
  await bootPromise;
}

/**
 * Backs the existing file up before any schema step runs (a fresh database
 * needs no backup) and restores it if a step or the post-check fails.
 */
async function migrateWithBackup(db: SQLite.SQLiteDatabase, driver: Driver): Promise<void> {
  const from = getUserVersion(driver);
  if (from >= SCHEMA_VERSION) {
    migrate(driver); // no-op apart from verification
    return;
  }
  const backedUp = from > 0;
  if (backedUp) await copyDatabase(db, BACKUP_DATABASE_NAME);
  try {
    const result = migrate(driver);
    if (result.applied.length > 0) console.log(`[db] migrated ${result.from} → ${result.to}`);
  } catch (error) {
    if (backedUp) await restoreBackup(db);
    throw error;
  }
}

async function copyDatabase(source: SQLite.SQLiteDatabase, destName: string): Promise<void> {
  const dest = await SQLite.openDatabaseAsync(destName);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: source, sourceDatabaseName: 'main', destDatabase: dest, destDatabaseName: 'main' });
  } finally {
    await dest.closeAsync();
  }
}

async function restoreBackup(db: SQLite.SQLiteDatabase): Promise<void> {
  const source = await SQLite.openDatabaseAsync(BACKUP_DATABASE_NAME);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: source, sourceDatabaseName: 'main', destDatabase: db, destDatabaseName: 'main' });
    console.warn('[db] migration failed; restored the pre-migration backup');
  } finally {
    await source.closeAsync();
  }
}

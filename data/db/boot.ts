import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { AppState } from 'react-native';

import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';

import { createExpoDriver } from './driver.expo';
import type { Driver } from './driver';
import { importFromAsyncStorage } from './importer';
import { SCHEMA_VERSION, getUserVersion, migrate } from './migrations';
import { WorkoutRepository } from './repository';
import { BACKUP_DATABASE_NAME, DATABASE_NAME } from './schema';

/**
 * Opens the database, migrates it, imports legacy AsyncStorage data once,
 * loads the store and attaches write-through persistence. Runs exactly once
 * per process; `useStoreHydrated` subscribes to its status.
 */

export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';

let status: BootStatus = 'idle';
let bootError: string | null = null;
let bootPromise: Promise<void> | null = null;
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

    useWorkoutStore.getState().hydrate(repo.loadAll(defaults));
    attachPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });

    AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      try {
        driver.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      } catch (error) {
        console.warn('[db] checkpoint failed', error);
      }
    });

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

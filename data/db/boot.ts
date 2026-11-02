import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { AppState } from 'react-native';

import { registerStrengthMetrics } from '@/domain/analytics/metrics';
import { customMediaDirectoryUri, deleteAllCustomExercisePhotos, setCustomMediaScope } from '@/lib/customMedia';
import { GymFileProtection } from '@/modules/gym-native';
import { PDF_PROGRAM_ID } from '@/data/seeds/pdfProgram';
import { STARTER_PLAN_ID } from '@/data/seeds/starterPlan';
import { setHealthLedger } from '@/services/healthLedger';
import { attachProgressPersistence, useProgressStore } from '@/store/useProgressStore';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';

import { createExpoDriver } from './driver.expo';
import type { Driver } from './driver';
import { HealthExportRepository } from './healthExportRepository';
import { LEGACY_STORAGE_KEY, importFromAsyncStorage } from './importer';
import { SCHEMA_VERSION, getUserVersion, migrate } from './migrations';
import { EMPTY_PROGRESS, ProgressRepository } from './progressRepository';
import { WorkoutRepository } from './repository';
import { BACKUP_DATABASE_NAME, DATABASE_NAME, LEGACY_CLAIMED_DATABASE_NAME, userBackupDatabaseName, userDatabaseName } from './schema';
import { seedExercises, seedPlans } from './seed';

/**
 * Opens the database for one scope, migrates it, loads the store and attaches
 * write-through persistence. Since Phase 7 (ADR-016) a scope is an account:
 * every signed-in user has their own file, `gymrat.u-<id>.db`. The scope with
 * `userId: null` is the pre-account file `gymrat.db`; the app never opens it
 * for a signed-in user, only tests and the legacy-claim flow do.
 *
 * Switching scope (sign-out, account change) tears the current scope down in
 * the same order as Reset All Data: detach persistence → null the Health
 * ledger → hydrate empty → close. The ledger goes first so the Health
 * reconciler never treats the empty hydrate as "the user deleted every
 * workout". `useStoreHydrated` subscribes to the status for a scope.
 */

export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface BootScope {
  /** Server user id, or null for the legacy single file. */
  userId: string | null;
}

export const LEGACY_SCOPE: BootScope = { userId: null };

export const scopeKey = (scope: BootScope): string => scope.userId ?? '__legacy__';

let status: BootStatus = 'idle';
let bootError: string | null = null;
let bootPromise: Promise<void> | null = null;
let currentKey: string | null = null;
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
/** Key of the scope that is booted or booting; null when nothing is open. */
export const getBootScopeKey = (): string | null => currentKey;

export function subscribeBoot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const fileNames = (scope: BootScope) =>
  scope.userId ? { db: userDatabaseName(scope.userId), backup: userBackupDatabaseName(scope.userId) } : { db: DATABASE_NAME, backup: BACKUP_DATABASE_NAME };

/**
 * Boots the scope, or switches to it when another scope is open. Safe to call
 * many times; concurrent callers for the same scope share one promise.
 */
export function ensureBooted(scope: BootScope = LEGACY_SCOPE): Promise<void> {
  const key = scopeKey(scope);
  if (bootPromise && currentKey === key) return bootPromise;
  const previous = bootPromise ?? Promise.resolve();
  currentKey = key;
  bootPromise = previous
    .catch(() => undefined)
    .then(async () => {
      if (currentKey !== key) return; // superseded by a later call
      teardown();
      await boot(scope);
    });
  return bootPromise;
}

/** Sign-out: closes the current scope and leaves the stores empty. Deletes nothing. */
export async function closeDatabase(): Promise<void> {
  const pending = bootPromise;
  currentKey = null;
  bootPromise = null;
  if (pending) await pending.catch(() => undefined);
  if (currentKey !== null) return; // a new scope was requested meanwhile
  await teardownAsync();
  setStatus('idle');
}

const EMPTY_WORKOUT = () => ({
  exercises: [],
  plans: [],
  activeSession: null,
  history: [],
  restTimer: IDLE_REST_TIMER,
  settings: DEFAULT_SETTINGS,
});

/** Detach → ledger off → empty hydrate; the file is closed asynchronously by the caller. */
function teardown(): SQLite.SQLiteDatabase | null {
  attachPersistence(null);
  attachProgressPersistence(null);
  setHealthLedger(null);
  useProgressStore.getState().hydrate(EMPTY_PROGRESS);
  useWorkoutStore.getState().hydrate(EMPTY_WORKOUT());
  useWorkoutStore.getState().reportPersistenceError(null);
  const db = openDb;
  openDb = null;
  if (db) void db.closeAsync().catch((error) => console.warn('[db] close failed', error));
  return db;
}

async function teardownAsync(): Promise<void> {
  attachPersistence(null);
  attachProgressPersistence(null);
  setHealthLedger(null);
  useProgressStore.getState().hydrate(EMPTY_PROGRESS);
  useWorkoutStore.getState().hydrate(EMPTY_WORKOUT());
  useWorkoutStore.getState().reportPersistenceError(null);
  if (openDb) {
    try {
      await openDb.closeAsync();
    } catch (error) {
      console.warn('[db] close failed', error);
    }
    openDb = null;
  }
}

async function boot(scope: BootScope): Promise<void> {
  setStatus('loading');
  const names = fileNames(scope);
  try {
    setCustomMediaScope(scope.userId);
    const db = await SQLite.openDatabaseAsync(names.db);
    openDb = db;
    const driver = createExpoDriver(db);

    // Pragmas must run outside a transaction.
    driver.exec('PRAGMA journal_mode = WAL');
    driver.exec('PRAGMA synchronous = NORMAL');
    driver.exec('PRAGMA foreign_keys = ON');

    await migrateWithBackup(db, driver, names.backup);
    protectDatabaseFiles();
    setHealthLedger(new HealthExportRepository(driver));

    const repo = new WorkoutRepository(driver);
    const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };
    // The AsyncStorage blob predates accounts: only the legacy file imports it.
    // A claimed legacy file carries its `importedAt` marker along (ADR-016).
    if (scope.userId === null) {
      const imported = await importFromAsyncStorage(repo, AsyncStorage, defaults);
      if (imported.status === 'failed') console.error('[db] legacy import failed; starting empty', imported.error);
      else if (imported.status === 'imported') console.log(`[db] imported ${imported.sessions} legacy sessions`);
    }

    const loaded = repo.loadAll(defaults);
    const seeded = seedExercises(seedPlans(loaded));
    if (seeded !== loaded) {
      repo.persistDiff(loaded, seeded);
      console.log('[db] seeded bundled plans and exercises');
    }
    useWorkoutStore.getState().hydrate(seeded);
    attachPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });
    // One strength engine for live finishes, history replays and charts (ADR-012).
    registerStrengthMetrics((exerciseId) => useWorkoutStore.getState().exercises.find((item) => item.id === exerciseId)?.weightType ?? 'total');

    // Phase 4: body measurements and goals (ADR-011). Tables guaranteed by migrate() (ADR-012).
    const progressRepo = new ProgressRepository(driver);
    useProgressStore.getState().hydrate(progressRepo.loadAll());
    attachProgressPersistence({ persist: (prev, next) => progressRepo.persistDiff(prev, next) });

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

async function deleteDatabaseFiles(...names: string[]): Promise<void> {
  for (const name of names) {
    try {
      await SQLite.deleteDatabaseAsync(name);
    } catch {
      // Missing file (e.g. no backup yet) is fine.
    }
  }
}

/**
 * Spec §21 "Reset All Data", now scoped to the open account (ADR-016): wipes
 * this account's database, its backup and its photos, then boots the same
 * scope again from scratch. The legacy scope also clears AsyncStorage (the
 * pre-SQLite blob lived there). Irreversible.
 */
export async function resetAllData(): Promise<void> {
  const key = currentKey;
  const scope: BootScope = key === null || key === '__legacy__' ? LEGACY_SCOPE : { userId: key };
  const pending = bootPromise;
  if (pending) await pending.catch(() => undefined);
  await teardownAsync();
  const names = fileNames(scope);
  await deleteDatabaseFiles(names.db, names.backup);
  if (scope.userId === null) {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.warn('[db] AsyncStorage clear failed', error);
    }
  }
  await deleteAllCustomExercisePhotos(scope.userId);
  currentKey = scopeKey(scope);
  bootPromise = boot(scope);
  await bootPromise;
}

/**
 * Settings → "Remove my data from this phone": deletes one account's files
 * and photos. Closes the scope first when it is the open one. The caller
 * signs the user out afterwards; nothing else on the phone is touched.
 */
export async function removeAccountData(userId: string): Promise<void> {
  const names = fileNames({ userId });
  if (currentKey === userId) {
    const pending = bootPromise;
    currentKey = null;
    bootPromise = null;
    if (pending) await pending.catch(() => undefined);
    await teardownAsync();
    setStatus('idle');
  }
  await deleteDatabaseFiles(names.db, names.backup);
  await deleteAllCustomExercisePhotos(userId);
}

// ─── Legacy (pre-account) data ───────────────────────────────────────────────

export interface LegacyDataProbe {
  /** Where pre-account data was found, if anywhere. */
  source: 'database' | 'asyncStorage' | null;
  sessions: number;
  customExercises: number;
  userPlans: number;
  bodyEntries: number;
  goals: number;
  /** Anything a person would miss; bundled seed content alone does not count. */
  hasUserData: boolean;
}

export const EMPTY_PROBE: LegacyDataProbe = { source: null, sessions: 0, customExercises: 0, userPlans: 0, bodyEntries: 0, goals: 0, hasUserData: false };

function databaseFileExists(name: string): boolean {
  const directory = SQLite.defaultDatabaseDirectory ? String(SQLite.defaultDatabaseDirectory) : null;
  if (!directory) return false;
  try {
    return new File(Paths.join(directory, name)).exists;
  } catch {
    return false;
  }
}

const BUNDLED_PLAN_IDS = new Set([PDF_PROGRAM_ID, STARTER_PLAN_ID, `${PDF_PROGRAM_ID}:active`, `${STARTER_PLAN_ID}:active`]);

function countLegacyRows(driver: Driver): Omit<LegacyDataProbe, 'source' | 'hasUserData'> {
  const tables = new Set(driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name));
  const count = (table: string, where = '', params: string[] = []) =>
    tables.has(table) ? Number(driver.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} ${where}`, params)?.n ?? 0) : 0;
  const placeholders = [...BUNDLED_PLAN_IDS].map(() => '?').join(', ');
  return {
    sessions: count('sessions'),
    customExercises: count('exercises', "WHERE origin = 'custom'"),
    userPlans: count('plans', `WHERE id NOT IN (${placeholders})`, [...BUNDLED_PLAN_IDS]),
    bodyEntries: count('body_metrics'),
    goals: count('goals'),
  };
}

/** Looks at the pre-account file (and the even older AsyncStorage blob) without changing either. */
export async function probeLegacyData(): Promise<LegacyDataProbe> {
  if (databaseFileExists(DATABASE_NAME)) {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    try {
      const counts = countLegacyRows(createExpoDriver(db));
      const hasUserData = counts.sessions + counts.customExercises + counts.userPlans + counts.bodyEntries + counts.goals > 0;
      return { source: 'database', ...counts, hasUserData };
    } finally {
      await db.closeAsync().catch(() => undefined);
    }
  }
  const blob = await AsyncStorage.getItem(LEGACY_STORAGE_KEY).catch(() => null);
  if (blob) {
    let sessions = 0;
    try {
      const parsed = JSON.parse(blob) as { state?: { history?: unknown[] } };
      sessions = Array.isArray(parsed.state?.history) ? parsed.state!.history!.length : 0;
    } catch {
      sessions = 0;
    }
    return { ...EMPTY_PROBE, source: 'asyncStorage', sessions, hasUserData: true };
  }
  return EMPTY_PROBE;
}

/**
 * Attaches the pre-account data to `userId` (ADR-016). The legacy file is
 * copied into the account's file, the copy is verified by row counts, and
 * only then is the legacy file renamed to `gymrat.legacy-claimed.db`. The
 * account's current file is replaced, so callers only offer this while the
 * account has no sessions of its own. Boots the account afterwards.
 */
export async function claimLegacyData(userId: string): Promise<LegacyDataProbe> {
  const names = fileNames({ userId });
  const probe = await probeLegacyData();
  if (!probe.source) return probe;

  if (currentKey === userId) {
    const pending = bootPromise;
    currentKey = null;
    bootPromise = null;
    if (pending) await pending.catch(() => undefined);
    await teardownAsync();
    setStatus('idle');
  }

  if (probe.source === 'database') {
    await deleteDatabaseFiles(names.db, names.backup);
    await copyDatabaseFile(DATABASE_NAME, names.db);
    const copied = await SQLite.openDatabaseAsync(names.db);
    try {
      const counts = countLegacyRows(createExpoDriver(copied));
      if (counts.sessions !== probe.sessions || counts.customExercises !== probe.customExercises) {
        throw new Error(`Legacy copy verification failed: expected ${probe.sessions} sessions, got ${counts.sessions}`);
      }
    } finally {
      await copied.closeAsync().catch(() => undefined);
    }
    await deleteDatabaseFiles(LEGACY_CLAIMED_DATABASE_NAME);
    await copyDatabaseFile(DATABASE_NAME, LEGACY_CLAIMED_DATABASE_NAME);
    await deleteDatabaseFiles(DATABASE_NAME, BACKUP_DATABASE_NAME);
  } else {
    // AsyncStorage-only install: run the one-time importer against the account's fresh file.
    await deleteDatabaseFiles(names.db, names.backup);
    const db = await SQLite.openDatabaseAsync(names.db);
    try {
      const driver = createExpoDriver(db);
      driver.exec('PRAGMA journal_mode = WAL');
      migrate(driver);
      const repo = new WorkoutRepository(driver);
      const imported = await importFromAsyncStorage(repo, AsyncStorage, { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
      if (imported.status === 'failed') throw new Error(imported.error);
    } finally {
      await db.closeAsync().catch(() => undefined);
    }
  }
  await ensureBooted({ userId });
  return probe;
}

async function copyDatabaseFile(sourceName: string, destName: string): Promise<void> {
  const source = await SQLite.openDatabaseAsync(sourceName);
  try {
    await copyDatabase(source, destName);
  } finally {
    await source.closeAsync().catch(() => undefined);
  }
}

/**
 * Data protection (ADR-013): `NSFileProtectionCompleteUnlessOpen`. The app
 * entitlement covers files created by this build; this upgrades the database,
 * its WAL/SHM and backup, and the custom exercise photos from earlier builds,
 * and the directories so new files inherit the class. Unless-open keeps the
 * already-open database writable for the checkpoint that runs as the app goes
 * to the background on lock. Best-effort: a failure is logged and the app
 * keeps working.
 */
function protectDatabaseFiles(): void {
  if (!GymFileProtection) return;
  const directories = [SQLite.defaultDatabaseDirectory ? String(SQLite.defaultDatabaseDirectory) : null, customMediaDirectoryUri()];
  for (const directory of directories) {
    if (!directory) continue;
    try {
      const changed = GymFileProtection.protectDirectory(directory, 'completeUnlessOpen');
      console.log(`[db] file protection: completeUnlessOpen on ${changed.length} items`);
    } catch (error) {
      console.warn('[db] file protection failed', error);
    }
  }
}

/**
 * Backs the existing file up before any schema step runs (a fresh database
 * needs no backup) and restores it if a step or the post-check fails.
 */
async function migrateWithBackup(db: SQLite.SQLiteDatabase, driver: Driver, backupName: string): Promise<void> {
  const from = getUserVersion(driver);
  const onRepair = (repaired: string[]) => console.warn(`[db] reconciled schema: added ${repaired.join(', ')}`);
  if (from >= SCHEMA_VERSION) {
    migrate(driver, { onRepair }); // no steps; reconcile + verification only
    return;
  }
  const backedUp = from > 0;
  if (backedUp) await copyDatabase(db, backupName);
  try {
    const result = migrate(driver, { onRepair });
    if (result.applied.length > 0) console.log(`[db] migrated ${result.from} → ${result.to}`);
  } catch (error) {
    if (backedUp) await restoreBackup(db, backupName);
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

async function restoreBackup(db: SQLite.SQLiteDatabase, backupName: string): Promise<void> {
  const source = await SQLite.openDatabaseAsync(backupName);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: source, sourceDatabaseName: 'main', destDatabase: db, destDatabaseName: 'main' });
    console.warn('[db] migration failed; restored the pre-migration backup');
  } finally {
    await source.closeAsync();
  }
}

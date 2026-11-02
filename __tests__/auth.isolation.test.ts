import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

import { claimLegacyData, closeDatabase, ensureBooted, getBootScopeKey, getBootStatus, probeLegacyData, removeAccountData, resetAllData } from '@/data/db/boot';
import { LEGACY_STORAGE_KEY } from '@/data/db/importer';
import { DATABASE_NAME, LEGACY_CLAIMED_DATABASE_NAME, userDatabaseName } from '@/data/db/schema';
import { connectIntegrations } from '@/services/integrations';
import { healthLedger } from '@/services/healthLedger';
import { shouldOfferLegacyData } from '@/screens/auth/legacyPrompt';
import { createMemoryAuthStorage } from '@/services/auth/storage';
import { useProgressStore } from '@/store/useProgressStore';
import { useWorkoutStore } from '@/store/useWorkoutStore';

/**
 * Per-account local data (ADR-016) on real SQLite files: two accounts on one
 * phone never see each other's workouts, sign-out closes without deleting,
 * the Health reconciler is never fed an empty history with a live ledger,
 * pre-account data is offered and attached only on request, and "Remove my
 * data" deletes one account's files only.
 */

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: Db, backup } = require('node:sqlite');
  const nodeFs = require('node:fs');
  const nodePath = require('node:path');
  const nodeOs = require('node:os');
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'gymrat-iso-'));
  const open = (name: string) => {
    const file = nodePath.join(dir, name);
    const db = new Db(file);
    return {
      __file: file,
      __db: db,
      execSync: (sql: string) => db.exec(sql),
      runSync: (sql: string, params: unknown[] = []) => db.prepare(sql).run(...params),
      getAllSync: (sql: string, params: unknown[] = []) => db.prepare(sql).all(...params),
      getFirstSync: (sql: string, params: unknown[] = []) => db.prepare(sql).get(...params) ?? null,
      withTransactionSync: (task: () => void) => {
        db.exec('BEGIN');
        try {
          task();
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
      closeAsync: async () => {
        try {
          db.close();
        } catch {
          // already closed
        }
      },
    };
  };
  return {
    __dir: dir,
    defaultDatabaseDirectory: dir,
    openDatabaseAsync: async (name: string) => open(name),
    deleteDatabaseAsync: async (name: string) => {
      const file = nodePath.join(dir, name);
      if (!nodeFs.existsSync(file)) throw new Error(`no such database ${name}`);
      for (const suffix of ['', '-wal', '-shm']) nodeFs.rmSync(file + suffix, { force: true });
    },
    backupDatabaseAsync: async ({ sourceDatabase, destDatabase }: { sourceDatabase: { __db: unknown }; destDatabase: { __db: { close: () => void }; __file: string } }) => {
      destDatabase.__db.close();
      nodeFs.rmSync(destDatabase.__file, { force: true });
      await backup(sourceDatabase.__db, destDatabase.__file);
    },
  };
});

jest.mock('expo-file-system', () => {
  const nodeFs = require('node:fs');
  class File {
    uri: string;
    constructor(filePath: string) {
      this.uri = filePath;
    }
    get exists() {
      return nodeFs.existsSync(this.uri);
    }
  }
  class Directory {
    uri = '/dev/null/exercise-media';
    exists = false;
    create() {}
    list() {
      return [];
    }
    async delete() {}
  }
  return { File, Directory, Paths: { document: '/dev/null', join: (...parts: string[]) => parts.join('/') } };
});

const dbDir = (jest.requireMock('expo-sqlite') as { __dir: string }).__dir;
const file = (name: string) => path.join(dbDir, name);
const count = (name: string, table: string): number => {
  const db = new DatabaseSync(file(name), { readOnly: true });
  try {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  } finally {
    db.close();
  }
};

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

const logOneWorkout = (notes: string) => {
  const store = useWorkoutStore.getState();
  if (!store.settings.onboardingComplete) store.updateSettings({ onboardingComplete: true });
  const started = store.startWorkout();
  expect(started.ok).toBe(true);
  useWorkoutStore.getState().setSessionNotes(notes);
  useWorkoutStore.getState().finishWorkout('advance');
};

afterAll(() => fs.rmSync(dbDir, { recursive: true, force: true }));

describe('per-account databases', () => {
  it('each account gets its own file; one account never sees the other’s history', async () => {
    await ensureBooted({ userId: ALICE });
    expect(getBootStatus()).toBe('ready');
    expect(getBootScopeKey()).toBe(ALICE);
    logOneWorkout('alice 1');
    logOneWorkout('alice 2');
    expect(useWorkoutStore.getState().history).toHaveLength(2);
    expect(fs.existsSync(file(userDatabaseName(ALICE)))).toBe(true);
    expect(fs.existsSync(file(DATABASE_NAME))).toBe(false); // the legacy file is never created for an account

    await ensureBooted({ userId: BOB });
    expect(getBootScopeKey()).toBe(BOB);
    expect(useWorkoutStore.getState().history).toEqual([]);
    expect(useWorkoutStore.getState().settings.onboardingComplete).toBe(false); // fresh account: onboarding again
    logOneWorkout('bob 1');
    expect(useWorkoutStore.getState().history.map((s) => s.notes)).toEqual(['bob 1']);

    await ensureBooted({ userId: ALICE });
    expect(useWorkoutStore.getState().history.map((s) => s.notes)).toEqual(['alice 2', 'alice 1']);
    expect(count(userDatabaseName(ALICE), 'sessions')).toBe(2);
    expect(count(userDatabaseName(BOB), 'sessions')).toBe(1);
  });

  it('sign-out closes the file and empties the store without deleting anything; Health never receives a delete', async () => {
    await ensureBooted({ userId: ALICE });
    const removed: string[] = [];
    const handles = connectIntegrations({
      restAlerts: { schedule: async () => {}, cancel: async () => {} },
      activity: { existing: () => [], start: () => ({ update: async () => {}, end: async () => {} }) },
      health: {
        status: () => 'authorized',
        save: async (workout) => ({ uuid: `uuid-${workout.sessionId}`, replaced: 0 }),
        remove: async (sessionId) => {
          removed.push(sessionId);
          return 1;
        },
      },
      ledger: healthLedger,
    });
    useWorkoutStore.getState().updateSettings({ healthExportEnabled: true, healthExportSince: '2000-01-01T00:00:00.000Z' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(healthLedger.loadAll()).toHaveLength(2); // both sessions exported

    await closeDatabase();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getBootStatus()).toBe('idle');
    expect(getBootScopeKey()).toBeNull();
    expect(useWorkoutStore.getState().history).toEqual([]);
    expect(useProgressStore.getState().bodyEntries).toEqual([]);
    expect(removed).toEqual([]); // the ledger was nulled before the empty hydrate
    expect(count(userDatabaseName(ALICE), 'sessions')).toBe(2);
    expect(count(userDatabaseName(ALICE), 'health_exports')).toBe(2);
    handles.detach();

    // Writes while signed out must not reach any file.
    expect(() => useWorkoutStore.getState().updateSettings({ hapticsEnabled: false })).not.toThrow();
    expect(count(userDatabaseName(ALICE), 'sessions')).toBe(2);
  });

  it('Reset All Data wipes only the open account', async () => {
    await ensureBooted({ userId: BOB });
    expect(useWorkoutStore.getState().history).toHaveLength(1);
    await resetAllData();
    expect(getBootScopeKey()).toBe(BOB);
    expect(useWorkoutStore.getState().history).toEqual([]);
    expect(count(userDatabaseName(ALICE), 'sessions')).toBe(2);
  });

  it('Remove my data deletes one account’s files and leaves the other account alone', async () => {
    await ensureBooted({ userId: BOB });
    logOneWorkout('bob again');
    await removeAccountData(BOB);
    expect(fs.existsSync(file(userDatabaseName(BOB)))).toBe(false);
    expect(getBootStatus()).toBe('idle');
    expect(count(userDatabaseName(ALICE), 'sessions')).toBe(2);
    await ensureBooted({ userId: BOB });
    expect(useWorkoutStore.getState().history).toEqual([]);
  });

  it('refuses unsafe user ids', () => {
    expect(() => userDatabaseName('../etc/passwd')).toThrow();
    expect(() => userDatabaseName('')).toThrow();
  });
});

describe('pre-account (legacy) data', () => {
  const CAROL = '33333333-3333-4333-8333-333333333333';

  it('is probed without being changed, and bundled seed alone does not count as user data', async () => {
    await closeDatabase();
    expect(await probeLegacyData()).toMatchObject({ source: null, hasUserData: false });

    await ensureBooted({ userId: null }); // a pre-Phase-7 install: seeds only
    await closeDatabase();
    expect(await probeLegacyData()).toMatchObject({ source: 'database', sessions: 0, hasUserData: false });

    await ensureBooted({ userId: null });
    logOneWorkout('legacy 1');
    logOneWorkout('legacy 2');
    logOneWorkout('legacy 3');
    await closeDatabase();
    const probe = await probeLegacyData();
    expect(probe).toMatchObject({ source: 'database', sessions: 3, hasUserData: true });
    expect(count(DATABASE_NAME, 'sessions')).toBe(3);
  });

  it('is offered once per account and only while the account has no sessions', async () => {
    const storage = createMemoryAuthStorage();
    expect(await shouldOfferLegacyData(CAROL, 0, storage)).toMatchObject({ sessions: 3 });
    expect(await shouldOfferLegacyData(CAROL, 0, storage)).toBeNull(); // flag set: never nags
    expect(await shouldOfferLegacyData(ALICE, 2, storage)).toBeNull(); // has her own workouts
    expect(count(DATABASE_NAME, 'sessions')).toBe(3); // untouched by the offer
  });

  it('declining changes nothing; a signed-in account starts empty', async () => {
    await ensureBooted({ userId: CAROL });
    expect(useWorkoutStore.getState().history).toEqual([]);
    expect(count(DATABASE_NAME, 'sessions')).toBe(3);
  });

  it('claiming copies the data into the account, verifies it, and renames the legacy file', async () => {
    const probe = await claimLegacyData(CAROL);
    expect(probe.sessions).toBe(3);
    expect(getBootScopeKey()).toBe(CAROL);
    expect(getBootStatus()).toBe('ready');
    expect(useWorkoutStore.getState().history.map((s) => s.notes)).toEqual(['legacy 3', 'legacy 2', 'legacy 1']);
    expect(useWorkoutStore.getState().settings.onboardingComplete).toBe(true);
    expect(fs.existsSync(file(DATABASE_NAME))).toBe(false);
    expect(count(LEGACY_CLAIMED_DATABASE_NAME, 'sessions')).toBe(3);
    expect(count(userDatabaseName(ALICE), 'sessions')).toBe(2); // other accounts unaffected
    expect(await probeLegacyData()).toMatchObject({ source: null });
    logOneWorkout('carol 4');
    expect(count(userDatabaseName(CAROL), 'sessions')).toBe(4);
  });

  it('an AsyncStorage-only install is imported into the claiming account', async () => {
    await closeDatabase();
    const blob = {
      state: {
        history: [],
        activeSession: null,
        settings: { onboardingComplete: true, hapticsEnabled: false },
      },
      version: 0,
    };
    await AsyncStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(blob));
    expect(await probeLegacyData()).toMatchObject({ source: 'asyncStorage', hasUserData: true });
    const DAVE = '44444444-4444-4444-8444-444444444444';
    await claimLegacyData(DAVE);
    expect(getBootScopeKey()).toBe(DAVE);
    expect(useWorkoutStore.getState().settings.hapticsEnabled).toBe(false);
    expect(await AsyncStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });
});

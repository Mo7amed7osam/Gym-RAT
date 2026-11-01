import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

import { ensureBooted, getBootStatus, resetAllData } from '@/data/db/boot';
import { SCHEMA_VERSION } from '@/data/db/migrations';
import { DATABASE_NAME } from '@/data/db/schema';
import { STARTER_PLAN_ID } from '@/data/seeds/starterPlan';
import { selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';

/**
 * Boot and Reset All Data against a real SQLite file. `expo-sqlite` is
 * replaced by a node:sqlite adapter with the same sync surface the expo
 * driver uses, so the exact boot code path (pragmas, migration, seed,
 * write-through, reset, re-boot) runs here.
 */

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: Db } = require('node:sqlite');
  const nodeFs = require('node:fs');
  const nodePath = require('node:path');
  const nodeOs = require('node:os');
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'gymrat-boot-'));
  const open = (name: string) => {
    const db = new Db(nodePath.join(dir, name));
    return {
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
      closeAsync: async () => db.close(),
    };
  };
  return {
    __dir: dir,
    openDatabaseAsync: async (name: string) => open(name),
    deleteDatabaseAsync: async (name: string) => {
      const file = nodePath.join(dir, name);
      if (!nodeFs.existsSync(file)) throw new Error(`no such database ${name}`);
      for (const suffix of ['', '-wal', '-shm']) nodeFs.rmSync(file + suffix, { force: true });
    },
    backupDatabaseAsync: async () => {
      throw new Error('backup is not expected on a fresh database');
    },
  };
});

const dbDir = (jest.requireMock('expo-sqlite') as { __dir: string }).__dir;
const dbFile = path.join(dbDir, DATABASE_NAME);

function query<T>(sql: string): T {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    return db.prepare(sql).get() as T;
  } finally {
    db.close();
  }
}

afterAll(() => fs.rmSync(dbDir, { recursive: true, force: true }));

describe('boot', () => {
  it('creates the database at the current schema with WAL and seeds a fresh install', async () => {
    await AsyncStorage.setItem('gym-rat/some-legacy-key', '1');
    await ensureBooted();
    expect(getBootStatus()).toBe('ready');
    expect(fs.existsSync(dbFile)).toBe(true);
    expect(query<{ user_version: number }>('PRAGMA user_version').user_version).toBe(SCHEMA_VERSION);
    expect(query<{ journal_mode: string }>('PRAGMA journal_mode').journal_mode).toBe('wal');
    expect(query<{ n: number }>('SELECT COUNT(*) AS n FROM plans').n).toBe(3);

    const state = useWorkoutStore.getState();
    expect(state.settings.onboardingComplete).toBe(false);
    expect(state.history).toEqual([]);
    expect(selectActivePlan(state)?.sourcePlanId).toBe(STARTER_PLAN_ID);
  });

  it('writes through to the file before the store changes', async () => {
    await ensureBooted();
    useWorkoutStore.getState().updateSettings({ onboardingComplete: true });
    const started = useWorkoutStore.getState().startWorkout();
    expect(started.ok).toBe(true);
    useWorkoutStore.getState().finishWorkout('advance');

    expect(query<{ n: number }>('SELECT COUNT(*) AS n FROM sessions').n).toBe(1);
    const kv = query<{ value: string }>("SELECT value FROM kv WHERE key = 'settings'");
    expect(JSON.parse(kv.value).onboardingComplete).toBe(true);
    expect(query<{ next_day_index: number }>("SELECT next_day_index FROM plans WHERE kind = 'active'").next_day_index).toBe(1);
  });

  it('Reset All Data deletes the file and AsyncStorage, then boots a fresh install that persists again', async () => {
    await ensureBooted();
    expect(useWorkoutStore.getState().history).toHaveLength(1);
    const before = fs.statSync(dbFile).ino;

    await resetAllData();

    expect(getBootStatus()).toBe('ready');
    expect(fs.existsSync(dbFile)).toBe(true);
    expect(fs.statSync(dbFile).ino).not.toBe(before);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(query<{ user_version: number }>('PRAGMA user_version').user_version).toBe(SCHEMA_VERSION);
    expect(query<{ n: number }>('SELECT COUNT(*) AS n FROM sessions').n).toBe(0);

    const state = useWorkoutStore.getState();
    expect(state.history).toEqual([]);
    expect(state.activeSession).toBeNull();
    expect(state.settings.onboardingComplete).toBe(false);
    expect(selectActivePlan(state)?.sourcePlanId).toBe(STARTER_PLAN_ID);
    expect(selectActivePlan(state)?.nextDayIndex).toBe(0);
    expect(state.persistenceError).toBeNull();

    // Persistence is attached to the new file, not the deleted one.
    useWorkoutStore.getState().updateSettings({ restWarningSeconds: 5 });
    const kv = query<{ value: string }>("SELECT value FROM kv WHERE key = 'settings'");
    expect(JSON.parse(kv.value).restWarningSeconds).toBe(5);
  });
});

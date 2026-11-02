import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { claimLegacyData, closeDatabase, ensureBooted, getBootStatus, probeLegacyData } from '@/data/db/boot';
import { DATABASE_NAME, LEGACY_CLAIMED_DATABASE_NAME, userDatabaseName } from '@/data/db/schema';
import { useWorkoutStore } from '@/store/useWorkoutStore';

/** Claiming a real pre-account file (the Phase 3 simulator fixture, schema v7) into a fresh account. */

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: Db, backup } = require('node:sqlite');
  const nodeFs = require('node:fs');
  const nodePath = require('node:path');
  const nodeOs = require('node:os');
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'gymrat-fixture-'));
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
const fixture = path.join(__dirname, '..', 'test', 'fixtures', 'sim-phase3-v7.db');
const count = (name: string): number => {
  const db = new DatabaseSync(path.join(dbDir, name), { readOnly: true });
  try {
    return (db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n;
  } finally {
    db.close();
  }
};

afterAll(() => fs.rmSync(dbDir, { recursive: true, force: true }));

it('attaches the v7 simulator fixture to a new account and migrates it to the current schema', async () => {
  for (const suffix of ['', '-wal', '-shm']) fs.copyFileSync(fixture + suffix, path.join(dbDir, DATABASE_NAME + suffix));
  const OMAR = '84070954-f5c0-4d63-b846-8e7fc89c4d5e';
  await ensureBooted({ userId: OMAR });
  expect(useWorkoutStore.getState().history).toEqual([]);
  const probe = await probeLegacyData();
  expect(probe).toMatchObject({ source: 'database', hasUserData: true });
  expect(probe.sessions).toBeGreaterThan(0);

  const claimed = await claimLegacyData(OMAR);
  expect(claimed.sessions).toBe(probe.sessions);
  expect(getBootStatus()).toBe('ready');
  expect(useWorkoutStore.getState().history.length + (useWorkoutStore.getState().activeSession ? 1 : 0)).toBe(probe.sessions);
  expect(useWorkoutStore.getState().settings.onboardingComplete).toBe(true);
  expect(fs.existsSync(path.join(dbDir, DATABASE_NAME))).toBe(false);
  expect(count(LEGACY_CLAIMED_DATABASE_NAME)).toBe(probe.sessions);
  expect(count(userDatabaseName(OMAR))).toBe(probe.sessions);
  await closeDatabase();
});

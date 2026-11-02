import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

import { claimLegacyData, closeDatabase, probeLegacyData } from '@/data/db/boot';
import { createNodeDriver } from '@/data/db/driver.node';
import { migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { DATABASE_NAME, LEGACY_CLAIMED_DATABASE_NAME, userDatabaseName } from '@/data/db/schema';
import { LEGACY_STARTER_NAME_EN, STARTER_PLAN_ID } from '@/data/seeds/starterPlan';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, useWorkoutStore } from '@/store/useWorkoutStore';
import { done, exercise, local, session } from '@/test/fixtures/sessions';

/**
 * Integration of Phase 7 (per-account files, ADR-016) with the Phase 6 fixes
 * and the owner's backup decision (2026-11-02): a database written by the
 * pre-account app on main (schema v10, starter still named "(draft)") is
 * attached to a new account intact, and nothing excludes workout data from
 * iCloud / computer device backups.
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


const DAN = '44444444-4444-4444-8444-444444444444';

afterAll(() => fs.rmSync(dbDir, { recursive: true, force: true }));

function writeMainDatabase(): void {
  const driver = createNodeDriver(file(DATABASE_NAME));
  migrate(driver);
  const repo = new WorkoutRepository(driver);
  const empty = repo.loadAll({ restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
  const seeded = seedExercises(seedPlans(empty));
  // As stored by builds before the Phase 6 fixes.
  const plans = seeded.plans.map((plan) =>
    plan.id === STARTER_PLAN_ID || plan.sourcePlanId === STARTER_PLAN_ID
      ? { ...plan, name: { en: LEGACY_STARTER_NAME_EN, ar: 'برنامج الجسم الكامل للمبتدئين (مسودة)' }, nextDayIndex: plan.kind === 'active' ? 1 : 0 }
      : plan,
  );
  const history = [
    session(local(2026, 10, 30), [exercise('leg_press', [done(120, 10), done(130, 8)])], { id: 'main-2', notes: 'main 2' }),
    session(local(2026, 10, 28), [exercise('leg_press', [done(110, 10)])], { id: 'main-1', notes: 'main 1' }),
  ];
  repo.replaceAll({ ...seeded, plans, history, settings: { ...seeded.settings, onboardingComplete: true } });
  driver.db.close();
}

describe('main database → Phase 7 account', () => {
  it('attaches a pre-account v10 database with its plans, rotation and history, renaming the draft starter', async () => {
    writeMainDatabase();
    expect((await probeLegacyData()).sessions).toBe(2);
    const before = useWorkoutStore.getState();
    expect(before.history).toHaveLength(0);
    await claimLegacyData(DAN);
    const state = useWorkoutStore.getState();
    expect(state.history.map((s) => s.notes)).toEqual(['main 2', 'main 1']);
    const active = state.plans.find((plan) => plan.kind === 'active')!;
    expect(active).toMatchObject({ sourcePlanId: STARTER_PLAN_ID, nextDayIndex: 1, name: { en: 'Full Body Starter', ar: 'برنامج الجسم الكامل للمبتدئين' } });
    expect(active.days[0].exercises.map((e) => e.exerciseId)).toEqual(['leg_press', 'flat_dumbbell_bench_press', 'seated_close_grip_row', 'seated_dumbbell_press', 'lying_leg_curl', 'standing_calf_raise']);
    expect(fs.existsSync(file(userDatabaseName(DAN)))).toBe(true);
    expect(fs.existsSync(file(LEGACY_CLAIMED_DATABASE_NAME))).toBe(true);
    expect(count(userDatabaseName(DAN), 'sessions')).toBe(2);
    expect(state.history[0].exercises[0].sets.map((set) => [set.weightKg, set.reps])).toEqual([
      [120, 10],
      [130, 8],
    ]);
    await closeDatabase();
  });
});

describe('device backup policy (owner decision: keep workout data in iCloud / computer backups)', () => {
  const root = path.join(__dirname, '..');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (['node_modules', 'ios', 'android', '.git', '.10x', 'server', 'release-artifacts', '__tests__', 'dist', '.expo'].includes(entry.name)) return [];
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : /\.(tsx?|swift|m|mm|js|json)$/.test(entry.name) ? [full] : [];
    });

  it('no code, native module, plugin or config excludes files from backup', () => {
    const offenders = walk(root).filter((f) => /isExcludedFromBackup|NSURLIsExcludedFromBackupKey|excludedFromBackup|excludeFromBackup/i.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it('keeps iOS data protection on the database folder and photos', () => {
    const boot = fs.readFileSync(path.join(root, 'data/db/boot.ts'), 'utf8');
    expect(boot).toMatch(/protectDirectory\(directory, 'completeUnlessOpen'\)/);
    const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    expect(app.expo.ios.entitlements['com.apple.developer.default-data-protection']).toBe('NSFileProtectionCompleteUnlessOpen');
  });
});

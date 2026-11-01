import { createNodeDriver } from '@/data/db/driver.node';
import type { Driver } from '@/data/db/driver';
import { MIGRATIONS, SCHEMA_VERSION, getUserVersion, migrate } from '@/data/db/migrations';
import { ProgressRepository } from '@/data/db/progressRepository';
import { ensureProgressSchema } from '@/data/db/progressSchema';
import { WorkoutRepository } from '@/data/db/repository';
import { SCHEMA_V7 } from '@/data/db/schema';
import { replayHistory } from '@/domain/history/recompute';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER } from '@/store/useWorkoutStore';
import { done, exercise, local, session } from '@/test/fixtures/sessions';

/**
 * Phase 3 / Phase 4 schema-merge safety (ADR-010, integration handoff).
 * Both branches were cut from schema v6 and may each define a step 7. These
 * tests prove that every development database (v6, Phase 3 at v7, Phase 4 at
 * v7) reaches the merged schema with its workout history intact, without a
 * reset. `PHASE3_V7` stands in for Phase 3's real step; the merged sequence is
 * the one the handoff prescribes.
 */

const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };

/** Placeholder for Phase 3's step 7 (assumed create-only; see handoff if it ALTERs). */
const PHASE3_V7 = `
CREATE TABLE IF NOT EXISTS pr_cache (
  exercise_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value REAL NOT NULL,
  session_id TEXT NOT NULL,
  set_id TEXT NOT NULL,
  PRIMARY KEY (exercise_id, kind)
);
`;

interface Step {
  version: number;
  up: (driver: Driver) => void;
}

const UP_TO_V6: Step[] = MIGRATIONS.filter((m) => m.version <= 6);
const PHASE4_BRANCH: Step[] = [...UP_TO_V6, { version: 7, up: (d) => d.exec(SCHEMA_V7) }];
const PHASE3_BRANCH: Step[] = [...UP_TO_V6, { version: 7, up: (d) => d.exec(PHASE3_V7) }];
/** Prescribed merge: Phase 3 keeps 7, Phase 4 becomes 8, step 9 re-runs both create-only steps for databases from either branch. */
const MERGED: Step[] = [
  ...UP_TO_V6,
  { version: 7, up: (d) => d.exec(PHASE3_V7) },
  { version: 8, up: (d) => d.exec(SCHEMA_V7) },
  {
    version: 9,
    up: (d) => {
      d.exec(PHASE3_V7);
      d.exec(SCHEMA_V7);
    },
  },
];

/** Same contract as `migrate`: one transaction per step together with its version bump. */
function applySteps(driver: Driver, steps: Step[]): number[] {
  const from = getUserVersion(driver);
  const applied: number[] = [];
  driver.exec('PRAGMA foreign_keys = OFF');
  for (const step of steps.filter((s) => s.version > from)) {
    driver.transaction(() => {
      step.up(driver);
      driver.exec(`PRAGMA user_version = ${step.version}`);
    });
    applied.push(step.version);
  }
  driver.exec('PRAGMA foreign_keys = ON');
  return applied;
}

const tables = (driver: Driver) => new Set(driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name));

/** A database built by one branch, holding real history plus (for Phase 4) a body entry and a goal. */
function devDatabase(steps: Step[]) {
  const driver = createNodeDriver();
  applySteps(driver, steps);
  const workouts = new WorkoutRepository(driver);
  const history = replayHistory(
    [session(local(2026, 10, 1), [exercise('bench', [done(60, 10)])]), session(local(2026, 10, 8), [exercise('bench', [done(70, 8)])])],
    0,
  );
  driver.transaction(() => history.forEach((s) => workouts.upsertSession(s)));
  if (tables(driver).has('body_metrics')) {
    const progress = new ProgressRepository(driver);
    progress.persistDiff(
      { bodyEntries: [], goals: [] },
      {
        bodyEntries: [{ id: 'b1', kind: 'bodyweight', value: 80, measuredAt: '2026-10-01T08:00:00.000Z', note: '', createdAt: 'x', updatedAt: 'x' }],
        goals: [
          {
            id: 'g1',
            kind: 'weekly_sessions',
            exerciseId: null,
            bodyMetric: null,
            targetValue: 3,
            baselineValue: null,
            deadline: null,
            achievedAt: null,
            archived: false,
            createdAt: 'x',
            updatedAt: 'x',
          },
        ],
      },
    );
  }
  return { driver, history };
}

function expectHistoryIntact(driver: Driver, history: ReturnType<typeof replayHistory>) {
  const loaded = new WorkoutRepository(driver).loadAll(defaults).history;
  expect(loaded.map((s) => s.id)).toEqual(history.map((s) => s.id));
  expect(loaded.map((s) => s.summary)).toEqual(history.map((s) => s.summary));
  expect(loaded.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((set) => [set.weightKg, set.reps])))).toEqual(
    history.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((set) => [set.weightKg, set.reps]))),
  );
}

describe('merged migration sequence', () => {
  it.each([
    ['schema v6 (main today)', UP_TO_V6],
    ['Phase 3 branch at v7', PHASE3_BRANCH],
    ['Phase 4 branch at v7', PHASE4_BRANCH],
  ])('upgrades a %s database to the merged schema without losing history', (_label, branch) => {
    const { driver, history } = devDatabase(branch);
    const hadProgress = tables(driver).has('goals');
    applySteps(driver, MERGED);
    expect(getUserVersion(driver)).toBe(9);
    for (const table of ['pr_cache', 'body_metrics', 'goals', 'sessions', 'sets']) expect(tables(driver).has(table)).toBe(true);
    expectHistoryIntact(driver, history);
    if (hadProgress) expect(new ProgressRepository(driver).loadAll().goals.map((g) => g.id)).toEqual(['g1']);
  });

  it('shows why renumbering alone is not enough: a Phase 4 v7 database would skip Phase 3’s step', () => {
    const { driver } = devDatabase(PHASE4_BRANCH);
    const renumberedOnly: Step[] = MERGED.slice(0, -1); // 7 = Phase 3, 8 = Phase 4, no reconcile step
    applySteps(driver, renumberedOnly);
    expect(getUserVersion(driver)).toBe(8);
    expect(tables(driver).has('pr_cache')).toBe(false); // the gap the reconcile step closes
  });
});

describe('Phase 4 boot repair on this branch', () => {
  it('adds the Phase 4 tables to a Phase 3 database that already reports v7, keeping its rows', () => {
    const { driver, history } = devDatabase(PHASE3_BRANCH);
    expect(migrate(driver).applied).toEqual([]); // v7 already, nothing to run
    expect(tables(driver).has('body_metrics')).toBe(false);
    expect(ensureProgressSchema(driver)).toEqual(['body_metrics', 'goals']);
    expect(ensureProgressSchema(driver)).toEqual([]);
    expect(new ProgressRepository(driver).loadAll()).toEqual({ bodyEntries: [], goals: [] });
    expect(tables(driver).has('pr_cache')).toBe(true);
    expectHistoryIntact(driver, history);
  });

  it('is a no-op on this branch’s own databases', () => {
    const driver = createNodeDriver();
    migrate(driver);
    expect(getUserVersion(driver)).toBe(SCHEMA_VERSION);
    expect(ensureProgressSchema(driver)).toEqual([]);
  });
});

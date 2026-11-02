import { createNodeDriver } from '@/data/db/driver.node';
import type { Driver } from '@/data/db/driver';
import { MIGRATIONS, SCHEMA_VERSION, getUserVersion, migrate, reconcileSchema, verifySchema, type MigrationStep } from '@/data/db/migrations';
import { ProgressRepository } from '@/data/db/progressRepository';
import { WorkoutRepository } from '@/data/db/repository';
import { SCHEMA_V7, SCHEMA_V8 } from '@/data/db/schema';
import { recordsStrengthMetrics } from '@/domain/analytics/metrics';
import { replayHistory } from '@/domain/history/recompute';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';
import { done, exercise, local, session } from '@/test/fixtures/sessions';

/**
 * Phase 3 + Phase 4 schema integration (ADR-012). Both branches shipped a
 * "step 7": Phase 3 added `session_exercises.recommendation_json`, Phase 4
 * added `body_metrics` and `goals`. The canonical sequence is 7 = Phase 3,
 * 8 = Phase 4, 9 = reconcile, and `migrate()` re-checks the real schema on
 * every launch. These tests build each real-world starting state and prove
 * it reaches the combined schema with every row intact, without a reset.
 */

const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };
const UP_TO_V6 = MIGRATIONS.filter((m) => m.version <= 6);

/** Applies raw steps the way each branch's build did: one transaction per step with its version bump. */
function applyRaw(driver: Driver, steps: readonly MigrationStep[]): void {
  driver.exec('PRAGMA foreign_keys = OFF');
  for (const step of steps) {
    driver.transaction(() => {
      step.up(driver);
      driver.exec(`PRAGMA user_version = ${step.version}`);
    });
  }
  driver.exec('PRAGMA foreign_keys = ON');
}

const tables = (driver: Driver) => new Set(driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name));
const columns = (driver: Driver, table: string) => driver.all<{ name: string }>('SELECT name FROM pragma_table_info(?)', [table]).map((r) => r.name);

type Origin = 'v6' | 'phase3' | 'phase4';

const BRANCH_STEPS: Record<Origin, readonly MigrationStep[]> = {
  v6: UP_TO_V6,
  phase3: [...UP_TO_V6, { version: 7, up: (d) => d.exec(SCHEMA_V7) }],
  phase4: [...UP_TO_V6, { version: 7, up: (d) => d.exec(SCHEMA_V8) }],
};

/** A realistic history: eleven weeks of two exercises with records appearing over time. */
function realisticHistory(): WorkoutSession[] {
  const chronological: WorkoutSession[] = [];
  for (let week = 0; week < 11; week++) {
    const bench = 60 + week * 2.5;
    const squat = 80 + week * 5;
    chronological.push(
      session(local(2026, 8, 3 + week * 7), [
        exercise('bench', [done(bench, 10), done(bench, 9), done(bench, 8)]),
        exercise('squat', [done(squat, 8), done(squat, 8), done(squat, 6)]),
      ]),
    );
  }
  // One session with an exercise done for 15 reps (above the e1RM cap) and a warm-up.
  chronological.push(session(local(2026, 10, 20), [exercise('bench', [done(40, 10, { type: 'warmup' }), done(50, 15)])]));
  return replayHistory(chronological, 0, recordsStrengthMetrics);
}

/** What a Phase 2 / Phase 4 build stored for a session: today's rows minus `recommendation_json`. */
function legacyUpsertSession(d: Driver, s: WorkoutSession): void {
  d.run(
    `INSERT INTO sessions (id, schema_version, kind, plan_id, plan_day_id, title_json, code, focus, status, started_at, finished_at,
       ended_at_override, paused_intervals_json, deferred_ids_json, current_exercise_index, warmup_completed_json, notes, summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id,
      s.schemaVersion,
      s.kind,
      s.planId,
      s.planDayId,
      JSON.stringify(s.title),
      s.code,
      s.focus,
      s.status,
      s.startedAt,
      s.finishedAt,
      s.endedAtOverride,
      JSON.stringify(s.pausedIntervals),
      JSON.stringify(s.deferredIds),
      s.currentExerciseIndex,
      JSON.stringify(s.warmupCompletedIds),
      s.notes,
      s.summary ? JSON.stringify(s.summary) : null,
      '2026-10-20T10:00:00.000Z',
    ],
  );
  s.exercises.forEach((e, position) => {
    d.run('INSERT INTO session_exercises (id, session_id, position, exercise_id, prescription_json, skipped, notes, group_id, group_kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      e.id,
      s.id,
      position,
      e.exerciseId,
      JSON.stringify(e.prescription),
      e.skipped,
      e.notes,
      e.groupId,
      e.groupKind,
    ]);
    for (const set of e.sets) {
      d.run(
        'INSERT INTO sets (id, session_exercise_id, set_number, type, target_min, target_max, weight_kg, reps, completed, completed_at, set_kind, rpe, rir) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [set.id, e.id, set.setNumber, set.type, set.targetReps.min, set.targetReps.max, set.weightKg, set.reps, set.completed, set.completedAt, set.kind, set.rpe, set.rir],
      );
    }
  });
}

interface Seeded {
  driver: Driver;
  history: WorkoutSession[];
  decisionSessionId: string | null;
  hadProgress: boolean;
}

/** A database as a build from `origin` would have left it, with that build's data in it. */
function databaseFrom(origin: Origin): Seeded {
  const driver = createNodeDriver();
  applyRaw(driver, BRANCH_STEPS[origin]);
  const workouts = new WorkoutRepository(driver);
  let history = realisticHistory();
  let decisionSessionId: string | null = null;
  if (origin === 'phase3') {
    // Phase 3 stored a progression decision on the newest session's first exercise.
    const [newest, ...rest] = history;
    const decided = { ...newest, exercises: newest.exercises.map((e, i) => (i === 0 ? { ...e, recommendation: { weightKg: 62.5, repsMin: 8, repsMax: 12, decision: 'accepted' as const, decidedAt: '2026-10-20T10:00:00.000Z' } } : e)) };
    history = [decided, ...rest];
    decisionSessionId = decided.id;
  }
  // The Phase 3 build wrote through today's repository; the others never had the decision column.
  driver.transaction(() => history.forEach((s) => (origin === 'phase3' ? workouts.upsertSession(s) : legacyUpsertSession(driver, s))));
  const hadProgress = origin === 'phase4';
  if (hadProgress) {
    new ProgressRepository(driver).persistDiff(
      { bodyEntries: [], goals: [] },
      {
        bodyEntries: [{ id: 'b1', kind: 'bodyweight', value: 80, measuredAt: '2026-10-01T08:00:00.000Z', note: 'morning', createdAt: 'x', updatedAt: 'x' }],
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
  return { driver, history, decisionSessionId, hadProgress };
}

function expectCombinedSchema(driver: Driver): void {
  expect(getUserVersion(driver)).toBe(SCHEMA_VERSION);
  expect(() => verifySchema(driver)).not.toThrow();
  for (const table of ['sessions', 'session_exercises', 'sets', 'plans', 'exercises', 'body_metrics', 'goals']) expect(tables(driver).has(table)).toBe(true);
  expect(columns(driver, 'session_exercises')).toEqual(expect.arrayContaining(['group_id', 'group_kind', 'recommendation_json']));
  expect(columns(driver, 'sets')).toEqual(expect.arrayContaining(['set_kind', 'rpe', 'rir']));
}

function expectDataIntact(seeded: Seeded): void {
  const { driver, history, decisionSessionId, hadProgress } = seeded;
  const loaded = new WorkoutRepository(driver).loadAll(defaults).history;
  expect(loaded.map((s) => s.id)).toEqual(history.map((s) => s.id));
  expect(loaded.map((s) => s.summary)).toEqual(history.map((s) => s.summary));
  expect(loaded.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((set) => [set.type, set.weightKg, set.reps, set.completed])))).toEqual(
    history.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((set) => [set.type, set.weightKg, set.reps, set.completed]))),
  );
  // Every record the summaries claim is still backed by a stored set.
  const setIds = new Set(loaded.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((set) => set.id))));
  for (const record of loaded.flatMap((s) => s.summary?.personalRecords ?? [])) expect(setIds.has(record.setId)).toBe(true);
  if (decisionSessionId) {
    expect(loaded.find((s) => s.id === decisionSessionId)?.exercises[0].recommendation).toEqual({ weightKg: 62.5, repsMin: 8, repsMax: 12, decision: 'accepted', decidedAt: '2026-10-20T10:00:00.000Z' });
  } else {
    expect(loaded.every((s) => s.exercises.every((e) => e.recommendation === null))).toBe(true);
  }
  const progress = new ProgressRepository(driver).loadAll();
  if (hadProgress) {
    expect(progress.bodyEntries.map((b) => [b.id, b.value, b.note])).toEqual([['b1', 80, 'morning']]);
    expect(progress.goals.map((g) => [g.id, g.kind, g.targetValue])).toEqual([['g1', 'weekly_sessions', 3]]);
  } else {
    expect(progress).toEqual({ bodyEntries: [], goals: [] });
  }
}

describe('combined schema: fresh install', () => {
  it('creates every Phase 3 and Phase 4 object in one pass and is idempotent on relaunch', () => {
    const driver = createNodeDriver();
    const backup = jest.fn();
    expect(migrate(driver, { backup })).toEqual({ from: 0, to: SCHEMA_VERSION, applied: MIGRATIONS.map((m) => m.version) });
    expect(backup).not.toHaveBeenCalled();
    expectCombinedSchema(driver);
    for (let launch = 0; launch < 3; launch++) expect(migrate(driver)).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });
  });
});

describe('combined schema: upgrades from each real starting point', () => {
  it.each<[string, Origin, number[]]>([
    ['Phase 2 (v6)', 'v6', [7, 8, 9, 10]],
    ['Phase 3 build (v7 = recommendation_json)', 'phase3', [8, 9, 10]],
    ['Phase 4 build (v7 = body_metrics + goals)', 'phase4', [8, 9, 10]],
  ])('%s → combined, keeping workouts, decisions, body entries and goals', (_label, origin, expectedSteps) => {
    const seeded = databaseFrom(origin);
    const backup = jest.fn();
    const onRepair = jest.fn();
    const result = migrate(seeded.driver, { backup, onRepair });
    expect(result).toEqual({ from: origin === 'v6' ? 6 : 7, to: SCHEMA_VERSION, applied: expectedSteps });
    expect(backup).toHaveBeenCalledWith(origin === 'v6' ? 6 : 7);
    expect(onRepair).not.toHaveBeenCalled(); // the numbered steps already closed every gap
    expectCombinedSchema(seeded.driver);
    expectDataIntact(seeded);
  });

  it('a Phase 4 database gets the Phase 3 column from step 9, not from step 7 (which it never runs)', () => {
    const seeded = databaseFrom('phase4');
    expect(columns(seeded.driver, 'session_exercises')).not.toContain('recommendation_json');
    migrate(seeded.driver);
    expect(columns(seeded.driver, 'session_exercises')).toContain('recommendation_json');
    expect(seeded.driver.get('SELECT COUNT(*) AS n FROM session_exercises WHERE recommendation_json IS NOT NULL')).toEqual({ n: 0 });
  });

  it('a Phase 3 database already has the column, so step 7 and the reconcile never ALTER twice', () => {
    const seeded = databaseFrom('phase3');
    expect(() => migrate(seeded.driver)).not.toThrow();
    expect(columns(seeded.driver, 'session_exercises').filter((c) => c === 'recommendation_json')).toHaveLength(1);
  });
});

describe('combined schema: repeated launches and mixed states', () => {
  it('relaunching after the upgrade runs no steps and changes nothing', () => {
    const seeded = databaseFrom('v6');
    migrate(seeded.driver);
    const before = seeded.driver.all('SELECT * FROM sets ORDER BY id');
    for (let launch = 0; launch < 3; launch++) {
      const backup = jest.fn();
      expect(migrate(seeded.driver, { backup })).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });
      expect(backup).not.toHaveBeenCalled();
    }
    expect(seeded.driver.all('SELECT * FROM sets ORDER BY id')).toEqual(before);
    expectDataIntact(seeded);
  });

  it('repairs a database whose version number promises more than the file contains', () => {
    const seeded = databaseFrom('phase3');
    seeded.driver.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`); // claims the combined schema, has only Phase 3's half
    const onRepair = jest.fn();
    expect(migrate(seeded.driver, { onRepair })).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });
    expect(onRepair).toHaveBeenCalledWith(['body_metrics', 'goals', 'health_exports']);
    expectCombinedSchema(seeded.driver);
    expectDataIntact(seeded);

    const other = databaseFrom('phase4');
    other.driver.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    const repairs = jest.fn();
    migrate(other.driver, { onRepair: repairs });
    expect(repairs).toHaveBeenCalledWith(['session_exercises.recommendation_json', 'health_exports']);
    expectCombinedSchema(other.driver);
    expectDataIntact(other);
  });

  it('reconcileSchema is additive and idempotent', () => {
    const driver = createNodeDriver();
    migrate(driver);
    driver.exec('DROP TABLE goals');
    expect(driver.transaction(() => reconcileSchema(driver))).toEqual(['goals']);
    expect(driver.transaction(() => reconcileSchema(driver))).toEqual([]);
    expect(() => verifySchema(driver)).not.toThrow();
  });
});

describe('combined schema: failure and recovery', () => {
  it('a step that throws leaves the previous version and every row intact; the next launch retries cleanly', () => {
    const seeded = databaseFrom('phase4');
    const rowsBefore = {
      sets: seeded.driver.all('SELECT * FROM sets ORDER BY id'),
      goals: seeded.driver.all('SELECT * FROM goals'),
      body: seeded.driver.all('SELECT * FROM body_metrics'),
    };
    const broken: MigrationStep[] = [
      ...MIGRATIONS.filter((m) => m.version <= 8),
      { version: 9, up: (d) => d.exec('CREATE TABLE half (x); SELECT nope FROM missing;') },
    ];
    const backup = jest.fn();
    expect(() => migrate(seeded.driver, { steps: broken, backup })).toThrow();
    expect(backup).toHaveBeenCalledWith(7);
    expect(getUserVersion(seeded.driver)).toBe(8); // step 8 committed, step 9 rolled back
    expect(tables(seeded.driver).has('half')).toBe(false);
    expect(seeded.driver.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    expect(seeded.driver.all('SELECT * FROM sets ORDER BY id')).toEqual(rowsBefore.sets);
    expect(seeded.driver.all('SELECT * FROM goals')).toEqual(rowsBefore.goals);
    expect(seeded.driver.all('SELECT * FROM body_metrics')).toEqual(rowsBefore.body);

    // The fixed build picks up where the failed one stopped.
    expect(migrate(seeded.driver)).toEqual({ from: 8, to: SCHEMA_VERSION, applied: [9, 10] });
    expectCombinedSchema(seeded.driver);
    expectDataIntact(seeded);
  });

  it('verifySchema reports a missing Phase 3 column and a missing Phase 4 table by name', () => {
    const driver = createNodeDriver();
    migrate(driver);
    driver.exec('DROP TABLE body_metrics');
    expect(() => verifySchema(driver)).toThrow(/missing table "body_metrics"/);
    const other = createNodeDriver();
    migrate(other);
    other.exec('ALTER TABLE session_exercises DROP COLUMN recommendation_json');
    expect(() => verifySchema(other)).toThrow(/missing column "session_exercises.recommendation_json"/);
  });
});

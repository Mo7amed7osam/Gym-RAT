import { createNodeDriver } from '@/data/db/driver.node';
import { SCHEMA_VERSION, migrate, verifySchema } from '@/data/db/migrations';
import { EMPTY_PROGRESS, ProgressRepository } from '@/data/db/progressRepository';
import { changeOver, entriesOf, isValidBodyValue, latestEntry, movingAverage } from '@/domain/analytics/body';
import { evaluateGoal, newlyAchievedGoalIds, validateGoalInput, type GoalContext } from '@/domain/analytics/goals';
import { attachProgressPersistence, useProgressStore } from '@/store/useProgressStore';
import type { BodyEntry, Goal } from '@/types/progress';
import { done, exercise, local, session } from '@/test/fixtures/sessions';

const NOW = local(2026, 11, 2, 12);

function entry(kind: BodyEntry['kind'], value: number, at: Date, id = `${kind}-${at.getTime()}`): BodyEntry {
  return { id, kind, value, measuredAt: at.toISOString(), note: '', createdAt: at.toISOString(), updatedAt: at.toISOString() };
}

function goal(partial: Partial<Goal>): Goal {
  return {
    id: 'g',
    kind: 'exercise_e1rm',
    exerciseId: null,
    bodyMetric: null,
    targetValue: 100,
    baselineValue: null,
    deadline: null,
    achievedAt: null,
    archived: false,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...partial,
  };
}

describe('body tracking', () => {
  const entries = [
    entry('bodyweight', 82, local(2026, 9, 1)),
    entry('bodyweight', 80.4, local(2026, 10, 1)),
    entry('waist', 90, local(2026, 10, 3)),
    entry('bodyweight', 79.1, local(2026, 11, 1)),
  ];

  it('filters, sorts and finds the latest entry per kind', () => {
    expect(entriesOf([...entries].reverse(), 'bodyweight').map((e) => e.value)).toEqual([82, 80.4, 79.1]);
    expect(latestEntry(entries, 'waist')?.value).toBe(90);
    expect(latestEntry(entries, 'neck')).toBeNull();
  });

  it('measures change against the last entry before the window', () => {
    expect(changeOver(entries, 'bodyweight', 30, NOW)).toMatchObject({ diff: -1.3 });
    // Window longer than tracking: compare with the first entry.
    expect(changeOver(entries, 'bodyweight', 365, NOW)?.diff).toBe(-2.9);
    expect(changeOver(entries, 'waist', 30, NOW)).toBeNull();
  });

  it('smooths with a trailing moving average', () => {
    expect(movingAverage([1, 2, 3, 4, 5], 3)).toEqual([1, 1.5, 2, 3, 4]);
    expect(movingAverage([], 7)).toEqual([]);
  });

  it('rejects implausible values per unit', () => {
    expect(isValidBodyValue('bodyweight', 80)).toBe(true);
    expect(isValidBodyValue('bodyweight', 800)).toBe(false);
    expect(isValidBodyValue('body_fat', 90)).toBe(false);
    expect(isValidBodyValue('waist', Number.NaN)).toBe(false);
  });
});

describe('goals', () => {
  const history = [
    session(local(2026, 10, 20), [exercise('bench', [done(80, 5)])]),
    session(local(2026, 11, 2, 9), [exercise('bench', [done(90, 3)]), exercise('squat', [done(100, 5)])]),
  ];
  const context: GoalContext = {
    history,
    bodyEntries: [entry('bodyweight', 84, local(2026, 10, 1)), entry('bodyweight', 82, local(2026, 11, 1))],
    now: NOW,
    weekStart: 'monday',
  };

  it('tracks strength goals from the progression (baseline 0 when unset)', () => {
    const topWeight = evaluateGoal(goal({ kind: 'exercise_weight', exerciseId: 'bench', targetValue: 100, baselineValue: 80 }), context);
    expect(topWeight).toMatchObject({ current: 90, progress: 0.5, achieved: false, remaining: 10, direction: 'increase' });
    const e1rm = evaluateGoal(goal({ kind: 'exercise_e1rm', exerciseId: 'bench', targetValue: 90 }), context);
    expect(e1rm.achieved).toBe(true);
    expect(e1rm.progress).toBe(1);
    expect(evaluateGoal(goal({ kind: 'exercise_e1rm', exerciseId: 'deadlift' }), context)).toMatchObject({ current: null, progress: 0, remaining: null });
  });

  it('supports decreasing body goals (a cut) and overdue deadlines', () => {
    const cut = evaluateGoal(goal({ kind: 'bodyweight', targetValue: 80, baselineValue: 84, deadline: local(2026, 11, 1).toISOString() }), context);
    expect(cut).toMatchObject({ direction: 'decrease', current: 82, progress: 0.5, remaining: 2, achieved: false, overdue: true });
  });

  it('evaluates weekly goals on the current week and never latches them', () => {
    const weekly = goal({ kind: 'weekly_sessions', targetValue: 3, achievedAt: local(2026, 10, 1).toISOString() });
    expect(evaluateGoal(weekly, context)).toMatchObject({ current: 1, achieved: false, progress: 1 / 3 });
    expect(evaluateGoal(goal({ kind: 'weekly_volume', targetValue: 500 }), context)).toMatchObject({ current: 770, achieved: true });
    expect(newlyAchievedGoalIds([evaluateGoal(goal({ kind: 'weekly_volume', targetValue: 500 }), context)])).toEqual([]);
  });

  it('keeps an achieved goal achieved after the value slips, and reports only unstamped ones', () => {
    const latched = evaluateGoal(goal({ kind: 'bodyweight', targetValue: 81, baselineValue: 84, achievedAt: local(2026, 10, 15).toISOString() }), context);
    expect(latched).toMatchObject({ achieved: true, progress: 1 });
    const fresh = evaluateGoal(goal({ id: 'new', kind: 'exercise_weight', exerciseId: 'squat', targetValue: 100, baselineValue: 90 }), context);
    expect(newlyAchievedGoalIds([latched, fresh])).toEqual(['new']);
  });

  it('validates new goals', () => {
    expect(validateGoalInput({ kind: 'exercise_e1rm', exerciseId: null, bodyMetric: null }, 100, null)).toEqual(['exercise']);
    expect(validateGoalInput({ kind: 'body_measurement', exerciseId: null, bodyMetric: null }, 0, null)).toEqual(['target', 'body_metric']);
    expect(validateGoalInput({ kind: 'bodyweight', exerciseId: null, bodyMetric: null }, 82, 82)).toEqual(['same_as_current']);
    expect(validateGoalInput({ kind: 'weekly_sessions', exerciseId: null, bodyMetric: null }, 4, 0)).toEqual([]);
  });
});

describe('progress persistence (schema v7)', () => {
  function fresh() {
    const driver = createNodeDriver();
    migrate(driver);
    const repo = new ProgressRepository(driver);
    attachProgressPersistence(null);
    useProgressStore.getState().hydrate(EMPTY_PROGRESS);
    attachProgressPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });
    return { driver, repo };
  }

  afterEach(() => attachProgressPersistence(null));

  it('creates the Phase 4 tables in the current schema version', () => {
    const { driver } = fresh();
    expect(() => verifySchema(driver)).not.toThrow();
    const tables = driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['body_metrics', 'goals']));
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(7);
  });

  it('upgrades a v6 database without touching workout rows', () => {
    const driver = createNodeDriver();
    migrate(driver);
    driver.exec('DROP TABLE body_metrics; DROP TABLE goals; PRAGMA user_version = 6');
    driver.run("INSERT INTO kv (key, value) VALUES ('probe', '1')");
    const result = migrate(driver);
    expect(result.from).toBe(6);
    expect(result.applied).toContain(7);
    expect(driver.get<{ value: string }>("SELECT value FROM kv WHERE key = 'probe'")?.value).toBe('1');
    // Re-running the step is harmless (renumbering at merge time stays safe).
    expect(() => driver.exec('CREATE TABLE IF NOT EXISTS body_metrics (id TEXT)')).not.toThrow();
  });

  it('writes body entries and goals through, sorted, and reloads them', () => {
    const { repo } = fresh();
    const store = useProgressStore.getState();
    const later = store.addBodyEntry({ kind: 'bodyweight', value: 80.04, measuredAt: local(2026, 11, 1).toISOString(), note: '  am ' });
    const earlier = useProgressStore.getState().addBodyEntry({ kind: 'bodyweight', value: 81, measuredAt: local(2026, 10, 1).toISOString() });
    expect(later).toMatchObject({ value: 80, note: 'am' });
    expect(useProgressStore.getState().bodyEntries.map((e) => e.id)).toEqual([earlier!.id, later!.id]);
    expect(useProgressStore.getState().addBodyEntry({ kind: 'bodyweight', value: 5, measuredAt: NOW.toISOString() })).toBeNull();

    const created = useProgressStore.getState().createGoal({ kind: 'exercise_e1rm', exerciseId: 'bench', targetValue: 120, baselineValue: 100 });
    useProgressStore.getState().markGoalsAchieved([created!.id], NOW.toISOString());
    useProgressStore.getState().markGoalsAchieved([created!.id], local(2026, 12, 1).toISOString());

    const loaded = repo.loadAll();
    expect(loaded.bodyEntries.map((e) => e.value)).toEqual([81, 80]);
    expect(loaded.goals).toHaveLength(1);
    expect(loaded.goals[0]).toMatchObject({ kind: 'exercise_e1rm', exerciseId: 'bench', achievedAt: NOW.toISOString(), archived: false });

    useProgressStore.getState().updateGoal(created!.id, { targetValue: 130 });
    expect(repo.loadAll().goals[0]).toMatchObject({ targetValue: 130, achievedAt: null });
    useProgressStore.getState().setGoalArchived(created!.id, true);
    expect(repo.loadAll().goals[0].archived).toBe(true);

    expect(useProgressStore.getState().updateBodyEntry(earlier!.id, { value: 82.5 })).toBe(true);
    expect(useProgressStore.getState().updateBodyEntry(earlier!.id, { value: -1 })).toBe(false);
    useProgressStore.getState().deleteBodyEntry(later!.id);
    useProgressStore.getState().deleteGoal(created!.id);
    expect(repo.loadAll()).toEqual({ bodyEntries: [expect.objectContaining({ value: 82.5 })], goals: [] });
  });

  it('leaves state untouched when the write fails', () => {
    fresh();
    attachProgressPersistence({
      persist: () => {
        throw new Error('disk full');
      },
    });
    expect(useProgressStore.getState().addBodyEntry({ kind: 'waist', value: 90, measuredAt: NOW.toISOString() })).toBeNull();
    expect(useProgressStore.getState().createGoal({ kind: 'weekly_sessions', targetValue: 3, baselineValue: null })).toBeNull();
    expect(useProgressStore.getState().bodyEntries).toEqual([]);
    expect(useProgressStore.getState().persistenceError).toBe('disk full');
  });

  it('rejects non-positive values at the database level too', () => {
    const { driver } = fresh();
    expect(() =>
      driver.run("INSERT INTO body_metrics (id, kind, value, measured_at, created_at, updated_at) VALUES ('x', 'waist', 0, 'a', 'a', 'a')"),
    ).toThrow();
  });
});

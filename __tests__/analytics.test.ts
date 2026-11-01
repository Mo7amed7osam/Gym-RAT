import { compareTotals, delta, sessionStats, totalsFor } from '@/domain/analytics/aggregate';
import { monthGrid, sessionsByDay, weeklyStreak } from '@/domain/analytics/calendar';
import { addDays, comparisonRanges, dayKey, periodRange } from '@/domain/analytics/dates';
import { recordsStrengthMetrics, getStrengthMetrics, registerStrengthMetrics, type StrengthMetrics } from '@/domain/analytics/metrics';
import { muscleSetDistribution } from '@/domain/analytics/muscles';
import { exerciseProgression, metricValue, trainedExercises } from '@/domain/analytics/progression';
import { trendOf, weeklySeries } from '@/domain/analytics/trends';
import { done, exercise, local, newestFirst, session, set } from '@/test/fixtures/sessions';

// Monday 2 November 2026, 12:00 local.
const NOW = local(2026, 11, 2, 12);

describe('periods', () => {
  it('builds the current week, month, 13-week quarter and year in local time', () => {
    const week = periodRange('week', NOW, 'monday');
    expect(new Date(week.start)).toEqual(local(2026, 11, 2, 0));
    expect(new Date(week.end)).toEqual(local(2026, 11, 9, 0));

    const saturdayWeek = periodRange('week', NOW, 'saturday');
    expect(new Date(saturdayWeek.start)).toEqual(local(2026, 10, 31, 0));

    const month = periodRange('month', NOW, 'monday');
    expect(new Date(month.start)).toEqual(local(2026, 11, 1, 0));
    expect(new Date(month.end)).toEqual(local(2026, 12, 1, 0));

    const quarter = periodRange('quarter', NOW, 'monday');
    expect(new Date(quarter.end)).toEqual(local(2026, 11, 9, 0));
    expect(new Date(quarter.start)).toEqual(addDays(local(2026, 11, 9, 0), -91));

    const year = periodRange('year', NOW, 'monday');
    expect(new Date(year.start)).toEqual(local(2026, 1, 1, 0));
    expect(new Date(year.end)).toEqual(local(2027, 1, 1, 0));
  });

  it('compares to date: day 2 of this month against the first two days of last month', () => {
    const { current, previous } = comparisonRanges('month', NOW, 'monday');
    expect(new Date(current.start)).toEqual(local(2026, 11, 1, 0));
    expect(current.end).toBe(NOW.getTime() + 1);
    expect(new Date(previous.start)).toEqual(local(2026, 10, 1, 0));
    expect(previous.end - previous.start).toBe(current.end - current.start);
  });

  it('never lets the previous span run into the current period (31 March vs February)', () => {
    const lateMarch = local(2026, 3, 31, 20);
    const { previous, current } = comparisonRanges('month', lateMarch, 'monday');
    expect(previous.end).toBeLessThanOrEqual(current.start);
  });

  it('keys days in local time', () => {
    expect(dayKey(local(2026, 1, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(local(2026, 1, 5, 0, 0))).toBe('2026-01-05');
  });
});

describe('totals and comparisons', () => {
  const history = newestFirst([
    // Last month, first two days: 1 session.
    session(local(2026, 10, 1), [exercise('bench', [done(60, 10), done(60, 8), done(20, 15, { type: 'warmup' })])]),
    // Last month, later: excluded from a to-date comparison.
    session(local(2026, 10, 20), [exercise('bench', [done(100, 5)])]),
    // This month: 2 sessions on the same day + a bodyweight set.
    session(local(2026, 11, 1, 9), [exercise('bench', [done(70, 10)]), exercise('pullup', [done(null, 12)])], { minutes: 45 }),
    session(local(2026, 11, 1, 19), [exercise('squat', [done(100, 5), set({ weightKg: 100, reps: 5 })])], {
      summary: { totalVolumeKg: 0, completedSets: 1, totalSets: 2, durationSeconds: 1800, activeSeconds: 1500, personalRecords: [] },
    }),
    // Cancelled sessions never count.
    session(local(2026, 11, 2, 8), [exercise('bench', [done(200, 10)])], { status: 'cancelled' }),
  ]);

  it('derives volume, sets and reps from raw sets, ignoring warm-ups and unfinished sets', () => {
    const stats = sessionStats(history.find((s) => s.startedAt === local(2026, 10, 1).toISOString())!);
    expect(stats).toEqual({ volumeKg: 60 * 10 + 60 * 8, workingSets: 2, reps: 18 });
  });

  it('counts bodyweight sets as working sets with zero volume', () => {
    const totals = totalsFor(history, periodRange('month', NOW, 'monday'));
    expect(totals.sessions).toBe(2);
    expect(totals.workingSets).toBe(3);
    expect(totals.reps).toBe(10 + 12 + 5);
    expect(totals.volumeKg).toBe(700 + 500);
    expect(totals.trainingDays).toBe(1);
    // Summary active time wins; otherwise derived from start/finish.
    expect(totals.activeSeconds).toBe(45 * 60 + 1500);
  });

  it('compares this month to date with the same span last month', () => {
    const comparison = compareTotals(history, comparisonRanges('month', NOW, 'monday'));
    expect(comparison.sessions).toEqual({ current: 2, previous: 1, diff: 1, percent: 100 });
    expect(comparison.volumeKg.previous).toBe(1080);
  });

  it('reports no percent without a baseline', () => {
    expect(delta(5, 0).percent).toBeNull();
    expect(delta(0, 4).percent).toBe(-100);
  });
});

describe('weekly series and trends', () => {
  const history = newestFirst([
    session(local(2026, 10, 12), [exercise('bench', [done(50, 10)])]),
    session(local(2026, 10, 19), [exercise('bench', [done(60, 10)])]),
    session(local(2026, 10, 21), [exercise('bench', [done(60, 10)])]),
    session(local(2026, 10, 26), [exercise('bench', [done(70, 10)])]),
    session(local(2026, 11, 2, 8), [exercise('bench', [done(80, 10)])]),
  ]);

  it('buckets sessions into weeks, oldest first, with empty weeks as zeros', () => {
    const series = weeklySeries(history, 5, NOW, 'monday');
    expect(series.map((p) => p.sessions)).toEqual([0, 1, 2, 1, 1]);
    expect(series.map((p) => p.volumeKg)).toEqual([0, 500, 1200, 700, 800]);
    expect(series[4].weekStart).toEqual(local(2026, 11, 2, 0));
    expect(series[0].activeMinutes).toBe(0);
    expect(series[2].activeMinutes).toBe(120);
  });

  it('classifies trend direction by slope relative to the mean', () => {
    expect(trendOf([1, 2, 3, 4]).direction).toBe('up');
    expect(trendOf([4, 3, 2, 1]).direction).toBe('down');
    expect(trendOf([10, 10.1, 9.9, 10]).direction).toBe('flat');
    expect(trendOf([0, 0, 0]).percentPerStep).toBeNull();
    expect(trendOf([5]).direction).toBe('flat');
  });
});

describe('muscle distribution', () => {
  const library = new Map([
    ['bench', { primaryMuscles: ['chest' as const], secondaryMuscles: ['triceps' as const, 'front_delts' as const] }],
    ['dip', { primaryMuscles: ['triceps' as const], secondaryMuscles: ['chest' as const] }],
  ]);

  it('counts primary muscles per set and secondary at half, unknown exercises as other', () => {
    const history = [
      session(local(2026, 11, 1), [
        exercise('bench', [done(60, 10), done(60, 10), done(20, 10, { type: 'warmup' })]),
        exercise('dip', [done(null, 10)]),
        exercise('mystery', [done(10, 10)]),
      ]),
    ];
    const shares = muscleSetDistribution(history, periodRange('month', NOW, 'monday'), library);
    expect(shares).toEqual([
      { muscle: 'chest', sets: 2.5 },
      { muscle: 'triceps', sets: 2 },
      { muscle: 'front_delts', sets: 1 },
      { muscle: 'other', sets: 1 },
    ]);
  });
});

describe('exercise progression', () => {
  const history = newestFirst([
    session(local(2026, 10, 1), [exercise('bench', [done(60, 10), done(70, 5)])]),
    session(local(2026, 10, 8), [exercise('bench', [done(80, 3)]), exercise('bench', [done(50, 12)])]),
    session(local(2026, 10, 15), [exercise('squat', [done(100, 5)])]),
    session(local(2026, 10, 22), [exercise('bench', [set({ weightKg: 999, reps: 1 })])]),
  ]);

  it('returns one point per session, oldest first, combining repeated entries', () => {
    const points = exerciseProgression(history, 'bench');
    expect(points).toHaveLength(2);
    expect(points[0].topWeightKg).toBe(70);
    // 70 × 5 → 81.7 beats 60 × 10 → 80.
    expect(points[0].bestE1rmKg).toBeCloseTo(70 * (1 + 5 / 30));
    expect(points[0].bestSet).toEqual({ weightKg: 70, reps: 5 });
    expect(points[1].volumeKg).toBe(240 + 600);
    expect(points[1].workingSets).toBe(2);
    expect(metricValue(points[1], 'topWeight')).toBe(80);
    expect(metricValue(points[1], 'reps')).toBe(15);
  });

  it('asks the registered strength engine for e1RM (Phase 3 boundary)', () => {
    const engine: StrengthMetrics = { ...recordsStrengthMetrics, estimateOneRepMax: (w, r) => w * r };
    registerStrengthMetrics(engine);
    try {
      expect(getStrengthMetrics()).toBe(engine);
      expect(exerciseProgression(history, 'bench')[0].bestE1rmKg).toBe(600);
    } finally {
      registerStrengthMetrics(null);
    }
    expect(getStrengthMetrics()).toBe(recordsStrengthMetrics);
  });

  it('lists trained exercises most recent first', () => {
    const list = trainedExercises(history);
    expect(list.map((item) => item.exerciseId)).toEqual(['squat', 'bench']);
    expect(list[1]).toMatchObject({ sessions: 2, topWeightKg: 80 });
  });
});

describe('calendar', () => {
  it('lays out a month aligned to the week start with sessions on their local day', () => {
    const history = [session(local(2026, 11, 1, 23, 30), [exercise('bench', [done(50, 10)])]), session(local(2026, 11, 30), [])];
    const grid = monthGrid(2026, 10, 'monday', sessionsByDay(history));
    expect(grid[0][0].date).toEqual(local(2026, 10, 26, 0));
    expect(grid[0][0].inMonth).toBe(false);
    expect(grid[0][6].key).toBe('2026-11-01');
    expect(grid[0][6].sessions).toHaveLength(1);
    expect(grid[0][6].volumeKg).toBe(500);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid[grid.length - 1].some((day) => day.key === '2026-11-30' && day.sessions.length === 1)).toBe(true);
  });

  it('counts the weekly streak, not broken by an empty current week', () => {
    const history = [
      session(local(2026, 10, 13), []),
      session(local(2026, 10, 20), []),
      session(local(2026, 10, 27), []),
    ];
    expect(weeklyStreak(history, NOW, 'monday')).toBe(3);
    expect(weeklyStreak([...history, session(local(2026, 11, 2, 8), [])], NOW, 'monday')).toBe(4);
    expect(weeklyStreak([session(local(2026, 10, 13), [])], NOW, 'monday')).toBe(0);
  });
});

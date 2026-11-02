import { createNodeDriver } from '@/data/db/driver.node';
import { migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { compareTotals, totalsFor } from '@/domain/analytics/aggregate';
import { changeOver, latestEntry } from '@/domain/analytics/body';
import { monthGrid, sessionsByDay, weeklyStreak } from '@/domain/analytics/calendar';
import { comparisonRanges, dayKey, periodRange } from '@/domain/analytics/dates';
import { evaluateGoal } from '@/domain/analytics/goals';
import { muscleSetDistribution } from '@/domain/analytics/muscles';
import { exerciseProgression, trainedExercises } from '@/domain/analytics/progression';
import { trendOf, weeklySeries } from '@/domain/analytics/trends';
import { patchHistorySet } from '@/domain/history/edit';
import { parseTimeInput } from '@/lib/analyticsFormat';
import { removeFromHistory, replayHistory } from '@/domain/history/recompute';
import { deleteHistorySession, saveHistorySession } from '@/store/historyActions';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';
import type { Goal } from '@/types/progress';
import type { WeekStart, WorkoutSession } from '@/types/workout';
import { done, exercise, local, newestFirst, session } from '@/test/fixtures/sessions';

/** Phase 4 QA: empty/sparse data, calendar boundaries, time zones, and active-session safety. */

const goal = (partial: Partial<Goal>): Goal => ({
  id: 'g',
  kind: 'weekly_sessions',
  exerciseId: null,
  bodyMetric: null,
  targetValue: 3,
  baselineValue: null,
  deadline: null,
  achievedAt: null,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...partial,
});

describe('zero history', () => {
  const now = local(2026, 11, 2, 12);
  const range = periodRange('month', now, 'saturday');

  it('returns zeros and empty lists everywhere instead of throwing', () => {
    expect(totalsFor([], range)).toEqual({ sessions: 0, volumeKg: 0, workingSets: 0, reps: 0, activeSeconds: 0, trainingDays: 0, personalRecords: 0 });
    const comparison = compareTotals([], comparisonRanges('week', now, 'saturday'));
    expect(comparison.volumeKg).toEqual({ current: 0, previous: 0, diff: 0, percent: null });
    expect(weeklySeries([], 12, now, 'saturday').every((p) => p.sessions === 0 && p.volumeKg === 0)).toBe(true);
    expect(trendOf(weeklySeries([], 12, now, 'saturday').map((p) => p.volumeKg)).direction).toBe('flat');
    expect(muscleSetDistribution([], range, new Map())).toEqual([]);
    expect(exerciseProgression([], 'bench')).toEqual([]);
    expect(trainedExercises([])).toEqual([]);
    expect(weeklyStreak([], now, 'saturday')).toBe(0);
    expect(monthGrid(2026, 10, 'saturday', sessionsByDay([])).flat().every((d) => d.sessions.length === 0)).toBe(true);
    expect(latestEntry([], 'bodyweight')).toBeNull();
    expect(changeOver([], 'bodyweight', 30, now)).toBeNull();
    expect(replayHistory([], 0)).toEqual([]);
    expect(removeFromHistory([], 'x')).toEqual([]);
    expect(evaluateGoal(goal({}), { history: [], bodyEntries: [], now, weekStart: 'saturday' })).toMatchObject({ current: 0, progress: 0, achieved: false });
  });
});

describe('sparse history', () => {
  it('handles one session a year ago, sessions with only warm-ups, and skipped exercises', () => {
    const now = local(2026, 11, 2, 12);
    const history = newestFirst([
      session(local(2025, 11, 1), [exercise('bench', [done(60, 10)])]),
      session(local(2026, 10, 30), [exercise('bench', [done(20, 10, { type: 'warmup' })])]),
      session(local(2026, 10, 31), [exercise('bench', [], { skipped: true })]),
    ]);
    const series = weeklySeries(history, 12, now, 'saturday');
    expect(series.reduce((n, p) => n + p.sessions, 0)).toBe(2);
    expect(series.reduce((n, p) => n + p.workingSets, 0)).toBe(0);
    expect(exerciseProgression(history, 'bench')).toHaveLength(1);
    // Single-point series: no trend, no change.
    expect(trendOf([exerciseProgression(history, 'bench')[0].bestE1rmKg]).direction).toBe('flat');
    expect(compareTotals(history, comparisonRanges('year', now, 'saturday')).sessions).toMatchObject({ current: 2, previous: 1 });
  });
});

describe('calendar boundaries', () => {
  it('compares 1 January with 1 January of the previous year', () => {
    const { current, previous } = comparisonRanges('year', local(2027, 1, 1, 9), 'monday');
    expect(new Date(current.start)).toEqual(local(2027, 1, 1, 0));
    expect(new Date(previous.start)).toEqual(local(2026, 1, 1, 0));
    expect(previous.end - previous.start).toBe(current.end - current.start);
  });

  it('crosses the year inside a week and a month', () => {
    const now = local(2027, 1, 2, 12); // Saturday
    const week = periodRange('week', now, 'monday');
    expect(new Date(week.start)).toEqual(local(2026, 12, 28, 0));
    const history = [session(local(2026, 12, 31, 20), [exercise('bench', [done(50, 10)])])];
    expect(totalsFor(history, week).sessions).toBe(1);
    expect(totalsFor(history, periodRange('month', now, 'monday')).sessions).toBe(0);
    expect(compareTotals(history, comparisonRanges('month', now, 'monday')).sessions).toMatchObject({ current: 0, previous: 0 });
  });

  it('caps the previous span at the end of a shorter month (31 March → February)', () => {
    const now = local(2028, 3, 31, 23); // 2028 is a leap year
    const { previous, current } = comparisonRanges('month', now, 'monday');
    expect(new Date(previous.start)).toEqual(local(2028, 2, 1, 0));
    expect(previous.end).toBe(current.start);
    const history = [session(local(2028, 2, 29, 18), [exercise('bench', [done(50, 10)])])];
    expect(compareTotals(history, { current, previous }).sessions.previous).toBe(1);
  });

  it('builds 4-6 week grids for every month of a year and each week start', () => {
    for (const weekStart of ['saturday', 'sunday', 'monday'] as WeekStart[]) {
      for (let month = 0; month < 12; month += 1) {
        const grid = monthGrid(2027, month, weekStart, new Map());
        expect(grid.length).toBeGreaterThanOrEqual(4);
        expect(grid.length).toBeLessThanOrEqual(6);
        expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(new Date(2027, month + 1, 0).getDate());
      }
    }
  });
});

/**
 * Runs in the process time zone. Jest cannot switch zones mid-run, so
 * `scripts/test-timezones.sh` repeats this file under several TZ values
 * (Cairo, London, Los Angeles, Auckland, Riyadh, UTC).
 */
describe(`time zones and daylight saving (TZ=${process.env.TZ ?? 'system'})`, () => {
  it('keeps local-day buckets and week boundaries', () => {
    // A workout at 23:30 local belongs to that day, whatever its UTC date.
    const late = session(local(2026, 10, 24, 23, 30), [exercise('bench', [done(50, 10)])]);
    expect(dayKey(Date.parse(late.startedAt))).toBe('2026-10-24');
    expect(sessionsByDay([late]).get('2026-10-24')).toHaveLength(1);
    const early = session(local(2026, 10, 25, 0, 15), [exercise('bench', [done(50, 10)])]);
    expect(dayKey(Date.parse(early.startedAt))).toBe('2026-10-25');

    // 52 weeks spanning both DST changes: every bucket starts at local midnight on the week start day.
    const now = local(2026, 11, 2, 12);
    const series = weeklySeries([], 52, now, 'saturday');
    for (const point of series) {
      expect(point.weekStart.getHours()).toBe(0);
      expect(point.weekStart.getDay()).toBe(6);
    }
    // A session in every one of those weeks is counted exactly once.
    const weekly = series.map((p) => session(new Date(p.weekStart.getTime() + 12 * 3600_000), [exercise('bench', [done(50, 10)])]));
    expect(weeklySeries(weekly, 52, now, 'saturday').map((p) => p.sessions)).toEqual(new Array(52).fill(1));
    expect(weeklyStreak(weekly, now, 'saturday')).toBe(52);
    // Sessions right at the boundaries land on the right side.
    const boundary = series[30].weekStart.getTime();
    const edge = [session(new Date(boundary - 60_000), []), session(new Date(boundary), [])];
    const counts = weeklySeries(edge, 52, now, 'saturday').map((p) => p.sessions);
    expect(counts[29]).toBe(1);
    expect(counts[30]).toBe(1);
  });
});

describe('history edits never touch the active session', () => {
  const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };
  afterEach(() => attachPersistence(null));

  function boot() {
    const driver = createNodeDriver();
    migrate(driver);
    const repo = new WorkoutRepository(driver);
    const history = replayHistory([session(local(2026, 10, 1), [exercise('bench', [done(60, 10)])]), session(local(2026, 10, 8), [exercise('bench', [done(70, 8)])])], 0);
    const active: WorkoutSession = { ...session(local(2026, 11, 2, 10), [exercise('bench', [done(80, 5)])]), status: 'in_progress', finishedAt: null, summary: null };
    attachPersistence(null);
    useWorkoutStore.setState({ exercises: [], plans: [], persistenceError: null, ...defaults, history: [], activeSession: null });
    attachPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });
    useWorkoutStore.setState({ history, activeSession: active });
    return { repo, active };
  }

  it('keeps the active session object and its rows through edits and deletes', () => {
    const { repo, active } = boot();
    const first = useWorkoutStore.getState().history[1];
    expect(saveHistorySession(patchHistorySet(first, first.exercises[0].id, first.exercises[0].sets[0].id, { weightKg: 90 }), local(2026, 11, 2, 12).getTime()).ok).toBe(true);
    expect(deleteHistorySession(useWorkoutStore.getState().history[0].id)).toBe(true);
    expect(useWorkoutStore.getState().activeSession).toBe(active);
    const loaded = repo.loadAll(defaults);
    expect(loaded.activeSession?.id).toBe(active.id);
    expect(loaded.activeSession?.exercises[0].sets[0]).toMatchObject({ weightKg: 80, reps: 5, completed: true });
    // The active session's live sets are not part of history replay or PRs.
    expect(loaded.history.every((s) => s.id !== active.id)).toBe(true);
  });

  it('refuses to edit or delete the in-progress session through history actions', () => {
    const { active } = boot();
    const result = saveHistorySession({ ...active, status: 'completed', finishedAt: active.startedAt }, local(2026, 11, 2, 12).getTime());
    expect(result.ok).toBe(false);
    expect(deleteHistorySession(active.id)).toBe(false);
    expect(useWorkoutStore.getState().activeSession).toBe(active);
  });
});

describe('time input parsing', () => {
  it.each([
    ['18:05', { hours: 18, minutes: 5 }],
    ['6:5', { hours: 6, minutes: 5 }],
    ['١٨:٣٠', { hours: 18, minutes: 30 }],
    [' 7.45 ', { hours: 7, minutes: 45 }],
    ['25:00', null],
    ['18:60', null],
    ['18', null],
    ['', null],
  ])('%p → %p', (raw, expected) => expect(parseTimeInput(raw)).toEqual(expected));
});

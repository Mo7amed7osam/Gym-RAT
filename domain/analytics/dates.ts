import { startOfWeek } from '@/lib/workoutMath';
import type { WeekStart } from '@/types/workout';

/**
 * Local-time calendar helpers for analytics. Every range is half-open
 * `[start, end)` in epoch ms. Day arithmetic goes through `Date#setDate` so
 * daylight-saving shifts never move a bucket boundary off midnight.
 */

export interface DateRange {
  start: number;
  end: number;
}

export type PeriodKind = 'week' | 'month' | 'quarter' | 'year';

export const PERIOD_KINDS: readonly PeriodKind[] = ['week', 'month', 'quarter', 'year'];

/** Weeks in the rolling `quarter` period. */
export const QUARTER_WEEKS = 13;

export function startOfDay(date: Date | number): Date {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(date: Date | number, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** "2026-11-02" in local time; the key used for calendar buckets. */
export function dayKey(date: Date | number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function inRange(ms: number, range: DateRange): boolean {
  return ms >= range.start && ms < range.end;
}

/** The whole period containing `now`. */
export function periodRange(kind: PeriodKind, now: Date, weekStart: WeekStart): DateRange {
  switch (kind) {
    case 'week': {
      const start = startOfWeek(now, weekStart);
      return { start: start.getTime(), end: addDays(start, 7).getTime() };
    }
    case 'month':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(),
      };
    case 'quarter': {
      const end = addDays(startOfWeek(now, weekStart), 7);
      return { start: addDays(end, -7 * QUARTER_WEEKS).getTime(), end: end.getTime() };
    }
    case 'year':
      return { start: new Date(now.getFullYear(), 0, 1).getTime(), end: new Date(now.getFullYear() + 1, 0, 1).getTime() };
  }
}

/** Start of the period before the one containing `now`. */
function previousPeriodStart(kind: PeriodKind, current: DateRange): number {
  const start = new Date(current.start);
  switch (kind) {
    case 'week':
      return addDays(start, -7).getTime();
    case 'month':
      return new Date(start.getFullYear(), start.getMonth() - 1, 1).getTime();
    case 'quarter':
      return addDays(start, -7 * QUARTER_WEEKS).getTime();
    case 'year':
      return new Date(start.getFullYear() - 1, 0, 1).getTime();
  }
}

export interface ComparisonRanges {
  /** From the start of the current period up to `now`. */
  current: DateRange;
  /** The same elapsed span at the start of the previous period (never past its end). */
  previous: DateRange;
}

/**
 * To-date comparison: on day 2 of a month, "this month" is compared with the
 * first two days of last month, not with all of it.
 */
export function comparisonRanges(kind: PeriodKind, now: Date, weekStart: WeekStart): ComparisonRanges {
  const period = periodRange(kind, now, weekStart);
  const nowMs = Math.min(now.getTime(), period.end);
  const elapsed = Math.max(0, nowMs - period.start);
  const previousStart = previousPeriodStart(kind, period);
  return {
    current: { start: period.start, end: nowMs + 1 },
    previous: { start: previousStart, end: Math.min(previousStart + elapsed + 1, period.start) },
  };
}

/** Week starts (local midnight) of the last `weeks` weeks, oldest first, ending with the week containing `now`. */
export function weekStarts(weeks: number, now: Date, weekStart: WeekStart): Date[] {
  const current = startOfWeek(now, weekStart);
  return Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)));
}

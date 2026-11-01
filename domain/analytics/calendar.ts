import { startOfWeek } from '@/lib/workoutMath';
import type { WeekStart, WorkoutSession } from '@/types/workout';

import { isCompleted, sessionStartMs, sessionStats } from './aggregate';
import { addDays, dayKey } from './dates';

export interface CalendarDay {
  date: Date;
  key: string;
  /** False for the leading/trailing days that belong to the neighbouring months. */
  inMonth: boolean;
  sessions: WorkoutSession[];
  volumeKg: number;
}

/** Completed sessions keyed by local start day, each list in input order. */
export function sessionsByDay(history: readonly WorkoutSession[]): Map<string, WorkoutSession[]> {
  const days = new Map<string, WorkoutSession[]>();
  for (const session of history) {
    if (!isCompleted(session)) continue;
    const key = dayKey(sessionStartMs(session));
    const list = days.get(key);
    if (list) list.push(session);
    else days.set(key, [session]);
  }
  return days;
}

/**
 * Weeks (rows of 7) covering `month` (0-based) of `year`, aligned to the
 * user's first day of the week. Always 4–6 rows.
 */
export function monthGrid(year: number, month: number, weekStart: WeekStart, byDay: ReadonlyMap<string, WorkoutSession[]>): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const nextMonth = new Date(year, month + 1, 1);
  let cursor = startOfWeek(first, weekStart);
  const weeks: CalendarDay[][] = [];
  while (cursor < nextMonth) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const key = dayKey(cursor);
      const sessions = byDay.get(key) ?? [];
      week.push({
        date: cursor,
        key,
        inMonth: cursor.getMonth() === month,
        sessions,
        volumeKg: sessions.reduce((total, session) => total + sessionStats(session).volumeKg, 0),
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Consecutive weeks with at least one session, counting back from this week.
 * An empty current week does not break the streak until it is over.
 */
export function weeklyStreak(history: readonly WorkoutSession[], now: Date, weekStart: WeekStart): number {
  const trainedWeeks = new Set<number>();
  for (const session of history) {
    if (isCompleted(session)) trainedWeeks.add(startOfWeek(new Date(sessionStartMs(session)), weekStart).getTime());
  }
  let cursor = startOfWeek(now, weekStart);
  if (!trainedWeeks.has(cursor.getTime())) cursor = addDays(cursor, -7);
  let streak = 0;
  while (trainedWeeks.has(cursor.getTime())) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

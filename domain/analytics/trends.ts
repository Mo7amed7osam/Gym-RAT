import type { WeekStart, WorkoutSession } from '@/types/workout';

import { isCompleted, sessionActiveSeconds, sessionStartMs, sessionStats } from './aggregate';
import { addDays, weekStarts } from './dates';

export interface WeeklyPoint {
  /** Local midnight of the week's first day. */
  weekStart: Date;
  sessions: number;
  volumeKg: number;
  workingSets: number;
  activeMinutes: number;
}

/** One point per week for the last `weeks` weeks, oldest first; empty weeks are zeros. */
export function weeklySeries(history: readonly WorkoutSession[], weeks: number, now: Date, weekStart: WeekStart): WeeklyPoint[] {
  const starts = weekStarts(weeks, now, weekStart);
  const bounds = starts.map((start) => start.getTime());
  const end = addDays(starts[starts.length - 1], 7).getTime();
  const points: WeeklyPoint[] = starts.map((start) => ({ weekStart: start, sessions: 0, volumeKg: 0, workingSets: 0, activeMinutes: 0 }));

  for (const session of history) {
    if (!isCompleted(session)) continue;
    const at = sessionStartMs(session);
    if (at < bounds[0] || at >= end) continue;
    let index = bounds.length - 1;
    while (index > 0 && at < bounds[index]) index -= 1;
    const stats = sessionStats(session);
    const point = points[index];
    point.sessions += 1;
    point.volumeKg += stats.volumeKg;
    point.workingSets += stats.workingSets;
    point.activeMinutes += sessionActiveSeconds(session) / 60;
  }
  return points;
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface Trend {
  /** Least-squares slope per step (per week for weekly series). */
  slope: number;
  /** Slope as a percent of the series mean; null when the mean is 0. */
  percentPerStep: number | null;
  direction: TrendDirection;
}

/** Changes smaller than this share of the mean per step read as flat. */
const FLAT_THRESHOLD_PERCENT = 2;

export function trendOf(values: readonly number[]): Trend {
  const n = values.length;
  if (n < 2) return { slope: 0, percentPerStep: null, direction: 'flat' };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((total, value) => total + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, x) => {
    numerator += (x - meanX) * (value - meanY);
    denominator += (x - meanX) ** 2;
  });
  const slope = numerator / denominator;
  if (meanY === 0) return { slope, percentPerStep: null, direction: 'flat' };
  const percentPerStep = (slope / meanY) * 100;
  const direction: TrendDirection =
    Math.abs(percentPerStep) < FLAT_THRESHOLD_PERCENT ? 'flat' : percentPerStep > 0 ? 'up' : 'down';
  return { slope, percentPerStep: Math.round(percentPerStep * 10) / 10, direction };
}

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

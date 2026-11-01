import { activeSeconds } from '@/domain/session/reducer';
import { setVolumeKg } from '@/lib/workoutMath';
import type { ExerciseSet, WorkoutSession } from '@/types/workout';

import { dayKey, inRange, type ComparisonRanges, type DateRange } from './dates';

/**
 * Totals over finished sessions. Everything is derived from raw sets (never
 * from stored summaries) so an edited set shows up everywhere at once. The
 * one exception is PR counts, which only exist in summaries.
 */

export const isCompleted = (session: WorkoutSession): boolean => session.status === 'completed';

export const sessionStartMs = (session: WorkoutSession): number => Date.parse(session.startedAt);

/** A finished working set with reps logged; bodyweight sets (no load) count too. */
export function isWorkingSetDone(set: ExerciseSet): boolean {
  return set.completed && set.type === 'working' && set.reps !== null;
}

/** Completed sessions that started inside `range`, newest first (input order kept). */
export function sessionsInRange(history: readonly WorkoutSession[], range: DateRange): WorkoutSession[] {
  return history.filter((session) => isCompleted(session) && inRange(sessionStartMs(session), range));
}

export function sessionActiveSeconds(session: WorkoutSession): number {
  if (session.summary) return session.summary.activeSeconds;
  return activeSeconds(session, Date.parse(session.finishedAt ?? session.startedAt));
}

export interface SessionStats {
  volumeKg: number;
  workingSets: number;
  reps: number;
}

export function sessionStats(session: WorkoutSession): SessionStats {
  const stats: SessionStats = { volumeKg: 0, workingSets: 0, reps: 0 };
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (!isWorkingSetDone(set)) continue;
      stats.workingSets += 1;
      stats.reps += set.reps ?? 0;
      stats.volumeKg += setVolumeKg(set);
    }
  }
  return stats;
}

export interface TrainingTotals {
  sessions: number;
  volumeKg: number;
  workingSets: number;
  reps: number;
  activeSeconds: number;
  /** Distinct local calendar days with at least one session. */
  trainingDays: number;
  personalRecords: number;
}

export const TOTAL_KEYS: readonly (keyof TrainingTotals)[] = [
  'sessions',
  'volumeKg',
  'workingSets',
  'reps',
  'activeSeconds',
  'trainingDays',
  'personalRecords',
];

export function totalsFor(history: readonly WorkoutSession[], range: DateRange): TrainingTotals {
  const totals: TrainingTotals = { sessions: 0, volumeKg: 0, workingSets: 0, reps: 0, activeSeconds: 0, trainingDays: 0, personalRecords: 0 };
  const days = new Set<string>();
  for (const session of sessionsInRange(history, range)) {
    const stats = sessionStats(session);
    totals.sessions += 1;
    totals.volumeKg += stats.volumeKg;
    totals.workingSets += stats.workingSets;
    totals.reps += stats.reps;
    totals.activeSeconds += sessionActiveSeconds(session);
    totals.personalRecords += session.summary?.personalRecords.length ?? 0;
    days.add(dayKey(sessionStartMs(session)));
  }
  totals.trainingDays = days.size;
  return totals;
}

export interface MetricDelta {
  current: number;
  previous: number;
  diff: number;
  /** Rounded percent change; null without a baseline (previous is 0). */
  percent: number | null;
}

export function delta(current: number, previous: number): MetricDelta {
  return {
    current,
    previous,
    diff: current - previous,
    percent: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  };
}

export type TotalsComparison = Record<keyof TrainingTotals, MetricDelta>;

export function compareTotals(history: readonly WorkoutSession[], ranges: ComparisonRanges): TotalsComparison {
  const current = totalsFor(history, ranges.current);
  const previous = totalsFor(history, ranges.previous);
  const out = {} as TotalsComparison;
  for (const key of TOTAL_KEYS) out[key] = delta(current[key], previous[key]);
  return out;
}

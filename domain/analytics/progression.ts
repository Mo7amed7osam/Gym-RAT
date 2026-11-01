import type { WorkoutSession } from '@/types/workout';

import { isCompleted, isWorkingSetDone, sessionStartMs } from './aggregate';
import { getStrengthMetrics, type StrengthMetrics } from './metrics';

/** One session's performance on one exercise (all its entries in that session combined). */
export interface ProgressionPoint {
  sessionId: string;
  /** Session start, epoch ms. */
  at: number;
  topWeightKg: number;
  bestE1rmKg: number;
  volumeKg: number;
  reps: number;
  workingSets: number;
  /** The set behind `bestE1rmKg`. */
  bestSet: { weightKg: number; reps: number } | null;
}

export type ProgressionMetric = 'e1rm' | 'topWeight' | 'volume' | 'reps';

export const PROGRESSION_METRICS: readonly ProgressionMetric[] = ['e1rm', 'topWeight', 'volume', 'reps'];

export function metricValue(point: ProgressionPoint, metric: ProgressionMetric): number {
  switch (metric) {
    case 'e1rm':
      return point.bestE1rmKg;
    case 'topWeight':
      return point.topWeightKg;
    case 'volume':
      return point.volumeKg;
    case 'reps':
      return point.reps;
  }
}

function pointFor(session: WorkoutSession, exerciseId: string, metrics: StrengthMetrics): ProgressionPoint | null {
  const point: ProgressionPoint = {
    sessionId: session.id,
    at: sessionStartMs(session),
    topWeightKg: 0,
    bestE1rmKg: 0,
    volumeKg: 0,
    reps: 0,
    workingSets: 0,
    bestSet: null,
  };
  for (const item of session.exercises) {
    if (item.exerciseId !== exerciseId) continue;
    for (const set of item.sets) {
      if (!isWorkingSetDone(set)) continue;
      const weight = set.weightKg ?? 0;
      const reps = set.reps ?? 0;
      point.workingSets += 1;
      point.reps += reps;
      point.volumeKg += weight * reps;
      point.topWeightKg = Math.max(point.topWeightKg, weight);
      const e1rm = metrics.estimateOneRepMax(weight, reps);
      if (e1rm > point.bestE1rmKg || point.bestSet === null) {
        point.bestE1rmKg = Math.max(point.bestE1rmKg, e1rm);
        point.bestSet = { weightKg: weight, reps };
      }
    }
  }
  return point.workingSets > 0 ? point : null;
}

/** Oldest first; sessions without a finished working set of the exercise are skipped. */
export function exerciseProgression(
  history: readonly WorkoutSession[],
  exerciseId: string,
  metrics: StrengthMetrics = getStrengthMetrics(),
): ProgressionPoint[] {
  const points: ProgressionPoint[] = [];
  for (const session of history) {
    if (!isCompleted(session)) continue;
    const point = pointFor(session, exerciseId, metrics);
    if (point) points.push(point);
  }
  return points.sort((a, b) => a.at - b.at);
}

export interface TrainedExercise {
  exerciseId: string;
  sessions: number;
  lastPerformedAt: number;
  topWeightKg: number;
  bestE1rmKg: number;
}

/** Every exercise with at least one finished working set, most recently trained first. */
export function trainedExercises(history: readonly WorkoutSession[], metrics: StrengthMetrics = getStrengthMetrics()): TrainedExercise[] {
  const byId = new Map<string, TrainedExercise>();
  for (const session of history) {
    if (!isCompleted(session)) continue;
    const ids = new Set(session.exercises.map((item) => item.exerciseId));
    for (const exerciseId of ids) {
      const point = pointFor(session, exerciseId, metrics);
      if (!point) continue;
      const entry = byId.get(exerciseId) ?? { exerciseId, sessions: 0, lastPerformedAt: 0, topWeightKg: 0, bestE1rmKg: 0 };
      entry.sessions += 1;
      entry.lastPerformedAt = Math.max(entry.lastPerformedAt, point.at);
      entry.topWeightKg = Math.max(entry.topWeightKg, point.topWeightKg);
      entry.bestE1rmKg = Math.max(entry.bestE1rmKg, point.bestE1rmKg);
      byId.set(exerciseId, entry);
    }
  }
  return [...byId.values()].sort((a, b) => b.lastPerformedAt - a.lastPerformedAt || a.exerciseId.localeCompare(b.exerciseId));
}

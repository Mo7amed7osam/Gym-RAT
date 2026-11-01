import type { BodyEntry, BodyMetricKind, Goal, GoalKind } from '@/types/progress';
import type { WeekStart, WorkoutSession } from '@/types/workout';

import { totalsFor } from './aggregate';
import { latestEntry } from './body';
import { periodRange } from './dates';
import { getStrengthMetrics, type StrengthMetrics } from './metrics';
import { exerciseProgression } from './progression';

export interface GoalContext {
  history: readonly WorkoutSession[];
  bodyEntries: readonly BodyEntry[];
  now: Date;
  weekStart: WeekStart;
  metrics?: StrengthMetrics;
}

/** Weekly goals reset every week: they are never stamped as achieved for good. */
export const isRecurringGoal = (kind: GoalKind): boolean => kind === 'weekly_sessions' || kind === 'weekly_volume';

export interface GoalTarget {
  kind: GoalKind;
  exerciseId: string | null;
  bodyMetric: BodyMetricKind | null;
}

/** The value a goal is measured by, right now. Null when there is nothing logged yet. */
export function currentGoalValue(target: GoalTarget, context: GoalContext): number | null {
  const metrics = context.metrics ?? getStrengthMetrics();
  switch (target.kind) {
    case 'bodyweight':
      return latestEntry(context.bodyEntries, 'bodyweight')?.value ?? null;
    case 'body_measurement':
      return target.bodyMetric ? (latestEntry(context.bodyEntries, target.bodyMetric)?.value ?? null) : null;
    case 'exercise_e1rm':
    case 'exercise_weight': {
      if (!target.exerciseId) return null;
      const points = exerciseProgression(context.history, target.exerciseId, metrics);
      if (points.length === 0) return null;
      return Math.max(...points.map((point) => (target.kind === 'exercise_e1rm' ? point.bestE1rmKg : point.topWeightKg)));
    }
    case 'weekly_sessions':
    case 'weekly_volume': {
      const totals = totalsFor(context.history, periodRange('week', context.now, context.weekStart));
      return target.kind === 'weekly_sessions' ? totals.sessions : totals.volumeKg;
    }
  }
}

export type GoalDirection = 'increase' | 'decrease';

export interface GoalEvaluation {
  goal: Goal;
  current: number | null;
  baseline: number;
  direction: GoalDirection;
  /** 0..1 share of the way from baseline to target. */
  progress: number;
  achieved: boolean;
  /** Still to go (always ≥ 0); null without a current value. */
  remaining: number | null;
  overdue: boolean;
}

export function evaluateGoal(goal: Goal, context: GoalContext): GoalEvaluation {
  const current = currentGoalValue(goal, context);
  // Strength and weekly goals start from zero when nothing was logged; body goals need a measurement first.
  const isBody = goal.kind === 'bodyweight' || goal.kind === 'body_measurement';
  const baseline = goal.baselineValue ?? (isBody ? (current ?? goal.targetValue) : 0);
  const direction: GoalDirection = goal.targetValue >= baseline ? 'increase' : 'decrease';
  const met = current !== null && (direction === 'increase' ? current >= goal.targetValue : current <= goal.targetValue);
  const span = goal.targetValue - baseline;
  const progress = current === null ? 0 : met ? 1 : span === 0 ? 0 : Math.min(1, Math.max(0, (current - baseline) / span));
  const achieved = met || (!isRecurringGoal(goal.kind) && goal.achievedAt !== null);
  return {
    goal,
    current,
    baseline,
    direction,
    progress: achieved && !isRecurringGoal(goal.kind) ? 1 : progress,
    achieved,
    remaining: current === null ? null : Math.max(0, direction === 'increase' ? goal.targetValue - current : current - goal.targetValue),
    overdue: goal.deadline !== null && !achieved && context.now.getTime() > Date.parse(goal.deadline),
  };
}

/** Non-recurring goals met now but not yet stamped; the store stamps them once. */
export function newlyAchievedGoalIds(evaluations: readonly GoalEvaluation[]): string[] {
  return evaluations
    .filter((evaluation) => !isRecurringGoal(evaluation.goal.kind) && evaluation.goal.achievedAt === null && evaluation.current !== null && evaluation.achieved)
    .map((evaluation) => evaluation.goal.id);
}

export type GoalInputError = 'target' | 'exercise' | 'body_metric' | 'same_as_current';

/** Checks a new goal before it is created. */
export function validateGoalInput(target: GoalTarget, targetValue: number, baseline: number | null): GoalInputError[] {
  const errors: GoalInputError[] = [];
  if (!Number.isFinite(targetValue) || targetValue <= 0) errors.push('target');
  if ((target.kind === 'exercise_e1rm' || target.kind === 'exercise_weight') && !target.exerciseId) errors.push('exercise');
  if (target.kind === 'body_measurement' && !target.bodyMetric) errors.push('body_metric');
  if (!isRecurringGoal(target.kind) && baseline !== null && baseline === targetValue) errors.push('same_as_current');
  return errors;
}

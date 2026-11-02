import type { GoalEvaluation } from '@/domain/analytics/goals';
import { formatNumber, isolate } from '@/lib/analyticsFormat';
import { BODY_METRIC_UNITS, type BodyMetricKind, type Goal, type GoalKind } from '@/types/progress';
import type { Exercise } from '@/types/workout';
import { getCurrentLocale } from '@/i18n';
import { localName } from '@/lib/exerciseName';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "80 kg", "15 %", "4 workouts". */
export function formatGoalValue(kind: GoalKind, bodyMetric: BodyMetricKind | null, value: number, t: Translate): string {
  if (kind === 'weekly_sessions') return t('progress.workoutsCount', { count: Math.round(value) });
  // kg values are Latin text: isolate them so they keep their order inside Arabic sentences.
  if (kind !== 'body_measurement' || !bodyMetric) {
    return isolate(t('progress.units.kgValue', { value: formatNumber(value, kind === 'weekly_volume' ? 0 : 1) }));
  }
  const unit = BODY_METRIC_UNITS[bodyMetric];
  return t(`progress.units.${unit === '%' ? 'percentValue' : unit === 'cm' ? 'cmValue' : 'kgValue'}`, { value: formatNumber(value) });
}

export function goalTitle(goal: Goal, t: Translate, exercises: ReadonlyMap<string, Exercise>): string {
  const exercise = goal.exerciseId ? (localName(exercises.get(goal.exerciseId)?.name, getCurrentLocale(), goal.exerciseId)) : '';
  const metric = goal.bodyMetric ? t(`progress.body.kinds.${goal.bodyMetric}`) : '';
  return t(`progress.goals.titles.${goal.kind}`, { exercise, metric, target: formatGoalValue(goal.kind, goal.bodyMetric, goal.targetValue, t) });
}

/** "82 / 80 kg" style: current against target, or "Achieved". */
export function goalValueText(evaluation: GoalEvaluation, t: Translate): string {
  const { goal } = evaluation;
  if (evaluation.achieved && goal.kind !== 'weekly_sessions' && goal.kind !== 'weekly_volume') return t('progress.goals.achieved');
  if (evaluation.current === null) return t('progress.goals.noData');
  return t('progress.goals.currentOfTarget', {
    // "1 of 3 workouts", not "1 workout of 3 workouts".
    current: goal.kind === 'weekly_sessions' ? String(Math.round(evaluation.current)) : formatGoalValue(goal.kind, goal.bodyMetric, evaluation.current, t),
    target: formatGoalValue(goal.kind, goal.bodyMetric, goal.targetValue, t),
  });
}

import type { GoalEvaluation } from '@/domain/analytics/goals';
import { formatNumber } from '@/lib/analyticsFormat';
import { BODY_METRIC_UNITS, type BodyMetricKind, type Goal, type GoalKind } from '@/types/progress';
import type { Exercise } from '@/types/workout';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "80 kg", "15 %", "4 workouts". */
export function formatGoalValue(kind: GoalKind, bodyMetric: BodyMetricKind | null, value: number, t: Translate): string {
  if (kind === 'weekly_sessions') return t('progress.workoutsCount', { count: Math.round(value) });
  const unit = kind === 'body_measurement' && bodyMetric ? BODY_METRIC_UNITS[bodyMetric] : 'kg';
  const digits = kind === 'weekly_volume' ? 0 : 1;
  return t(`progress.units.${unit === '%' ? 'percentValue' : unit === 'cm' ? 'cmValue' : 'kgValue'}`, { value: formatNumber(value, digits) });
}

export function goalTitle(goal: Goal, t: Translate, exercises: ReadonlyMap<string, Exercise>): string {
  const exercise = goal.exerciseId ? (exercises.get(goal.exerciseId)?.name.en ?? goal.exerciseId) : '';
  const metric = goal.bodyMetric ? t(`progress.body.kinds.${goal.bodyMetric}`) : '';
  return t(`progress.goals.titles.${goal.kind}`, { exercise, metric, target: formatGoalValue(goal.kind, goal.bodyMetric, goal.targetValue, t) });
}

/** "82 / 80 kg" style: current against target, or "Achieved". */
export function goalValueText(evaluation: GoalEvaluation, t: Translate): string {
  const { goal } = evaluation;
  if (evaluation.achieved && goal.kind !== 'weekly_sessions' && goal.kind !== 'weekly_volume') return t('progress.goals.achieved');
  if (evaluation.current === null) return t('progress.goals.noData');
  return t('progress.goals.currentOfTarget', {
    current: formatGoalValue(goal.kind, goal.bodyMetric, evaluation.current, t),
    target: formatGoalValue(goal.kind, goal.bodyMetric, goal.targetValue, t),
  });
}

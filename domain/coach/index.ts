import { estimateOneRepMaxOrNull, isCountedForRecords } from '@/domain/records';
import { evaluateSession } from '@/domain/progression';
import type { Exercise, Plan, WorkoutSession } from '@/types/workout';

/**
 * Rule-based coach insights for the Today screen (Phase 3 W3, spec §9).
 * Pure, offline, recomputed on read. Each insight carries a stable key (for
 * dismissal), an explanation key and parameters. No diagnoses, no claims
 * beyond what the logs show.
 *
 * Rules
 *  A. `returning`: last completed session ≥ 14 days ago → suggest easing back in.
 *  B. `insufficient_data`: fewer than 3 completed sessions → say so; no other
 *     exercise-level insight is produced yet.
 *  C. `progressing`: an exercise whose best e1RM over the last 4 logged
 *     sessions is ≥ 5 % above the best of the 4 before them.
 *  D. `missing_targets`: an exercise that "missed" (rule 4 of progression) in
 *     each of its last 3 sessions.
 *  E. `plateau`: an exercise logged ≥ 4 times in the last 60 days with no
 *     record event in that window and the same working weight throughout.
 *  F. `consistent_load`: the last 3 full weeks each landed within ±15 % of
 *     the mean weekly volume (and the mean is > 0).
 *  G. At most 3 insights, ordered A, B, D, E, C, F. Dismissed keys are
 *     skipped for `DISMISS_DAYS`.
 */

export type InsightKind = 'returning' | 'insufficient_data' | 'progressing' | 'missing_targets' | 'plateau' | 'consistent_load';

export interface Insight {
  /** Stable identity for dismissal: kind or kind:exerciseId. */
  key: string;
  kind: InsightKind;
  exerciseId: string | null;
  params: Record<string, string | number>;
}

export const DISMISS_DAYS = 14;
export const MAX_INSIGHTS = 3;

const DAY_MS = 86_400_000;

export interface CoachInput {
  history: readonly WorkoutSession[];
  exercises: readonly Exercise[];
  activePlan: Plan | null;
  now: string;
  dismissed: Record<string, string>;
}

const completed = (history: readonly WorkoutSession[]) => history.filter((session) => session.status === 'completed');

function bestE1rmIn(sessions: WorkoutSession[], exerciseId: string): number {
  let best = 0;
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        if (!isCountedForRecords(set)) continue;
        const e1rm = estimateOneRepMaxOrNull(set.weightKg, set.reps);
        if (e1rm !== null && e1rm > best) best = e1rm;
      }
    }
  }
  return best;
}

/** Sessions that logged the exercise, newest first. */
const sessionsWith = (sessions: WorkoutSession[], exerciseId: string) =>
  sessions.filter((session) => session.exercises.some((exercise) => exercise.exerciseId === exerciseId && exercise.sets.some(isCountedForRecords)));

export function buildInsights(input: CoachInput): Insight[] {
  const done = completed(input.history);
  const nowMs = Date.parse(input.now);
  const out: Insight[] = [];
  const push = (kind: InsightKind, exerciseId: string | null, params: Record<string, string | number>) => {
    const key = exerciseId ? `${kind}:${exerciseId}` : kind;
    out.push({ key, kind, exerciseId, params });
  };

  // A. returning
  if (done.length > 0) {
    const days = Math.floor((nowMs - Date.parse(done[0].finishedAt ?? done[0].startedAt)) / DAY_MS);
    if (days >= 14) push('returning', null, { days });
  }

  // B. insufficient data
  if (done.length < 3) {
    push('insufficient_data', null, { sessions: done.length, needed: 3 });
    return finalize(out, input.dismissed, nowMs);
  }

  // Exercises in the active plan first, then anything else logged.
  const planIds = new Set((input.activePlan?.days ?? []).flatMap((day) => day.exercises.map((item) => item.exerciseId)));
  const exerciseIds = [...planIds, ...input.exercises.map((exercise) => exercise.id).filter((id) => !planIds.has(id))];
  const prescriptionFor = (exerciseId: string) =>
    (input.activePlan?.days ?? []).flatMap((day) => day.exercises).find((item) => item.exerciseId === exerciseId)?.reps ?? { min: 8, max: 12 };

  const missing: Insight[] = [];
  const plateaus: Insight[] = [];
  const progressing: Insight[] = [];
  for (const exerciseId of exerciseIds) {
    const logged = sessionsWith(done, exerciseId);
    if (logged.length < 3) continue;
    const reps = prescriptionFor(exerciseId);
    const perfs = logged.slice(0, 3).map((session) => evaluateSession(session, exerciseId, reps)!);

    // D. missing targets
    if (perfs.every((perf) => perf.verdict === 'missed')) {
      missing.push({ key: `missing_targets:${exerciseId}`, kind: 'missing_targets', exerciseId, params: { sessions: 3, min: reps.min } });
      continue;
    }

    // E. plateau: ≥ 4 sessions in 60 days, same working weight, no e1RM / top-weight improvement inside the window.
    const recent60 = logged.filter((session) => nowMs - Date.parse(session.finishedAt ?? session.startedAt) <= 60 * DAY_MS);
    if (recent60.length >= 4) {
      const weights = recent60.map((session) => evaluateSession(session, exerciseId, reps)!.workingWeightKg);
      const sameWeight = weights.every((weight) => weight === weights[0]);
      const bestInWindow = bestE1rmIn(recent60, exerciseId);
      const firstE1rm = bestE1rmIn([recent60[recent60.length - 1]], exerciseId);
      if (sameWeight && weights[0] > 0 && bestInWindow <= firstE1rm) {
        plateaus.push({ key: `plateau:${exerciseId}`, kind: 'plateau', exerciseId, params: { sessions: recent60.length, weight: weights[0] } });
        continue;
      }
    }

    // C. progressing
    if (logged.length >= 8) {
      const recentBest = bestE1rmIn(logged.slice(0, 4), exerciseId);
      const earlierBest = bestE1rmIn(logged.slice(4, 8), exerciseId);
      if (earlierBest > 0 && recentBest >= earlierBest * 1.05) {
        progressing.push({ key: `progressing:${exerciseId}`, kind: 'progressing', exerciseId, params: { percent: Math.round(((recentBest - earlierBest) / earlierBest) * 100) } });
      }
    }
  }

  out.push(...missing, ...plateaus, ...progressing);

  // F. consistent load over the last 3 full weeks (7-day buckets ending now).
  const weeks = [0, 1, 2].map((i) =>
    done
      .filter((session) => {
        const age = nowMs - Date.parse(session.finishedAt ?? session.startedAt);
        return age >= i * 7 * DAY_MS && age < (i + 1) * 7 * DAY_MS;
      })
      .reduce((total, session) => total + (session.summary?.totalVolumeKg ?? 0), 0),
  );
  const mean = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  if (mean > 0 && weeks.every((volume) => Math.abs(volume - mean) <= mean * 0.15)) {
    push('consistent_load', null, { weeks: 3, volume: Math.round(mean) });
  }

  return finalize(out, input.dismissed, nowMs);
}

function finalize(insights: Insight[], dismissed: Record<string, string>, nowMs: number): Insight[] {
  const visible = insights.filter((insight) => {
    const at = dismissed[insight.key];
    return !at || nowMs - Date.parse(at) >= DISMISS_DAYS * DAY_MS;
  });
  return visible.slice(0, MAX_INSIGHTS);
}

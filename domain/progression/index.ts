import { isCountedForRecords } from '@/domain/records';
import type { ExercisePrescription, ExerciseSet, RepRange, WeightType, WorkoutSession } from '@/types/workout';

/**
 * Progressive-overload suggestions (Phase 3 W2, spec §9). Pure and
 * deterministic: same inputs, same output. Suggestions never change logs or
 * plans; the store only uses them to prefill incomplete sets when the user accepts.
 *
 * Rules (numbered so the report can quote them)
 *  1. Inputs: the last 3 completed sessions that logged the exercise (newest
 *     first), the prescription (sets, rep range), weight type, suggestion
 *     steps, and RPE / RIR where the user entered them.
 *  2. Fewer than 1 session → `insufficient_data`: suggest the prescription's
 *     rep range with no weight.
 *  3. "Working weight" of a session = the heaviest weight used by at least half
 *     of its counted sets (mode-ish, biased to the top); sets below it are
 *     ignored for the verdict.
 *  4. A session "hit" the target when every counted set at the working weight
 *     reached the rep maximum; "met" when every set reached the minimum;
 *     otherwise "missed".
 *  5. Hit → `increase` by the step (per-hand step for per-hand exercises),
 *     target reps = range minimum. Exception 5a: if the user logged RPE ≥ 9.5
 *     or RIR = 0 on any of those sets, `hold` instead ("sets were at the limit").
 *     Exception 5b: with only one session of history, `hold` and note that one
 *     good session is not yet a trend.
 *  6. Met but not hit → `add_reps`: same weight, aim for one more rep than the
 *     lowest set reached (capped at the range maximum).
 *  7. Missed once → `hold` (one short session is not a trend).
 *  8. Missed in the last two sessions at the same working weight → `decrease`
 *     by 10 % rounded down to the step, target reps = range minimum.
 *  9. Returning after ≥ 21 days → `hold` at the last working weight; after
 *     ≥ 42 days suggest 90 % of it, rounded to the step.
 * 10. Bodyweight and assisted exercises never get a weight suggestion; the
 *     rep logic (6–8) still applies at the last used weight / assistance.
 * 11. Every output carries an explanation key and parameters; nothing is
 *     inferred from missing RPE / RIR.
 */

export type RecommendationAction = 'increase' | 'add_reps' | 'hold' | 'decrease' | 'insufficient_data';

export interface Recommendation {
  action: RecommendationAction;
  /** Suggested load for the working sets; null when no weight suggestion applies. */
  weightKg: number | null;
  reps: RepRange;
  /** i18n key under `coach.rec.*` plus its parameters. */
  explanationKey: string;
  params: Record<string, string | number>;
  /** How many completed sessions informed the suggestion. */
  basedOnSessions: number;
}

export interface ProgressionInput {
  history: readonly WorkoutSession[];
  exerciseId: string;
  prescription: Pick<ExercisePrescription, 'reps'>;
  weightType: WeightType;
  stepKg: number;
  stepPerHandKg: number;
  /** "Now" for the break rule; ISO. */
  now: string;
  /** Session to ignore (the running one). */
  excludeSessionId?: string;
}

export interface SessionPerformance {
  sessionId: string;
  date: string;
  workingWeightKg: number;
  /** Counted sets at the working weight, in order. */
  sets: (ExerciseSet & { weightKg: number; reps: number })[];
  verdict: 'hit' | 'met' | 'missed';
  atLimit: boolean;
}

const roundToStep = (value: number, step: number): number => (step > 0 ? Math.round(value / step) * step : value);
const floorToStep = (value: number, step: number): number => (step > 0 ? Math.floor(value / step) * step : value);

/** Rule 3 + 4 for one session. Null when the exercise was not logged. */
export function evaluateSession(session: WorkoutSession, exerciseId: string, reps: RepRange): SessionPerformance | null {
  const sets = session.exercises
    .filter((exercise) => exercise.exerciseId === exerciseId)
    .flatMap((exercise) => exercise.sets)
    .filter(isCountedForRecords);
  if (sets.length === 0) return null;
  const sorted = [...sets].sort((a, b) => b.weightKg - a.weightKg);
  const needed = Math.ceil(sets.length / 2);
  // Heaviest weight used by at least half of the sets.
  let workingWeightKg = sorted[sorted.length - 1].weightKg;
  for (const candidate of sorted) {
    if (sets.filter((set) => set.weightKg >= candidate.weightKg).length >= needed) {
      workingWeightKg = candidate.weightKg;
      break;
    }
  }
  const atWeight = sets.filter((set) => set.weightKg === workingWeightKg);
  const verdict: SessionPerformance['verdict'] = atWeight.every((set) => set.reps >= reps.max)
    ? 'hit'
    : atWeight.every((set) => set.reps >= reps.min)
      ? 'met'
      : 'missed';
  const atLimit = atWeight.some((set) => (set.rpe !== null && set.rpe >= 9.5) || set.rir === 0);
  return { sessionId: session.id, date: session.finishedAt ?? session.startedAt, workingWeightKg, sets: atWeight, verdict, atLimit };
}

/** Last `limit` performances, newest first. */
export function recentPerformances(input: Pick<ProgressionInput, 'history' | 'exerciseId' | 'prescription' | 'excludeSessionId'>, limit = 3): SessionPerformance[] {
  const out: SessionPerformance[] = [];
  for (const session of input.history) {
    if (session.status !== 'completed' || session.id === input.excludeSessionId) continue;
    const perf = evaluateSession(session, input.exerciseId, input.prescription.reps);
    if (perf) out.push(perf);
    if (out.length >= limit) break;
  }
  return out;
}

export function recommend(input: ProgressionInput): Recommendation {
  const { reps } = input.prescription;
  const recent = recentPerformances(input);
  if (recent.length === 0) {
    return { action: 'insufficient_data', weightKg: null, reps, explanationKey: 'coach.rec.noHistory', params: {}, basedOnSessions: 0 };
  }
  const last = recent[0];
  const canSuggestWeight = input.weightType !== 'bodyweight' && input.weightType !== 'assisted' && last.workingWeightKg > 0;
  const step = input.weightType === 'per_hand' ? input.stepPerHandKg : input.stepKg;
  const daysSince = Math.floor((Date.parse(input.now) - Date.parse(last.date)) / 86_400_000);
  const weight = last.workingWeightKg;
  const base = { basedOnSessions: recent.length };

  // Rule 9: coming back after a break.
  if (daysSince >= 42 && canSuggestWeight) {
    const reduced = Math.max(step, roundToStep(weight * 0.9, step));
    return { ...base, action: 'decrease', weightKg: reduced, reps, explanationKey: 'coach.rec.longBreak', params: { days: daysSince, weight: reduced, last: weight } };
  }
  if (daysSince >= 21) {
    return { ...base, action: 'hold', weightKg: canSuggestWeight ? weight : null, reps, explanationKey: 'coach.rec.break', params: { days: daysSince, weight } };
  }

  if (last.verdict === 'hit') {
    if (last.atLimit) {
      return { ...base, action: 'hold', weightKg: canSuggestWeight ? weight : null, reps, explanationKey: 'coach.rec.atLimit', params: { weight, max: reps.max } };
    }
    if (recent.length < 2) {
      return { ...base, action: 'hold', weightKg: canSuggestWeight ? weight : null, reps, explanationKey: 'coach.rec.oneSession', params: { weight, max: reps.max } };
    }
    if (!canSuggestWeight) {
      return { ...base, action: 'hold', weightKg: null, reps, explanationKey: 'coach.rec.hitNoLoad', params: { max: reps.max } };
    }
    const next = roundToStep(weight + step, step);
    return { ...base, action: 'increase', weightKg: next, reps, explanationKey: 'coach.rec.increase', params: { weight, next, max: reps.max, step } };
  }

  if (last.verdict === 'met') {
    const lowest = Math.min(...last.sets.map((set) => set.reps));
    const target = Math.min(reps.max, lowest + 1);
    return { ...base, action: 'add_reps', weightKg: canSuggestWeight ? weight : null, reps: { min: target, max: reps.max }, explanationKey: 'coach.rec.addReps', params: { weight, lowest, target, max: reps.max } };
  }

  // Missed.
  const previous = recent[1];
  const repeatedMiss = previous !== undefined && previous.verdict === 'missed' && previous.workingWeightKg === last.workingWeightKg;
  if (repeatedMiss && canSuggestWeight) {
    const reduced = Math.max(step, floorToStep(weight * 0.9, step));
    return { ...base, action: 'decrease', weightKg: reduced, reps, explanationKey: 'coach.rec.decrease', params: { weight, next: reduced, min: reps.min } };
  }
  return { ...base, action: 'hold', weightKg: canSuggestWeight ? weight : null, reps, explanationKey: 'coach.rec.missedOnce', params: { weight, min: reps.min } };
}

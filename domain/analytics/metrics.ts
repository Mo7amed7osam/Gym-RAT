import { detectPersonalRecords, estimateOneRepMax } from '@/lib/workoutMath';
import type { PersonalRecord, WorkoutSession } from '@/types/workout';

/**
 * Integration boundary with the Phase 3 strength engine (ADR-010).
 *
 * Phase 4 never defines its own e1RM or PR rules: progression charts, goals
 * and history recomputation all ask the registered engine. Until Phase 3
 * registers one, the baseline adapter delegates to `lib/workoutMath`.
 */
export interface StrengthMetrics {
  /** Estimated one-rep max for a single set; 0 when the set carries no load or reps. */
  estimateOneRepMax(weightKg: number, reps: number): number;
  /**
   * Records `session` sets against `priorHistory` (completed sessions that
   * started before it, any order). Must be pure: history replay calls it once
   * per session in chronological order.
   */
  detectPersonalRecords(session: WorkoutSession, priorHistory: readonly WorkoutSession[]): PersonalRecord[];
}

export const baselineStrengthMetrics: StrengthMetrics = {
  estimateOneRepMax,
  detectPersonalRecords,
};

let registered: StrengthMetrics = baselineStrengthMetrics;

/** Called once by the Phase 3 engine at startup; `null` restores the baseline (tests). */
export function registerStrengthMetrics(engine: StrengthMetrics | null): void {
  registered = engine ?? baselineStrengthMetrics;
}

export function getStrengthMetrics(): StrengthMetrics {
  return registered;
}

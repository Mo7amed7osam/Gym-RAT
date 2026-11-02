import type { WeightType, WorkoutSession } from '@/types/workout';

import { detectSessionRecords, estimateOneRepMaxOrNull } from './index';

/** How the Phase 4 analytics ask the Phase 3 record engine for numbers (ADR-012). */
export interface StrengthMetrics {
  /** Estimated one-rep max for one set; 0 when the set carries no load, no reps, or more reps than the engine trusts. */
  estimateOneRepMax(weightKg: number, reps: number): number;
  /**
   * Whether this exercise's logged weight is a load that e1RM and top-weight
   * comparisons apply to. False for `assisted` exercises (lower is harder),
   * matching the records rules, so every screen agrees on which sets compete.
   */
  hasComparableLoad(exerciseId: string): boolean;
  /**
   * Records `session` sets against `priorHistory` (completed sessions that
   * started before it, any order). Pure: history replay calls it once per
   * session in chronological order, and a live finish calls it once.
   */
  detectPersonalRecords(session: WorkoutSession, priorHistory: readonly WorkoutSession[]): PersonalRecords;
}

type PersonalRecords = ReturnType<typeof detectSessionRecords>;

/** Resolves an exercise's weight type (bodyweight / assisted rules). The store supplies the real one at boot. */
export type WeightTypeResolver = (exerciseId: string) => WeightType;

export const totalWeightType: WeightTypeResolver = () => 'total';

/** The one strength engine: `domain/records` wrapped for the analytics seam. */
export function createRecordsStrengthMetrics(weightTypeOf: WeightTypeResolver): StrengthMetrics {
  return {
    estimateOneRepMax: (weightKg, reps) => estimateOneRepMaxOrNull(weightKg, reps) ?? 0,
    hasComparableLoad: (exerciseId) => weightTypeOf(exerciseId) !== 'assisted',
    detectPersonalRecords: (session, priorHistory) => detectSessionRecords(session, priorHistory, weightTypeOf),
  };
}

/**
 * Phase 4 user data: body measurements and goals (ADR-010). Stored in the
 * Phase 4–owned `body_metrics` and `goals` tables, held by `useProgressStore`.
 */

import type { ISODateString } from '@/types/workout';

/** `bodyweight` in kg, `body_fat` in percent, the rest are circumferences in cm. */
export type BodyMetricKind = 'bodyweight' | 'body_fat' | 'waist' | 'chest' | 'hips' | 'arm' | 'thigh' | 'neck';

export const BODY_METRIC_KINDS: readonly BodyMetricKind[] = ['bodyweight', 'body_fat', 'waist', 'chest', 'hips', 'arm', 'thigh', 'neck'];

export type BodyMetricUnit = 'kg' | '%' | 'cm';

export const BODY_METRIC_UNITS: Record<BodyMetricKind, BodyMetricUnit> = {
  bodyweight: 'kg',
  body_fat: '%',
  waist: 'cm',
  chest: 'cm',
  hips: 'cm',
  arm: 'cm',
  thigh: 'cm',
  neck: 'cm',
};

/** Plausible input bounds per unit; values outside are typos. */
export const BODY_METRIC_LIMITS: Record<BodyMetricUnit, { min: number; max: number }> = {
  kg: { min: 20, max: 400 },
  '%': { min: 2, max: 75 },
  cm: { min: 10, max: 250 },
};

export interface BodyEntry {
  id: string;
  kind: BodyMetricKind;
  value: number;
  measuredAt: ISODateString;
  note: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * `bodyweight` / `body_measurement`: reach a value (up or down from the baseline).
 * `exercise_e1rm` / `exercise_weight`: strength target for one exercise.
 * `weekly_sessions` / `weekly_volume`: hit a number in the current week.
 */
export type GoalKind = 'bodyweight' | 'body_measurement' | 'exercise_e1rm' | 'exercise_weight' | 'weekly_sessions' | 'weekly_volume';

export const GOAL_KINDS: readonly GoalKind[] = ['exercise_e1rm', 'exercise_weight', 'bodyweight', 'body_measurement', 'weekly_sessions', 'weekly_volume'];

export interface Goal {
  id: string;
  kind: GoalKind;
  /** Exercise goals only. */
  exerciseId: string | null;
  /** `body_measurement` goals only. */
  bodyMetric: BodyMetricKind | null;
  targetValue: number;
  /** Value when the goal was set; decides direction (a weight cut has target < baseline). */
  baselineValue: number | null;
  deadline: ISODateString | null;
  /** First time the goal was met; kept even if the value later slips. */
  achievedAt: ISODateString | null;
  archived: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

import type { Exercise, MuscleGroup, WorkoutSession } from '@/types/workout';

import { isWorkingSetDone, sessionsInRange } from './aggregate';
import type { DateRange } from './dates';

export type MuscleKey = MuscleGroup | 'other';

export interface MuscleShare {
  muscle: MuscleKey;
  /** Fractional sets: primary muscles get 1 per set, secondary 0.5. */
  sets: number;
}

export const SECONDARY_SET_WEIGHT = 0.5;

/**
 * Working sets per muscle in `range`, largest first. Exercises missing from
 * the library (or with no muscles) count under `other` so totals still add up.
 */
export function muscleSetDistribution(
  history: readonly WorkoutSession[],
  range: DateRange,
  exercises: ReadonlyMap<string, Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>>,
): MuscleShare[] {
  const totals = new Map<MuscleKey, number>();
  const add = (muscle: MuscleKey, amount: number) => totals.set(muscle, (totals.get(muscle) ?? 0) + amount);

  for (const session of sessionsInRange(history, range)) {
    for (const item of session.exercises) {
      const sets = item.sets.filter(isWorkingSetDone).length;
      if (sets === 0) continue;
      const exercise = exercises.get(item.exerciseId);
      if (!exercise || exercise.primaryMuscles.length === 0) {
        add('other', sets);
        continue;
      }
      for (const muscle of exercise.primaryMuscles) add(muscle, sets);
      for (const muscle of exercise.secondaryMuscles) {
        if (!exercise.primaryMuscles.includes(muscle)) add(muscle, sets * SECONDARY_SET_WEIGHT);
      }
    }
  }

  return [...totals.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

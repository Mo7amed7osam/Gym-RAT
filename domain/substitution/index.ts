import type { Equipment, Exercise, MuscleGroup } from '@/types/workout';

/**
 * Substitution ranking (Phase 3 W5, spec §9). Pure. Never substitutes
 * anything itself; it only orders candidates and says how close they are.
 *
 * Rules
 *  1. Candidates are the source's listed alternatives plus any non-archived
 *     library exercise sharing a primary muscle (or whose primary is a
 *     secondary of the source); never the source itself.
 *  2. `equivalent`: listed in the source's `alternatives` AND same primary
 *     muscles AND same weight type (same loading convention, so history
 *     stays comparable in spirit, though records are still per id).
 *  3. `similar`: shares every primary muscle, or is a listed alternative with
 *     a different loading / equipment.
 *  4. `different`: shares at least one primary muscle (or a secondary of the
 *     source as its primary) but is otherwise a different movement.
 *  5. Within a tier: listed alternatives first, then more shared primaries,
 *     then same equipment, then same weight type, then name.
 *  6. `availableEquipment` (optional) demotes candidates needing anything
 *     outside it to the end of their tier and flags `missingEquipment`.
 */

export type Equivalence = 'equivalent' | 'similar' | 'different';

export interface SubstituteSuggestion {
  exercise: Exercise;
  equivalence: Equivalence;
  listed: boolean;
  sharedPrimary: MuscleGroup[];
  sameEquipment: boolean;
  sameWeightType: boolean;
  missingEquipment: Equipment[];
}

const sameSet = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((item) => b.includes(item));

export function rankSubstitutes(source: Exercise, library: readonly Exercise[], availableEquipment?: readonly Equipment[]): SubstituteSuggestion[] {
  const out: SubstituteSuggestion[] = [];
  for (const candidate of library) {
    if (candidate.id === source.id || candidate.archived) continue;
    const sharedPrimary = candidate.primaryMuscles.filter((muscle) => source.primaryMuscles.includes(muscle));
    const coversSecondary = candidate.primaryMuscles.some((muscle) => source.secondaryMuscles.includes(muscle));
    const listed = source.alternatives.includes(candidate.id);
    if (!listed && sharedPrimary.length === 0 && !coversSecondary) continue;
    const sameEquipment = sameSet(candidate.equipment, source.equipment);
    const sameWeightType = candidate.weightType === source.weightType;
    const samePrimary = sameSet(candidate.primaryMuscles, source.primaryMuscles);
    const equivalence: Equivalence = listed && samePrimary && sameWeightType ? 'equivalent' : samePrimary || listed ? 'similar' : 'different';
    const missingEquipment = availableEquipment ? candidate.equipment.filter((item) => item !== 'bodyweight' && !availableEquipment.includes(item)) : [];
    out.push({ exercise: candidate, equivalence, listed, sharedPrimary, sameEquipment, sameWeightType, missingEquipment });
  }
  const tier = (value: Equivalence) => (value === 'equivalent' ? 0 : value === 'similar' ? 1 : 2);
  return out.sort(
    (a, b) =>
      tier(a.equivalence) - tier(b.equivalence) ||
      Number(a.missingEquipment.length > 0) - Number(b.missingEquipment.length > 0) ||
      Number(b.listed) - Number(a.listed) ||
      b.sharedPrimary.length - a.sharedPrimary.length ||
      Number(b.sameEquipment) - Number(a.sameEquipment) ||
      Number(b.sameWeightType) - Number(a.sameWeightType) ||
      a.exercise.name.en.localeCompare(b.exercise.name.en),
  );
}

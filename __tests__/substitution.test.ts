import { rankSubstitutes } from '@/domain/substitution';
import { BUILTIN_EXERCISES, getBuiltinExercise } from '@/data/exercisesData';

/** Phase 3 W5 — substitution ranking. */

describe('substitution ranking', () => {
  const bench = getBuiltinExercise('flat_barbell_bench_press')!;
  const calf = getBuiltinExercise('standing_calf_raise')!;

  it('tiers candidates and never includes the source or archived exercises', () => {
    const calves = rankSubstitutes(calf, BUILTIN_EXERCISES);
    expect(calves.slice(0, 2).map((s) => [s.exercise.id, s.equivalence, s.listed])).toEqual([
      ['leg_press_calf_raise', 'equivalent', true],
      ['seated_calf_raise', 'equivalent', true],
    ]);

    const ranked = rankSubstitutes(bench, BUILTIN_EXERCISES);
    expect(ranked.some((s) => s.exercise.id === bench.id)).toBe(false);
    const byId = Object.fromEntries(ranked.map((s) => [s.exercise.id, s]));
    // Listed, same primary (chest) but per-hand loading → similar, not equivalent.
    expect(byId.flat_dumbbell_bench_press).toMatchObject({ listed: true, equivalence: 'similar', sameWeightType: false });
    // Listed but a different primary (upper chest) → similar.
    expect(byId.hammer_strength_incline_press).toMatchObject({ listed: true, equivalence: 'similar' });
    expect(byId.pec_deck_fly).toMatchObject({ listed: false, equivalence: 'similar' }); // same primary muscle, not listed
    expect(byId.overhead_dumbbell_press.equivalence).toBe('different'); // front delts = bench secondary
    expect(byId.leg_press).toBeUndefined();
    // Listed alternatives come first within the similar tier.
    expect(ranked[0].listed).toBe(true);
    const archived = BUILTIN_EXERCISES.map((e) => (e.id === 'flat_dumbbell_bench_press' ? { ...e, archived: true } : e));
    expect(rankSubstitutes(bench, archived).some((s) => s.exercise.id === 'flat_dumbbell_bench_press')).toBe(false);
  });

  it('demotes candidates that need unavailable equipment and flags what is missing', () => {
    const ranked = rankSubstitutes(bench, BUILTIN_EXERCISES, ['dumbbell', 'bench', 'bodyweight']);
    const machine = ranked.find((s) => s.exercise.id === 'hammer_strength_incline_press')!;
    expect(machine.missingEquipment).toEqual(['machine']);
    const dumbbell = ranked.find((s) => s.exercise.id === 'flat_dumbbell_bench_press')!;
    expect(dumbbell.missingEquipment).toEqual([]);
    expect(ranked.indexOf(dumbbell)).toBeLessThan(ranked.indexOf(machine));
  });
});

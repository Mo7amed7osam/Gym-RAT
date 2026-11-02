import type { ExercisePrescription, LocalizedText, Plan, PlanDay, RepRange, RestPeriod } from '@/types/workout';
import type { BuiltinExerciseId } from '../exercisesData';

/**
 * Full Body Starter: the default plan on a fresh install. It uses only
 * exercises already in the library so every install has a runnable default.
 * Earlier builds labelled it "(draft)"; `seedPlans` renames those copies.
 */

export const STARTER_PLAN_ID = 'full_body_starter';

export const STARTER_NAME: LocalizedText = { en: 'Full Body Starter', ar: 'برنامج الجسم الكامل للمبتدئين' };
export const STARTER_DESCRIPTION: LocalizedText = {
  en: 'Three full-body workouts per rotation.',
  ar: 'ثلاثة تمارين لكامل الجسم في كل دورة.',
};
/** The name earlier builds stored; copies still carrying it are renamed at boot. */
export const LEGACY_STARTER_NAME_EN = 'Full Body Starter (draft)';

const REST_90: RestPeriod = { defaultSeconds: 90, minSeconds: 60, maxSeconds: 120 };
const REST_120: RestPeriod = { defaultSeconds: 120, minSeconds: 120, maxSeconds: 150 };
const reps = (min: number, max: number = min): RepRange => ({ min, max });
const rx = (exerciseId: BuiltinExerciseId, sets: number, r: RepRange, rest: RestPeriod): ExercisePrescription => ({
  exerciseId,
  sets,
  reps: r,
  rest,
});

const day = (position: number, code: string, title: string, muscles: LocalizedText, exercises: ExercisePrescription[]): PlanDay => ({
  id: `${STARTER_PLAN_ID}:${position}`,
  position,
  code,
  title: { en: title, ar: title },
  muscleSummary: muscles,
  focus: null,
  exercises,
});

export const STARTER_DAYS: readonly PlanDay[] = [
  day(0, 'Full Body A', 'Full Body A', { en: 'Legs · Chest · Back · Shoulders', ar: 'الرجل + الصدر + الظهر + الكتف' }, [
    rx('leg_press', 3, reps(8, 12), REST_120),
    rx('flat_dumbbell_bench_press', 3, reps(8, 12), REST_120),
    rx('seated_close_grip_row', 3, reps(10, 12), REST_90),
    rx('seated_dumbbell_press', 3, reps(10, 12), REST_90),
    rx('lying_leg_curl', 3, reps(10, 12), REST_90),
    rx('standing_calf_raise', 3, reps(12, 15), REST_90),
  ]),
  day(1, 'Full Body B', 'Full Body B', { en: 'Legs · Back · Chest · Arms', ar: 'الرجل + الظهر + الصدر + الذراع' }, [
    rx('hack_squat', 3, reps(8, 12), REST_120),
    rx('wide_grip_lat_pulldown', 3, reps(10, 12), REST_120),
    rx('incline_dumbbell_bench_press', 3, reps(8, 12), REST_120),
    rx('dumbbell_lateral_raise', 3, reps(12, 15), REST_90),
    rx('dumbbell_hammer_curl', 3, reps(10, 12), REST_90),
    rx('triceps_rope_pushdown', 3, reps(10, 12), REST_90),
  ]),
  day(2, 'Full Body C', 'Full Body C', { en: 'Posterior chain · Chest · Back · Core', ar: 'السلسلة الخلفية + الصدر + الظهر + البطن' }, [
    rx('dumbbell_deadlift', 3, reps(8, 10), REST_120),
    rx('leg_extension', 3, reps(10, 12), REST_90),
    rx('pec_deck_fly', 3, reps(10, 12), REST_90),
    rx('dumbbell_bent_over_row', 3, reps(10, 12), REST_120),
    rx('reverse_pec_deck', 3, reps(12, 15), REST_90),
    rx('lying_leg_raise', 3, reps(15), REST_90),
  ]),
];

export function buildStarterTemplate(): Plan {
  return {
    id: STARTER_PLAN_ID,
    kind: 'template',
    name: STARTER_NAME,
    description: STARTER_DESCRIPTION,
    sourcePlanId: null,
    locked: true,
    nextDayIndex: 0,
    archived: false,
    days: STARTER_DAYS.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

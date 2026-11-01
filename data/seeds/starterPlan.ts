import type { ExercisePrescription, Plan, PlanDay, RepRange, RestPeriod } from '@/types/workout';
import type { BuiltinExerciseId } from '../exercisesData';

/**
 * Full Body Starter — DRAFT. Content is a placeholder until the owner approves
 * the final starter program (decision D4 in the master plan). It uses only
 * exercises already in the library so every install has a runnable default.
 */

export const STARTER_PLAN_ID = 'full_body_starter';

const REST_90: RestPeriod = { defaultSeconds: 90, minSeconds: 60, maxSeconds: 120 };
const REST_120: RestPeriod = { defaultSeconds: 120, minSeconds: 120, maxSeconds: 150 };
const reps = (min: number, max: number = min): RepRange => ({ min, max });
const rx = (exerciseId: BuiltinExerciseId, sets: number, r: RepRange, rest: RestPeriod): ExercisePrescription => ({
  exerciseId,
  sets,
  reps: r,
  rest,
});

const day = (position: number, code: string, title: string, muscles: string, exercises: ExercisePrescription[]): PlanDay => ({
  id: `${STARTER_PLAN_ID}:${position}`,
  position,
  code,
  title: { en: title, ar: title },
  muscleSummary: { en: muscles, ar: muscles },
  focus: null,
  exercises,
});

export const STARTER_DAYS: readonly PlanDay[] = [
  day(0, 'Full Body A', 'Full Body A', 'Legs · Chest · Back · Shoulders', [
    rx('leg_press', 3, reps(8, 12), REST_120),
    rx('flat_dumbbell_bench_press', 3, reps(8, 12), REST_120),
    rx('seated_close_grip_row', 3, reps(10, 12), REST_90),
    rx('seated_dumbbell_press', 3, reps(10, 12), REST_90),
    rx('lying_leg_curl', 3, reps(10, 12), REST_90),
    rx('standing_calf_raise', 3, reps(12, 15), REST_90),
  ]),
  day(1, 'Full Body B', 'Full Body B', 'Legs · Back · Chest · Arms', [
    rx('hack_squat', 3, reps(8, 12), REST_120),
    rx('wide_grip_lat_pulldown', 3, reps(10, 12), REST_120),
    rx('incline_dumbbell_bench_press', 3, reps(8, 12), REST_120),
    rx('dumbbell_lateral_raise', 3, reps(12, 15), REST_90),
    rx('dumbbell_hammer_curl', 3, reps(10, 12), REST_90),
    rx('triceps_rope_pushdown', 3, reps(10, 12), REST_90),
  ]),
  day(2, 'Full Body C', 'Full Body C', 'Posterior chain · Chest · Back · Core', [
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
    name: { en: 'Full Body Starter (draft)', ar: 'برنامج الجسم الكامل للمبتدئين (مسودة)' },
    description: {
      en: 'Three full-body workouts per rotation. Draft content pending approval.',
      ar: 'ثلاث تمارين لكامل الجسم في كل دورة. محتوى مبدئي بانتظار الاعتماد.',
    },
    sourcePlanId: null,
    locked: true,
    nextDayIndex: 0,
    days: STARTER_DAYS.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

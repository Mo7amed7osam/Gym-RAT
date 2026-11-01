import type { ExercisePrescription, Plan, PlanDay, RepRange, RestPeriod } from '@/types/workout';
import type { BuiltinExerciseId } from '../exercisesData';

/**
 * "Push - Pull - Leg / Upper - Lower Ver 5.0", extracted from the owner's
 * program document into native plan data. Sets / reps / rest follow the
 * source tables (schedule p.6; day tables p.7, 13, 18, 22, 28; all 42 rows
 * re-checked against the source on 2026-11-01); the document itself is not bundled.
 *
 * Shipped as an ordinary bundled template, selectable next to the Full Body
 * Starter. It is never selected automatically (Starter is the default); the
 * user adopts, follows, edits (plan editor, Phase 2) and duplicates it through
 * the normal workout engine and rotation. The source's Tuesday cardio and
 * Friday rest are not plan days: the rotation only contains training days.
 */

export const PDF_PROGRAM_ID = 'pdf_ppl_ul_v5';
/** Stable day ids; legacy sessions are mapped onto these by routine id. */
export const pdfDayId = (routineId: string): string => `${PDF_PROGRAM_ID}:${routineId}`;

// PDF rest values are either "2 دقيقة" or "1 - 2 دقيقة".
const REST_2_MIN: RestPeriod = { defaultSeconds: 120, minSeconds: 120, maxSeconds: 120 };
const REST_1_TO_2_MIN: RestPeriod = { defaultSeconds: 90, minSeconds: 60, maxSeconds: 120 };

function reps(min: number, max: number = min): RepRange {
  return { min, max };
}

function rx(exerciseId: BuiltinExerciseId, sets: number, repRange: RepRange, rest: RestPeriod): ExercisePrescription {
  return { exerciseId, sets, reps: repRange, rest };
}

function day(routineId: string, position: number, rest: Omit<PlanDay, 'id' | 'position'>): PlanDay {
  return { id: pdfDayId(routineId), position, ...rest };
}

const PUSH_A = day('push_a', 0, {
  code: 'Push A',
  focus: 'strength',
  title: { en: 'Push Day (A)', ar: 'عضلات الدفع (1)' },
  muscleSummary: { en: 'Chest · Shoulders · Triceps', ar: 'الصدر + الكتف + التراي' },
  exercises: [
    rx('flat_barbell_bench_press', 3, reps(10, 12), REST_2_MIN),
    rx('incline_dumbbell_bench_press', 3, reps(10, 12), REST_2_MIN),
    rx('pec_deck_fly', 3, reps(10, 12), REST_2_MIN),
    rx('high_low_cable_fly', 3, reps(10, 12), REST_2_MIN),
    rx('overhead_dumbbell_press', 3, reps(10, 12), REST_2_MIN),
    rx('dumbbell_lateral_raise', 3, reps(10, 12), REST_1_TO_2_MIN),
    rx('dumbbell_skull_crusher', 3, reps(10, 12), REST_1_TO_2_MIN),
    rx('triceps_rope_pushdown', 3, reps(10, 12), REST_1_TO_2_MIN),
    rx('lying_leg_raise', 3, reps(25), REST_1_TO_2_MIN),
  ],
});

const PULL_A = day('pull_a', 1, {
  code: 'Pull A',
  focus: 'strength',
  title: { en: 'Pull Day (A)', ar: 'عضلات السحب (1)' },
  muscleSummary: { en: 'Back · Biceps', ar: 'الظهر + الباي' },
  exercises: [
    rx('dumbbell_bent_over_row', 3, reps(10, 12), REST_2_MIN),
    rx('seated_close_grip_row', 3, reps(10, 12), REST_2_MIN),
    rx('standing_lat_pushdown', 3, reps(10, 12), REST_2_MIN),
    rx('hammer_strength_lat_pulldown', 3, reps(10, 12), REST_2_MIN),
    rx('dumbbell_front_raise', 3, reps(10, 12), REST_1_TO_2_MIN),
    rx('reverse_pec_deck', 3, reps(10), REST_1_TO_2_MIN),
    rx('close_grip_ez_bar_curl', 4, reps(10, 12), REST_1_TO_2_MIN),
    rx('dumbbell_hammer_curl', 4, reps(10, 12), REST_1_TO_2_MIN),
  ],
});

const LEG_A = day('leg_a', 2, {
  code: 'Leg A',
  focus: 'strength',
  title: { en: 'Leg Day (A)', ar: 'عضلات الرجل (1)' },
  muscleSummary: { en: 'Legs · Calves', ar: 'الرجل + السمانة' },
  exercises: [
    rx('dumbbell_deadlift', 3, reps(10, 12), REST_1_TO_2_MIN),
    rx('leg_extension', 3, reps(10), REST_2_MIN),
    rx('lying_leg_curl', 3, reps(10), REST_2_MIN),
    rx('leg_press', 3, reps(10), REST_2_MIN),
    rx('standing_calf_raise', 4, reps(12, 15), REST_1_TO_2_MIN),
    rx('seated_calf_raise', 4, reps(12, 15), REST_1_TO_2_MIN),
    rx('hip_thrust', 3, reps(10), REST_2_MIN),
  ],
});

const UPPER_B = day('upper_b', 3, {
  code: 'Upper B',
  focus: 'hypertrophy',
  title: { en: 'Upper Day (B)', ar: 'عضلات الجزء العلوي (2)' },
  muscleSummary: { en: 'Chest · Back · Shoulders · Arms', ar: 'الصدر + الظهر + الكتف + الذراع' },
  exercises: [
    rx('flat_dumbbell_bench_press', 3, reps(10, 12), REST_2_MIN),
    rx('hammer_strength_incline_press', 3, reps(10, 12), REST_2_MIN),
    rx('dumbbell_bent_over_row', 3, reps(10, 12), REST_2_MIN),
    rx('wide_grip_lat_pulldown', 3, reps(10, 12), REST_2_MIN),
    rx('seated_dumbbell_press', 3, reps(10, 12), REST_2_MIN),
    rx('leaning_lateral_raise', 3, reps(10, 12), REST_2_MIN),
    rx('barbell_skull_crusher', 3, reps(10), REST_1_TO_2_MIN),
    rx('dumbbell_kickback', 3, reps(10), REST_1_TO_2_MIN),
    rx('overhead_cable_curl', 3, reps(10), REST_1_TO_2_MIN),
    rx('straight_barbell_curl', 3, reps(10), REST_1_TO_2_MIN),
  ],
});

const LOWER_B = day('lower_b', 4, {
  code: 'Lower B',
  focus: 'hypertrophy',
  title: { en: 'Lower Day (B)', ar: 'عضلات الجزء السفلي (2)' },
  muscleSummary: { en: 'Legs · Calves · Forearms', ar: 'الرجل + السمانة + الساعد' },
  exercises: [
    rx('hack_squat', 3, reps(10), REST_2_MIN),
    rx('leg_extension', 3, reps(10), REST_2_MIN),
    rx('lying_leg_curl', 3, reps(10), REST_2_MIN),
    rx('dumbbell_lunge', 3, reps(13, 15), REST_2_MIN),
    rx('seated_calf_raise', 4, reps(13, 15), REST_1_TO_2_MIN),
    rx('leg_press_calf_raise', 4, reps(13, 15), REST_1_TO_2_MIN),
    rx('dumbbell_wrist_curl', 3, reps(10, 12), REST_1_TO_2_MIN),
    rx('forearm_barbell_curl', 3, reps(10, 12), REST_1_TO_2_MIN),
  ],
});

export const PDF_PROGRAM_DAYS: readonly PlanDay[] = [PUSH_A, PULL_A, LEG_A, UPPER_B, LOWER_B];

export const PDF_PROGRAM_INFO = {
  name: { en: 'Push / Pull / Legs + Upper / Lower v5.0', ar: 'دفع / سحب / رجل + علوي / سفلي 5.0' },
  description: {
    en: 'Push, pull and leg days for strength, then upper and lower days for hypertrophy. Five workouts per rotation.',
    ar: 'فكرة البرنامج تعتمد على تقسيم عضلات الجسم على ثلاث أيام ما بين عضلات الدفع والسحب والرجل ثم تكرارها مرة ثانية على يومين لعضلات الجزء العلوي والسفلي',
  },
  focusLabels: {
    strength: { en: 'Strength', ar: 'قوة' },
    hypertrophy: { en: 'Hypertrophy', ar: 'ضخامة' },
  },
} as const;

/** The bundled template as shipped. `createdAt` is the seed date, not the user's install. */
export function buildPplUlTemplate(): Plan {
  return {
    id: PDF_PROGRAM_ID,
    kind: 'template',
    name: PDF_PROGRAM_INFO.name,
    description: PDF_PROGRAM_INFO.description,
    sourcePlanId: null,
    locked: true,
    nextDayIndex: 0,
    days: PDF_PROGRAM_DAYS.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

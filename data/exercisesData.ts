import type { Equipment, Exercise, ExerciseContent, LocalizedText, MuscleGroup } from '@/types/workout';

import { EXERCISE_CONTENT } from './exerciseContent';
import { curatedVideo } from './youtubeVideos';

/**
 * Built-in exercise seed (ADR-007). Names (EN + AR), muscles and equipment
 * come from the original program; where the source has no Arabic name
 * (`arabicNameSource: 'supplied'`) the translation was added by us.
 * Instructional content lives in `exerciseContent.ts`. The runtime library is
 * the `exercises` table: this file only seeds and refreshes the built-in rows.
 */

/** Bump when authored content changes so existing installs refresh their built-in rows. */
export const BUILTIN_CONTENT_VERSION = 2;
/** Seed timestamp for built-in rows (not the user's install date). */
export const BUILTIN_SEEDED_AT = '2026-11-01T00:00:00.000Z';

type ExerciseInput = Pick<Exercise, 'name' | 'primaryMuscles' | 'secondaryMuscles' | 'equipment' | 'isUnilateral'> & {
  arabicNameSource: 'pdf' | 'supplied';
};

function defineExercises<K extends string>(defs: Record<K, ExerciseInput>): Record<K, Exercise> {
  const result = {} as Record<K, Exercise>;
  for (const id of Object.keys(defs) as K[]) {
    const content = EXERCISE_CONTENT[id];
    if (!content) throw new Error(`Missing authored content for built-in exercise "${id}"`);
    result[id] = {
      ...defs[id],
      id,
      origin: 'builtin',
      weightType: content.weightType,
      instructions: content.instructions,
      breathing: content.breathing,
      rangeOfMotion: content.rangeOfMotion,
      commonMistakes: content.commonMistakes,
      alternatives: content.alternatives,
      videoId: curatedVideo(id)?.videoId ?? null,
      imageUri: null,
      userNotes: '',
      userRestSeconds: null,
      archived: false,
      createdAt: BUILTIN_SEEDED_AT,
      updatedAt: BUILTIN_SEEDED_AT,
    };
  }
  return result;
}

export const EXERCISES = defineExercises({
  // ── Push A ────────────────────────────────────────────────────────────────
  flat_barbell_bench_press: {
    name: { en: 'Flat Barbell Bench Press', ar: 'بنش بار على الكرسي المسطح' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['barbell', 'bench'],
    isUnilateral: false,
  },
  incline_dumbbell_bench_press: {
    name: { en: 'Incline Dumbbell Bench Press', ar: 'تقفيل (تجميع) بنش على الكرسي العالي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['upper_chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: false,
  },
  pec_deck_fly: {
    name: { en: 'Pec Deck Fly Machine (Butterfly)', ar: 'تفتيح بنش على الماكينة (الفراشة)' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts'],
    equipment: ['machine'],
    isUnilateral: false,
  },
  high_low_cable_fly: {
    name: { en: 'High-to-Low Cable Chest Fly', ar: 'كابلات بنش من فوق لتحت' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts'],
    equipment: ['cable'],
    isUnilateral: false,
  },
  overhead_dumbbell_press: {
    name: { en: 'Standing Overhead Dumbbell Press', ar: 'كتف واقف بالدمبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['side_delts', 'triceps'],
    equipment: ['dumbbell'],
    isUnilateral: false,
  },
  dumbbell_lateral_raise: {
    name: { en: 'Dumbbell Lateral Raise', ar: 'رفرفة جانبي كتف' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: ['upper_back'],
    equipment: ['dumbbell'],
    isUnilateral: false,
  },
  dumbbell_skull_crusher: {
    name: { en: 'Dumbbell Skull Crushers', ar: 'دامبل تراي وإنت نايم على الأرض' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    isUnilateral: false,
  },
  triceps_rope_pushdown: {
    name: { en: 'Triceps Rope Pushdown', ar: 'تراي بالحبل على الماكينة' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['cable'],
    isUnilateral: false,
  },
  lying_leg_raise: {
    name: { en: 'Flat Bench Lying Leg Raises', ar: 'بطن على الكرسي المسطح' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['hip_flexors'],
    equipment: ['bench', 'bodyweight'],
    isUnilateral: false,
  },

  // ── Pull A ────────────────────────────────────────────────────────────────
  dumbbell_bent_over_row: {
    name: { en: 'Single-Arm Dumbbell Bent-Over Row', ar: 'ون هاند (إيد واحدة)' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['upper_back', 'biceps', 'rear_delts'],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: true,
  },
  seated_close_grip_row: {
    name: { en: 'Seated Close-Grip Cable Row', ar: 'سحب أرضي قبضة ضيقة' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['upper_back', 'lats'],
    secondaryMuscles: ['biceps', 'rear_delts'],
    equipment: ['cable'],
    isUnilateral: false,
  },
  standing_lat_pushdown: {
    name: { en: 'Standing Lat Pushdown (Cable)', ar: 'ماكينة سحب ضهر بالبار وإنت واقف' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['triceps'],
    equipment: ['cable'],
    isUnilateral: false,
  },
  hammer_strength_lat_pulldown: {
    name: { en: 'Seated Lat Pulldown (Hammer Strength)', ar: 'الهامر' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper_back'],
    equipment: ['machine'],
    isUnilateral: false,
  },
  dumbbell_front_raise: {
    name: { en: 'Dumbbell Front Raise', ar: 'رفرفة كتف أمامي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['upper_chest'],
    equipment: ['dumbbell'],
    isUnilateral: false,
  },
  reverse_pec_deck: {
    name: { en: 'Reverse Pec Deck Machine', ar: 'ماكينة كتف خلفي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['upper_back'],
    equipment: ['machine'],
    isUnilateral: false,
  },
  close_grip_ez_bar_curl: {
    name: { en: 'Close-Grip EZ Bar Biceps Curl', ar: 'باي بار زجزاج ضيق' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['ez_bar'],
    isUnilateral: false,
  },
  dumbbell_hammer_curl: {
    name: { en: 'Dumbbell Hammer Curl', ar: 'مطرقة خارجي باي بالدامبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['brachialis'],
    secondaryMuscles: ['biceps', 'forearms'],
    equipment: ['dumbbell'],
    isUnilateral: false,
  },

  // ── Leg A ─────────────────────────────────────────────────────────────────
  dumbbell_deadlift: {
    name: { en: 'Dumbbell Deadlift', ar: 'القطنية بالدامبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back', 'forearms'],
    equipment: ['dumbbell'],
    isUnilateral: false,
  },
  leg_extension: {
    name: { en: 'Leg Extensions', ar: 'ماكينة رجل أمامي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    equipment: ['machine'],
    isUnilateral: false,
  },
  lying_leg_curl: {
    name: { en: 'Lying Leg Curls', ar: 'ماكينة رجل خلفي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
    equipment: ['machine'],
    isUnilateral: false,
  },
  leg_press: {
    name: { en: 'Leg Press', ar: 'مكبس' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: ['machine'],
    isUnilateral: false,
  },
  standing_calf_raise: {
    name: { en: 'Machine Standing Calf Raise', ar: 'سمانة وإنت واقف' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['machine'],
    isUnilateral: false,
  },
  seated_calf_raise: {
    name: { en: 'Seated Calf Raise', ar: 'سمانة وإنت قاعد' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['machine'],
    isUnilateral: false,
  },
  hip_thrust: {
    name: { en: 'Hip Thrust', ar: 'هيب ثرست' },
    arabicNameSource: 'supplied',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['barbell', 'bench'],
    isUnilateral: false,
  },

  // ── Upper B ───────────────────────────────────────────────────────────────
  flat_dumbbell_bench_press: {
    name: { en: 'Flat Dumbbell Bench Press', ar: 'دمبل بنش على الكرسي المسطح' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: false,
  },
  hammer_strength_incline_press: {
    name: { en: 'Hammer Strength Incline Chest Press', ar: 'ماكينة تقفيل بنش عالي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['upper_chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['machine'],
    isUnilateral: false,
  },
  wide_grip_lat_pulldown: {
    name: { en: 'Wide-Grip Lat Pulldown', ar: 'ماكينة ظهر أمامي واسع' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper_back'],
    equipment: ['cable'],
    isUnilateral: false,
  },
  seated_dumbbell_press: {
    name: { en: 'Seated Dumbbell Shoulder Press', ar: 'تقفيل كتف بالدامبل على كرسي الـ 90' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['side_delts', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: false,
  },
  leaning_lateral_raise: {
    name: { en: 'Leaning Dumbbell Lateral Raise', ar: 'رفرفة جانبي مائل بالدامبل' },
    arabicNameSource: 'supplied',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    isUnilateral: true,
  },
  barbell_skull_crusher: {
    name: { en: 'Barbell Skull Crushers (EZ Bar)', ar: 'بار تراي زجزاج وإنت على الأرض' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['ez_bar'],
    isUnilateral: false,
  },
  dumbbell_kickback: {
    name: { en: 'Triceps Dumbbell Kickback', ar: 'دامبل رفص تراي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: true,
  },
  overhead_cable_curl: {
    name: { en: 'One-Arm Overhead Cable Curl', ar: 'باي كابل علوي بذراع واحدة' },
    arabicNameSource: 'supplied',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    equipment: ['cable'],
    isUnilateral: true,
  },
  straight_barbell_curl: {
    name: { en: 'Straight Barbell Biceps Curl (Wide)', ar: 'باي بار مستقيم واسع' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['barbell'],
    isUnilateral: false,
  },

  // ── Lower B ───────────────────────────────────────────────────────────────
  hack_squat: {
    name: { en: 'Hack Squat', ar: 'هاك اسكوات' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['machine'],
    isUnilateral: false,
  },
  dumbbell_lunge: {
    name: { en: 'Dumbbell Lunge', ar: 'طعن بالدامبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['dumbbell'],
    isUnilateral: true,
  },
  leg_press_calf_raise: {
    name: { en: 'Leg Press Calf Raise', ar: 'سمانة على المكبس' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['machine'],
    isUnilateral: false,
  },
  dumbbell_wrist_curl: {
    name: { en: 'Seated Dumbbell Wrist Curl', ar: 'رست بالدامبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: false,
  },
  forearm_barbell_curl: {
    name: { en: 'Forearm Barbell Curl', ar: 'ساعد بالبار' },
    arabicNameSource: 'supplied',
    primaryMuscles: ['forearms'],
    secondaryMuscles: ['brachialis'],
    equipment: ['barbell'],
    isUnilateral: false,
  },
});

export type BuiltinExerciseId = keyof typeof EXERCISES;

/** Built-in seed rows, in program order. */
export const BUILTIN_EXERCISES: readonly Exercise[] = Object.values(EXERCISES);

export function getBuiltinExercise(id: string): Exercise | undefined {
  return isBuiltinExerciseId(id) ? EXERCISES[id] : undefined;
}

export function isBuiltinExerciseId(id: string): id is BuiltinExerciseId {
  return Object.prototype.hasOwnProperty.call(EXERCISES, id);
}

/** The authored columns of a built-in row (what the seed is allowed to refresh). */
export function builtinContent(exercise: Exercise): ExerciseContent {
  const { name, arabicNameSource, primaryMuscles, secondaryMuscles, equipment, weightType, isUnilateral, instructions, breathing, rangeOfMotion, commonMistakes, alternatives, videoId } = exercise;
  return { name, arabicNameSource, primaryMuscles, secondaryMuscles, equipment, weightType, isUnilateral, instructions, breathing, rangeOfMotion, commonMistakes, alternatives, videoId };
}

export const EQUIPMENT_LABELS: Record<Equipment, LocalizedText> = {
  barbell: { en: 'Barbell', ar: 'بار' },
  ez_bar: { en: 'EZ Bar', ar: 'بار متعرج' },
  dumbbell: { en: 'Dumbbell', ar: 'دمبل' },
  cable: { en: 'Cable', ar: 'كابل' },
  machine: { en: 'Machine', ar: 'ماكينة' },
  bench: { en: 'Bench', ar: 'مقعد' },
  bodyweight: { en: 'Bodyweight', ar: 'وزن الجسم' },
  kettlebell: { en: 'Kettlebell', ar: 'كيتل بل' },
  band: { en: 'Band', ar: 'حبل مطاطي' },
  other: { en: 'Other', ar: 'أخرى' },
};

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'chest', 'upper_chest', 'front_delts', 'side_delts', 'rear_delts', 'triceps', 'lats', 'upper_back', 'lower_back',
  'biceps', 'brachialis', 'forearms', 'abs', 'hip_flexors', 'quads', 'hamstrings', 'glutes', 'calves',
];

export const MUSCLE_LABELS: Record<MuscleGroup, LocalizedText> = {
  chest: { en: 'Chest', ar: 'الصدر' },
  upper_chest: { en: 'Upper Chest', ar: 'أعلى الصدر' },
  front_delts: { en: 'Front Delts', ar: 'الكتف الأمامي' },
  side_delts: { en: 'Side Delts', ar: 'الكتف الجانبي' },
  rear_delts: { en: 'Rear Delts', ar: 'الكتف الخلفي' },
  triceps: { en: 'Triceps', ar: 'التراي' },
  lats: { en: 'Lats', ar: 'المجانص' },
  upper_back: { en: 'Upper Back', ar: 'أعلى الظهر' },
  lower_back: { en: 'Lower Back', ar: 'أسفل الظهر' },
  biceps: { en: 'Biceps', ar: 'الباي' },
  brachialis: { en: 'Brachialis', ar: 'العضلة العضدية' },
  forearms: { en: 'Forearms', ar: 'الساعد' },
  abs: { en: 'Abs', ar: 'البطن' },
  hip_flexors: { en: 'Hip Flexors', ar: 'قابضات الحوض' },
  quads: { en: 'Quads', ar: 'الرجل الأمامي' },
  hamstrings: { en: 'Hamstrings', ar: 'الرجل الخلفي' },
  glutes: { en: 'Glutes', ar: 'الأرداف' },
  calves: { en: 'Calves', ar: 'السمانة' },
};

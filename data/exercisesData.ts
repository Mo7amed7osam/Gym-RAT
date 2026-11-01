import { hasExerciseImage } from '@/assets/exercises';
import type { Exercise, LocalizedText, MuscleGroup } from '@/types/workout';

/**
 * Exercise dictionary for "Push - Pull - Leg / Upper - Lower Ver 5.0".
 *
 * Names (EN + AR) come from the program PDF. Where the PDF has no Arabic name
 * (`arabicNameSource: 'supplied'`) the translation was added by us.
 * Form cues are authored coaching notes — the PDF only links demo videos.
 *
 * Per-day sets / reps / rest live in scheduleData.ts, because the same exercise
 * is programmed differently on different days (e.g. Seated Calf Raise).
 */

const YOUTUBE_SEARCH = 'https://www.youtube.com/results?search_query=';

export function youtubeSearchUrl(query: string): string {
  return `${YOUTUBE_SEARCH}${encodeURIComponent(query)}`;
}

type ExerciseInput = Omit<Exercise, 'id' | 'videoUrl' | 'thumbnailKey'> & {
  /** Overrides the default "<english name> proper form" search. */
  videoQuery?: string;
};

function defineExercises<K extends string>(defs: Record<K, ExerciseInput>): Record<K, Exercise> {
  const result = {} as Record<K, Exercise>;
  for (const id of Object.keys(defs) as K[]) {
    const { videoQuery, ...rest } = defs[id];
    result[id] = {
      ...rest,
      id,
      videoUrl: youtubeSearchUrl(videoQuery ?? `${rest.name.en} proper form`),
      // PDF photos are named after the exercise id.
      thumbnailKey: hasExerciseImage(id) ? id : undefined,
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
    formCues: [
      'Shoulder blades pinched, feet planted',
      'Bar to lower chest, elbows ~45°',
      'Pause, then drive up without bouncing',
    ],
  },
  incline_dumbbell_bench_press: {
    name: { en: 'Incline Dumbbell Bench Press', ar: 'تقفيل (تجميع) بنش على الكرسي العالي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['upper_chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: false,
    formCues: [
      'Bench at 30–45°',
      'Lower to upper chest with elbows slightly tucked',
      'Press up and slightly in, no clanking at the top',
    ],
  },
  pec_deck_fly: {
    name: { en: 'Pec Deck Fly Machine (Butterfly)', ar: 'تفتيح بنش على الماكينة (الفراشة)' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts'],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Handles at mid-chest height',
      'Soft elbows, hug a big tree',
      'Squeeze 1 s, open slowly to a full stretch',
    ],
  },
  high_low_cable_fly: {
    name: { en: 'High-to-Low Cable Chest Fly', ar: 'كابلات بنش من فوق لتحت' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts'],
    equipment: ['cable'],
    isUnilateral: false,
    formCues: [
      'Pulleys set high, staggered stance',
      'Sweep down and in toward the hips',
      'Keep the elbow angle fixed throughout',
    ],
  },
  overhead_dumbbell_press: {
    name: { en: 'Standing Overhead Dumbbell Press', ar: 'كتف واقف بالدمبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['side_delts', 'triceps'],
    equipment: ['dumbbell'],
    isUnilateral: false,
    videoQuery: 'perfect overhead dumbbell press form',
    formCues: [
      'Brace abs and glutes, no lower-back arch',
      'Start at ear level, press straight up',
      'Lock out overhead, lower under control',
    ],
  },
  dumbbell_lateral_raise: {
    name: { en: 'Dumbbell Lateral Raise', ar: 'رفرفة جانبي كتف' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: ['upper_back'],
    equipment: ['dumbbell'],
    isUnilateral: false,
    formCues: [
      'Slight forward lean, soft elbows',
      'Lead with the elbows to shoulder height',
      'No swinging — lower over 2–3 s',
    ],
  },
  dumbbell_skull_crusher: {
    name: { en: 'Dumbbell Skull Crushers', ar: 'دامبل تراي وإنت نايم على الأرض' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    isUnilateral: false,
    formCues: [
      'Lying on the floor, neutral grip',
      'Upper arms vertical and still',
      'Lower beside the head, extend fully',
    ],
  },
  triceps_rope_pushdown: {
    name: { en: 'Triceps Rope Pushdown', ar: 'تراي بالحبل على الماكينة' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['cable'],
    isUnilateral: false,
    formCues: [
      'Elbows pinned to your sides',
      'Push down and spread the rope at the bottom',
      'Control the return to ~90°',
    ],
  },
  lying_leg_raise: {
    name: { en: 'Flat Bench Lying Leg Raises', ar: 'بطن على الكرسي المسطح' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['hip_flexors'],
    equipment: ['bench', 'bodyweight'],
    isUnilateral: false,
    formCues: [
      'Grip the bench behind your head',
      'Lower back stays pressed down',
      'Raise legs to vertical, lower slowly',
    ],
  },

  // ── Pull A ────────────────────────────────────────────────────────────────
  dumbbell_bent_over_row: {
    name: { en: 'Single-Arm Dumbbell Bent-Over Row', ar: 'ون هاند (إيد واحدة)' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['upper_back', 'biceps', 'rear_delts'],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: true,
    formCues: [
      'Hand and knee on bench, flat back',
      'Pull the dumbbell to your hip',
      'Full stretch at the bottom, no torso twist',
    ],
  },
  seated_close_grip_row: {
    name: { en: 'Seated Close-Grip Cable Row', ar: 'سحب أرضي قبضة ضيقة' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['upper_back', 'lats'],
    secondaryMuscles: ['biceps', 'rear_delts'],
    equipment: ['cable'],
    isUnilateral: false,
    formCues: [
      'Chest up, slight knee bend',
      'Row to the belly, squeeze shoulder blades',
      'Let the shoulders reach forward on the return',
    ],
  },
  standing_lat_pushdown: {
    name: { en: 'Standing Lat Pushdown (Cable)', ar: 'ماكينة سحب ضهر بالبار وإنت واقف' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['triceps'],
    equipment: ['cable'],
    isUnilateral: false,
    videoQuery: 'standing straight arm lat pushdown cable form',
    formCues: [
      'Hinge slightly, arms nearly straight',
      'Sweep the bar down to your thighs',
      'Feel the lats stretch on the way up',
    ],
  },
  hammer_strength_lat_pulldown: {
    name: { en: 'Seated Lat Pulldown (Hammer Strength)', ar: 'الهامر' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper_back'],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Thighs locked under the pads',
      'Drive elbows down to your ribs',
      'Controlled stretch at the top',
    ],
  },
  dumbbell_front_raise: {
    name: { en: 'Dumbbell Front Raise', ar: 'رفرفة كتف أمامي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['upper_chest'],
    equipment: ['dumbbell'],
    isUnilateral: false,
    formCues: [
      'Stand tall, soft elbows',
      'Raise to eye level, no momentum',
      'Lower over 2–3 s',
    ],
  },
  reverse_pec_deck: {
    name: { en: 'Reverse Pec Deck Machine', ar: 'ماكينة كتف خلفي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['upper_back'],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Chest on the pad, handles at shoulder height',
      'Sweep arms back, lead with the elbows',
      "Don't pinch the shoulder blades hard",
    ],
  },
  close_grip_ez_bar_curl: {
    name: { en: 'Close-Grip EZ Bar Biceps Curl', ar: 'باي بار زجزاج ضيق' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['ez_bar'],
    isUnilateral: false,
    formCues: [
      'Elbows fixed at your sides',
      'Curl up without leaning back',
      'Full extension at the bottom',
    ],
  },
  dumbbell_hammer_curl: {
    name: { en: 'Dumbbell Hammer Curl', ar: 'مطرقة خارجي باي بالدامبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['brachialis'],
    secondaryMuscles: ['biceps', 'forearms'],
    equipment: ['dumbbell'],
    isUnilateral: false,
    formCues: [
      'Neutral (thumbs-up) grip',
      'Elbows still, curl to shoulder height',
      'Lower slowly, no swinging',
    ],
  },

  // ── Leg A ─────────────────────────────────────────────────────────────────
  dumbbell_deadlift: {
    name: { en: 'Dumbbell Deadlift', ar: 'القطنية بالدامبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back', 'forearms'],
    equipment: ['dumbbell'],
    isUnilateral: false,
    formCues: [
      'Hinge at the hips, neutral spine',
      'Dumbbells close to the legs',
      'Drive hips forward to stand tall',
    ],
  },
  leg_extension: {
    name: { en: 'Leg Extensions', ar: 'ماكينة رجل أمامي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Knee joint lined up with the machine pivot',
      'Extend fully and squeeze 1 s',
      'Lower under control',
    ],
  },
  lying_leg_curl: {
    name: { en: 'Lying Leg Curls', ar: 'ماكينة رجل خلفي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Hips pressed into the pad',
      'Curl heels toward glutes',
      'Slow 3 s negative',
    ],
  },
  leg_press: {
    name: { en: 'Leg Press', ar: 'مكبس' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Feet shoulder-width, mid-platform',
      'Lower until knees ~90°, hips stay down',
      "Press through heels, don't lock knees",
    ],
  },
  standing_calf_raise: {
    name: { en: 'Machine Standing Calf Raise', ar: 'سمانة وإنت واقف' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Balls of feet on the edge',
      'Full stretch at the bottom, pause',
      'Rise as high as possible, squeeze',
    ],
  },
  seated_calf_raise: {
    name: { en: 'Seated Calf Raise', ar: 'سمانة وإنت قاعد' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Pad snug on the lower thighs',
      'Deep stretch, 1 s pause at the bottom',
      'Drive up through the big toe',
    ],
  },
  hip_thrust: {
    name: { en: 'Hip Thrust', ar: 'هيب ثرست' },
    arabicNameSource: 'supplied',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['barbell', 'bench'],
    isUnilateral: false,
    formCues: [
      'Upper back on the bench edge',
      'Chin tucked, ribs down',
      'Drive hips to full lockout, squeeze glutes',
    ],
  },

  // ── Upper B ───────────────────────────────────────────────────────────────
  flat_dumbbell_bench_press: {
    name: { en: 'Flat Dumbbell Bench Press', ar: 'دمبل بنش على الكرسي المسطح' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: false,
    formCues: [
      'Shoulder blades back and down',
      'Lower to chest level with a deep stretch',
      'Press up in a slight arc',
    ],
  },
  hammer_strength_incline_press: {
    name: { en: 'Hammer Strength Incline Chest Press', ar: 'ماكينة تقفيل بنش عالي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['upper_chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Seat so handles line up with upper chest',
      'Keep chest up, shoulders down',
      "Press without locking out, control back",
    ],
  },
  wide_grip_lat_pulldown: {
    name: { en: 'Wide-Grip Lat Pulldown', ar: 'ماكينة ظهر أمامي واسع' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper_back'],
    equipment: ['cable'],
    isUnilateral: false,
    formCues: [
      'Grip just outside shoulder width',
      'Pull to the upper chest, lean back slightly',
      'Full stretch overhead each rep',
    ],
  },
  seated_dumbbell_press: {
    name: { en: 'Seated Dumbbell Shoulder Press', ar: 'تقفيل كتف بالدامبل على كرسي الـ 90' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['side_delts', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: false,
    formCues: [
      'Bench upright at 90°, back flat',
      'Lower to ear level',
      'Press up and slightly together',
    ],
  },
  leaning_lateral_raise: {
    name: { en: 'Leaning Dumbbell Lateral Raise', ar: 'رفرفة جانبي مائل بالدامبل' },
    arabicNameSource: 'supplied',
    primaryMuscles: ['side_delts'],
    secondaryMuscles: [],
    equipment: ['dumbbell'],
    isUnilateral: true,
    formCues: [
      'Hold a post and lean away',
      'Raise to shoulder height, lead with the elbow',
      'Slow negative, then switch sides',
    ],
  },
  barbell_skull_crusher: {
    name: { en: 'Barbell Skull Crushers (EZ Bar)', ar: 'بار تراي زجزاج وإنت على الأرض' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['ez_bar'],
    isUnilateral: false,
    videoQuery: 'EZ bar skull crushers proper form',
    formCues: [
      'Lying on the floor, upper arms angled slightly back',
      'Lower the bar toward your forehead',
      'Extend without flaring elbows',
    ],
  },
  dumbbell_kickback: {
    name: { en: 'Triceps Dumbbell Kickback', ar: 'دامبل رفص تراي' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: true,
    formCues: [
      'Torso near parallel, upper arm by your side',
      'Extend until the arm is straight',
      'Squeeze 1 s, lower slowly',
    ],
  },
  overhead_cable_curl: {
    name: { en: 'One-Arm Overhead Cable Curl', ar: 'باي كابل علوي بذراع واحدة' },
    arabicNameSource: 'supplied',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    equipment: ['cable'],
    isUnilateral: true,
    formCues: [
      'Pulley at shoulder height or above',
      'Arm out to the side, elbow fixed',
      'Curl toward your head, squeeze the peak',
    ],
  },
  straight_barbell_curl: {
    name: { en: 'Straight Barbell Biceps Curl (Wide)', ar: 'باي بار مستقيم واسع' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: ['barbell'],
    isUnilateral: false,
    formCues: [
      'Grip slightly wider than shoulders',
      'Elbows still, no hip swing',
      'Full range top to bottom',
    ],
  },

  // ── Lower B ───────────────────────────────────────────────────────────────
  hack_squat: {
    name: { en: 'Hack Squat', ar: 'هاك اسكوات' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Back flat on the pad, feet mid-platform',
      'Descend until thighs are parallel or lower',
      'Drive up through the whole foot',
    ],
  },
  dumbbell_lunge: {
    name: { en: 'Dumbbell Lunge', ar: 'طعن بالدامبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    equipment: ['dumbbell'],
    isUnilateral: true,
    formCues: [
      'Long step, torso upright',
      'Back knee lowers toward the floor',
      'Push through the front heel',
    ],
  },
  leg_press_calf_raise: {
    name: { en: 'Leg Press Calf Raise', ar: 'سمانة على المكبس' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: ['machine'],
    isUnilateral: false,
    formCues: [
      'Balls of feet on the platform edge',
      'Knees soft but fixed',
      'Full stretch, full press',
    ],
  },
  dumbbell_wrist_curl: {
    name: { en: 'Seated Dumbbell Wrist Curl', ar: 'رست بالدامبل' },
    arabicNameSource: 'pdf',
    primaryMuscles: ['forearms'],
    secondaryMuscles: [],
    equipment: ['dumbbell', 'bench'],
    isUnilateral: false,
    formCues: [
      'Forearms on thighs, wrists past the knees',
      'Let the dumbbell roll to the fingertips',
      'Curl the wrist up and squeeze',
    ],
  },
  forearm_barbell_curl: {
    name: { en: 'Forearm Barbell Curl', ar: 'ساعد بالبار' },
    arabicNameSource: 'supplied',
    primaryMuscles: ['forearms'],
    secondaryMuscles: ['brachialis'],
    equipment: ['barbell'],
    isUnilateral: false,
    videoQuery: 'barbell reverse curl forearms proper form',
    formCues: [
      'Overhand grip, shoulder width',
      'Elbows tight to the sides',
      'Curl up, lower over 3 s',
    ],
  },
});

export type ExerciseId = keyof typeof EXERCISES;

export const EXERCISE_LIST: readonly Exercise[] = Object.values(EXERCISES);

export function getExercise(id: string): Exercise | undefined {
  return isExerciseId(id) ? EXERCISES[id] : undefined;
}

export function isExerciseId(id: string): id is ExerciseId {
  return Object.prototype.hasOwnProperty.call(EXERCISES, id);
}

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

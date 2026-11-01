import type {
  CardioDay,
  DaySchedule,
  ExercisePrescription,
  RepRange,
  RestDay,
  RestPeriod,
  RoutineId,
  TrainingDay,
  Weekday,
} from '@/types/workout';
import type { ExerciseId } from './exercisesData';

/**
 * Weekly split from "Push - Pull - Leg / Upper - Lower Ver 5.0".
 * Sets / reps / rest are copied from the PDF tables (p.6, 12, 17, 21, 27).
 */

// PDF rest values are either "2 دقيقة" or "1 - 2 دقيقة".
const REST_2_MIN: RestPeriod = { defaultSeconds: 120, minSeconds: 120, maxSeconds: 120 };
const REST_1_TO_2_MIN: RestPeriod = { defaultSeconds: 90, minSeconds: 60, maxSeconds: 120 };

function reps(min: number, max: number = min): RepRange {
  return { min, max };
}

function rx(exerciseId: ExerciseId, sets: number, repRange: RepRange, rest: RestPeriod): ExercisePrescription {
  return { exerciseId, sets, reps: repRange, rest };
}

export const WEEKDAYS: readonly Weekday[] = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

const WEEKDAY_NAMES = {
  saturday: { en: 'Saturday', ar: 'السبت' },
  sunday: { en: 'Sunday', ar: 'الأحد' },
  monday: { en: 'Monday', ar: 'الإثنين' },
  tuesday: { en: 'Tuesday', ar: 'الثلاثاء' },
  wednesday: { en: 'Wednesday', ar: 'الأربعاء' },
  thursday: { en: 'Thursday', ar: 'الخميس' },
  friday: { en: 'Friday', ar: 'الجمعة' },
} as const;

function base(weekday: Weekday) {
  return {
    weekday,
    dayIndex: WEEKDAYS.indexOf(weekday),
    weekdayName: WEEKDAY_NAMES[weekday],
  };
}

const PUSH_A: TrainingDay = {
  ...base('saturday'),
  kind: 'training',
  routineId: 'push_a',
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
};

const PULL_A: TrainingDay = {
  ...base('sunday'),
  kind: 'training',
  routineId: 'pull_a',
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
};

const LEG_A: TrainingDay = {
  ...base('monday'),
  kind: 'training',
  routineId: 'leg_a',
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
};

const CARDIO_TUESDAY: CardioDay = {
  ...base('tuesday'),
  kind: 'cardio',
  title: { en: 'Light Cardio & Recovery', ar: 'تمرين كارديو خفيف' },
  durationMinutes: { min: 20, max: 30 },
  activities: [
    {
      id: 'incline_walk',
      name: { en: 'Treadmill walk / incline walk', ar: 'مشي على المشاية' },
      durationMinutes: { min: 20, max: 30 },
      intensity: { en: 'Easy — you can hold a conversation', ar: 'هادي — تقدر تتكلم وانت بتمشي' },
    },
    {
      id: 'stationary_bike',
      name: { en: 'Stationary bike', ar: 'عجلة ثابتة' },
      durationMinutes: { min: 20, max: 30 },
      intensity: { en: 'Easy, steady cadence', ar: 'سرعة هادية وثابتة' },
    },
    {
      id: 'elliptical',
      name: { en: 'Elliptical', ar: 'الإليبتكال' },
      durationMinutes: { min: 20, max: 30 },
      intensity: { en: 'Easy, steady pace', ar: 'سرعة هادية وثابتة' },
    },
  ],
  recoveryRoutineIds: ['dynamic_warmup', 'static_cooldown'],
};

const UPPER_B: TrainingDay = {
  ...base('wednesday'),
  kind: 'training',
  routineId: 'upper_b',
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
};

const LOWER_B: TrainingDay = {
  ...base('thursday'),
  kind: 'training',
  routineId: 'lower_b',
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
};

const REST_FRIDAY: RestDay = {
  ...base('friday'),
  kind: 'rest',
  title: { en: 'Full Rest', ar: 'راحة كاملة' },
  note: {
    en: 'Full rest — no training or cardio.',
    ar: 'راحة كاملة (ممنوع التمرين أو الكارديو)',
  },
};

export const WEEKLY_SCHEDULE: Record<Weekday, DaySchedule> = {
  saturday: PUSH_A,
  sunday: PULL_A,
  monday: LEG_A,
  tuesday: CARDIO_TUESDAY,
  wednesday: UPPER_B,
  thursday: LOWER_B,
  friday: REST_FRIDAY,
};

export const ROUTINES: Record<RoutineId, TrainingDay> = {
  push_a: PUSH_A,
  pull_a: PULL_A,
  leg_a: LEG_A,
  upper_b: UPPER_B,
  lower_b: LOWER_B,
};

export const PROGRAM_INFO = {
  name: { en: 'Push - Pull - Leg / Upper - Lower', ar: 'البرنامج التدريبي' },
  version: '5.0',
  description: {
    en: 'Push, pull and leg days for strength, then upper and lower days for hypertrophy.',
    ar: 'فكرة البرنامج تعتمد على تقسيم عضلات الجسم على ثلاث أيام ما بين عضلات الدفع والسحب والرجل ثم تكرارها مرة ثانية على يومين لعضلات الجزء العلوي والسفلي',
  },
  focusLabels: {
    strength: { en: 'Strength', ar: 'قوة' },
    hypertrophy: { en: 'Hypertrophy', ar: 'ضخامة' },
  },
} as const;

/** JS getDay(): 0 = Sunday … 6 = Saturday. Program week: 0 = Saturday … 6 = Friday. */
export function weekdayFromDate(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 1) % 7];
}

export function getDaySchedule(weekday: Weekday): DaySchedule {
  return WEEKLY_SCHEDULE[weekday];
}

export function getTrainingDays(): TrainingDay[] {
  return WEEKDAYS.map((day) => WEEKLY_SCHEDULE[day]).filter(
    (day): day is TrainingDay => day.kind === 'training',
  );
}

/** Rough session length: ~45 s per working set plus prescribed rest, plus 15 min warm-up/cool-down. */
export function estimateDurationMinutes(day: TrainingDay): number {
  const WORK_SECONDS_PER_SET = 45;
  const WARMUP_COOLDOWN_SECONDS = 15 * 60;
  const seconds = day.exercises.reduce(
    (total, item) => total + item.sets * (WORK_SECONDS_PER_SET + item.rest.defaultSeconds),
    WARMUP_COOLDOWN_SECONDS,
  );
  return Math.round(seconds / 60);
}

export function getTotalSets(day: TrainingDay): number {
  return day.exercises.reduce((total, item) => total + item.sets, 0);
}

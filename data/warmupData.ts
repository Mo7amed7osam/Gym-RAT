import type {
  LocalizedText,
  StretchRoutine,
  StretchRoutineId,
  WarmupStage,
} from '@/types/workout';

/**
 * Warm-up, stretching and coach notes from the program PDF
 * (p.2–3 warm-up stages + dynamic routine, p.32–33 notes + static stretches,
 * p.35 pre-workout stretches).
 */

export const WARMUP_STAGES: readonly WarmupStage[] = [
  {
    id: 'treadmill',
    order: 1,
    title: { en: 'Walk or light jog', ar: 'التسخين بالجري على المشاية' },
    detail: {
      en: 'Treadmill, 5–10 min at an easy pace',
      ar: 'التسخين بالجري على المشاية لمدة 5 - 10 دقائق بسرعة هادئة',
    },
    durationMinutes: { min: 5, max: 10 },
  },
  {
    id: 'dynamic_stretches',
    order: 2,
    title: { en: 'Dynamic stretches', ar: 'Dynamic Stretches' },
    detail: {
      en: 'Move every joint through its range — helps prevent injury',
      ar: 'عمل Dynamic Stretches (بتساعد على عدم الإصابة)',
    },
    routineId: 'dynamic_warmup',
  },
  {
    id: 'acclimation_sets',
    order: 3,
    title: { en: 'Light acclimation sets', ar: 'التسخين بأول زاوية' },
    detail: {
      en: 'First exercise of the day with light weight and high reps',
      ar: 'التسخين بأول زاوية بأوزان خفيفة تكرارات كثيرة',
    },
  },
];

export const STRETCH_ROUTINES: Record<StretchRoutineId, StretchRoutine> = {
  dynamic_warmup: {
    id: 'dynamic_warmup',
    title: { en: 'Dynamic warm-up', ar: 'إحماء ديناميكي' },
    description: {
      en: 'Follow this warm-up routine before exercising.',
      ar: 'اتبع روتين الإحماء ده قبل التمرين.',
    },
    moves: [
      {
        id: 'jogging',
        name: { en: 'Jogging', ar: 'جري في المكان' },
        instruction: { en: 'Light jog on the spot.', ar: 'جري خفيف في المكان.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'marching',
        name: { en: 'Marching', ar: 'مشي عسكري' },
        instruction: { en: 'Drive knees up to hip height.', ar: 'ارفع الركبة لمستوى الحوض بالتبادل.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'back_kicks',
        name: { en: 'Back-kicking exercise', ar: 'ركل للخلف' },
        instruction: { en: 'Kick heels toward your glutes.', ar: 'اركل الكعب ناحية الأرداف بالتبادل.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'front_kicks',
        name: { en: 'Front-kicking exercise', ar: 'ركل للأمام' },
        instruction: { en: 'Straight-leg kick toward the opposite hand.', ar: 'ارفع الرجل مفرودة للأمام ناحية الإيد العكسية.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'hands_in_air',
        name: { en: 'Hands-in-the-air exercise', ar: 'رفع الإيدين لفوق' },
        instruction: { en: 'Reach both arms overhead and stretch tall.', ar: 'ارفع الإيدين فوق راسك واتمدد لفوق.' },
        holdSeconds: 15,
        bothSides: false,
      },
      {
        id: 'foot_touching',
        name: { en: 'Foot-touching exercise', ar: 'لمس القدم' },
        instruction: { en: 'Hinge and touch your toes, alternate sides.', ar: 'انحني والمس صوابع رجلك بالتبادل.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'knee_bending',
        name: { en: 'Knee-bending exercise', ar: 'ثني الركبة' },
        instruction: { en: 'Shallow bodyweight squats, hands forward.', ar: 'نزول خفيف بوزن الجسم والإيدين قدامك.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'ankle_holding',
        name: { en: 'Ankle-holding stretch', ar: 'مسك الكاحل' },
        instruction: { en: 'Fold forward and hold your ankles.', ar: 'انحني للأمام وامسك الكاحل.' },
        holdSeconds: 15,
        bothSides: false,
      },
      {
        id: 'arm_leg_torso',
        name: { en: 'Arm, leg and torso stretch', ar: 'إطالة الذراع والرجل والجذع' },
        instruction: { en: 'Side lunge with an overhead side reach.', ar: 'طعن جانبي مع مد الذراع فوق الراس.' },
        holdSeconds: 15,
        bothSides: true,
      },
    ],
  },

  pre_workout_stretches: {
    id: 'pre_workout_stretches',
    title: { en: 'Pre-workout stretches', ar: 'إطالات قبل التمرين' },
    description: { en: '10–20 seconds each.', ar: 'من 10 إلى 20 ثانية لكل حركة.' },
    posterKey: 'pre_workout_stretches',
    moves: [
      {
        id: 'dynamic_chest',
        name: { en: 'Dynamic chest', ar: 'فتح الصدر' },
        instruction: { en: 'Swing arms open and closed at chest height.', ar: 'افتح واقفل الذراعين على مستوى الصدر.' },
        holdSeconds: 15,
        bothSides: false,
      },
      {
        id: 'triceps',
        name: { en: 'Triceps', ar: 'التراي' },
        instruction: { en: 'Hand behind head, gently push the elbow.', ar: 'الإيد ورا الراس وزق الكوع بالإيد التانية.' },
        holdSeconds: 15,
        bothSides: true,
      },
      {
        id: 'shoulder',
        name: { en: 'Shoulder', ar: 'الكتف' },
        instruction: { en: 'Pull the arm across your chest.', ar: 'اسحب الدراع قدام صدرك.' },
        holdSeconds: 15,
        bothSides: true,
      },
      {
        id: 'groin_back',
        name: { en: 'Groin and back', ar: 'الحوض والظهر' },
        instruction: { en: 'Seated, soles together, fold forward.', ar: 'اقعد وضم باطن القدمين وانحني للأمام.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'standing_toe',
        name: { en: 'Standing toe touch', ar: 'لمس الصوابع واقف' },
        instruction: { en: 'Soft knees, reach for your toes.', ar: 'ركبة مرنة وحاول تلمس صوابع رجلك.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'calf_wall',
        name: { en: 'Calf (hands against wall)', ar: 'السمانة على الحيطة' },
        instruction: { en: 'Back heel down, lean into the wall.', ar: 'الكعب الخلفي على الأرض واتسند على الحيطة.' },
        holdSeconds: 20,
        bothSides: true,
      },
    ],
  },

  static_cooldown: {
    id: 'static_cooldown',
    title: { en: 'Static stretches', ar: 'Static Stretches' },
    description: {
      en: 'Hold each for 20 seconds after training to help recovery.',
      ar: 'قم بعمل Static Stretches بعد نهاية التمرين حتى تساعدك على الاستشفاء من الإجهاد العضلي',
    },
    posterKey: 'static_cooldown',
    moves: [
      {
        id: 'full_body',
        name: { en: 'Full body stretch', ar: 'إطالة الجسم كامل' },
        instruction: { en: 'Reach overhead as high as you can.', ar: 'مد إيديك لفوق على قد ما تقدر.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'side_body',
        name: { en: 'Side body stretch', ar: 'إطالة الجنب' },
        instruction: { en: 'Arm overhead, lean to the side.', ar: 'الإيد فوق الراس ومِيل للجنب.' },
        holdSeconds: 20,
        bothSides: true,
      },
      {
        id: 'shoulder',
        name: { en: 'Shoulder stretch', ar: 'إطالة الكتف' },
        instruction: { en: 'Hand above elbow, pull arm in.', ar: 'الإيد فوق الكوع واسحب الدراع ناحيتك.' },
        holdSeconds: 20,
        bothSides: true,
      },
      {
        id: 'tricep',
        name: { en: 'Tricep stretch', ar: 'إطالة التراي' },
        instruction: { en: 'Hand behind head, push the elbow down.', ar: 'الإيد ورا الراس وزق الكوع لتحت.' },
        holdSeconds: 20,
        bothSides: true,
      },
      {
        id: 'bicep_forearm',
        name: { en: 'Bicep / forearm stretch', ar: 'إطالة الباي والساعد' },
        instruction: { en: 'Arm straight, pull the fingers back.', ar: 'الدراع مفرود واسحب الصوابع لورا.' },
        holdSeconds: 20,
        bothSides: true,
      },
      {
        id: 'upper_chest_shoulder',
        name: { en: 'Upper chest / shoulder', ar: 'أعلى الصدر والكتف' },
        instruction: { en: 'Interlace hands behind you, lift and open.', ar: 'شبّك إيديك ورا ضهرك وارفعهم وافتح صدرك.' },
        holdSeconds: 20,
        bothSides: false,
      },
      {
        id: 'quadricep',
        name: { en: 'Quadricep stretch', ar: 'إطالة الرجل الأمامي' },
        instruction: { en: 'Pull your heel to your glutes, knees together.', ar: 'اسحب الكعب ناحية الأرداف والركب جنب بعض.' },
        holdSeconds: 20,
        bothSides: true,
      },
      {
        id: 'calf',
        name: { en: 'Calf stretch', ar: 'إطالة السمانة' },
        instruction: { en: 'Toes on a wall, lean in.', ar: 'صوابع رجلك على الحيطة واميل لقدام.' },
        holdSeconds: 20,
        bothSides: true,
      },
      {
        id: 'hamstring',
        name: { en: 'Hamstring stretch', ar: 'إطالة الرجل الخلفي' },
        instruction: { en: 'Heel forward, hinge at the hips.', ar: 'الكعب لقدام وانحني من الحوض.' },
        holdSeconds: 20,
        bothSides: true,
      },
    ],
  },
};

/** General program notes (PDF p.32). */
export const COACH_NOTES: readonly LocalizedText[] = [
  {
    en: "Don't chase the total workout time — focus on form and the mind–muscle connection.",
    ar: 'لا تهتم بزمن التمرين الكلي واهتم بصحة الأداء والتركيز في صلة العقل بالعضلة التي تمرنها',
  },
  {
    en: 'Sip water during and after training whenever you feel thirsty.',
    ar: 'قم بشرب الماء أثناء التمرين وبعد التمرين برشفات قليلة بشكل مستمر كلما شعرت بشيء من العطش',
  },
  {
    en: 'Do static stretches after training to recover from muscle fatigue.',
    ar: 'قم بعمل Static Stretches بعد نهاية التمرين حتى تساعدك على الاستشفاء من الإجهاد العضلي',
  },
];

/** Total seconds for a stretch routine, counting both sides where needed. */
export function getStretchRoutineSeconds(routine: StretchRoutine): number {
  return routine.moves.reduce((total, move) => total + move.holdSeconds * (move.bothSides ? 2 : 1), 0);
}

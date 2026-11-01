import type { LocalizedText, WeightType } from '@/types/workout';

/**
 * Authored instructional content for the built-in exercises (Phase 2, P2.1).
 * English written for the app; Arabic machine-authored first draft, pending
 * owner review (D8). Keyed by exercise id; merged into the seed by
 * `data/exercisesData.ts`. Illustrations are a separate concern (media manifest).
 */

export interface ExerciseContentInput {
  weightType: WeightType;
  /** Technique steps in order; the first two double as the workout card cues. */
  instructions: LocalizedText[];
  breathing: LocalizedText | null;
  rangeOfMotion: LocalizedText | null;
  commonMistakes: LocalizedText[];
  /** Same-muscle substitutes, best first. */
  alternatives: string[];
}

const t = (en: string, ar: string): LocalizedText => ({ en, ar });

const EXHALE_UP = t('Inhale on the way down, exhale as you press up.', 'خذ شهيقًا أثناء النزول، وزفيرًا أثناء الدفع للأعلى.');
const EXHALE_PULL = t('Exhale as you pull, inhale as you return.', 'زفير أثناء السحب، وشهيق أثناء الرجوع.');
const EXHALE_EFFORT = t('Exhale on the effort, inhale as you lower.', 'زفير مع المجهود، وشهيق أثناء النزول.');

export const EXERCISE_CONTENT: Record<string, ExerciseContentInput> = {
  // ── Push A ────────────────────────────────────────────────────────────────
  flat_barbell_bench_press: {
    weightType: 'total',
    instructions: [
      t('Shoulder blades pinched, feet planted, slight arch.', 'اضغط لوحي الكتف معًا، ثبّت القدمين، تقوّس خفيف في الظهر.'),
      t('Lower the bar to the lower chest with elbows at about 45°.', 'أنزل البار إلى أسفل الصدر مع فتح المرفقين بزاوية 45° تقريبًا.'),
      t('Pause briefly, then drive up without bouncing.', 'توقف لحظة ثم ادفع للأعلى دون ارتداد.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Bar touches the chest, elbows fully extended at the top.', 'البار يلمس الصدر، ومد المرفقين بالكامل في الأعلى.'),
    commonMistakes: [
      t('Flaring the elbows to 90°, which strains the shoulders.', 'فتح المرفقين بزاوية 90° مما يجهد الكتفين.'),
      t('Lifting the hips off the bench.', 'رفع الوركين عن المقعد.'),
    ],
    alternatives: ['flat_dumbbell_bench_press', 'hammer_strength_incline_press'],
  },
  incline_dumbbell_bench_press: {
    weightType: 'per_hand',
    instructions: [
      t('Set the bench to 30–45°.', 'اضبط المقعد على زاوية 30–45°.'),
      t('Lower to the upper chest with elbows slightly tucked.', 'أنزل الدمبل إلى أعلى الصدر مع ضم المرفقين قليلًا.'),
      t('Press up and slightly inward; do not clank the dumbbells.', 'ادفع للأعلى وللداخل قليلًا دون أن يصطدم الدمبلان.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Dumbbells level with the chest at the bottom, arms extended at the top.', 'الدمبل بمستوى الصدر في الأسفل، والذراعان ممدودتان في الأعلى.'),
    commonMistakes: [t('Bench too steep, turning it into a shoulder press.', 'المقعد مرتفع جدًا فيتحول التمرين إلى ضغط كتف.')],
    alternatives: ['hammer_strength_incline_press', 'flat_dumbbell_bench_press'],
  },
  pec_deck_fly: {
    weightType: 'total',
    instructions: [
      t('Set the handles at mid-chest height.', 'اضبط المقابض عند منتصف الصدر.'),
      t('Keep soft elbows and hug a big tree.', 'أبقِ المرفقين مرنين كأنك تعانق شجرة كبيرة.'),
      t('Squeeze for a second, then open slowly to a full stretch.', 'اضغط ثانية ثم افتح ببطء حتى تمدد كامل.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Handles meet in front of the chest; open until a stretch, not pain.', 'المقابض تلتقي أمام الصدر؛ افتح حتى تشعر بالتمدد لا بالألم.'),
    commonMistakes: [t('Using the shoulders and momentum instead of the chest.', 'استخدام الكتفين والدفع بدلًا من الصدر.')],
    alternatives: ['high_low_cable_fly', 'flat_dumbbell_bench_press'],
  },
  high_low_cable_fly: {
    weightType: 'total',
    instructions: [
      t('Set the pulleys high and take a staggered stance.', 'اضبط البكرات عاليًا وقف بقدم أمام الأخرى.'),
      t('Sweep the handles down and in toward the hips.', 'اسحب المقابض للأسفل وللداخل باتجاه الوركين.'),
      t('Keep the elbow angle fixed throughout.', 'حافظ على زاوية المرفق ثابتة طوال الحركة.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Hands meet below the chest; return until the chest stretches.', 'اليدان تلتقيان أسفل الصدر؛ ارجع حتى يتمدد الصدر.'),
    commonMistakes: [t('Bending the elbows to press instead of fly.', 'ثني المرفقين فيتحول التمرين إلى ضغط بدل التفتيح.')],
    alternatives: ['pec_deck_fly'],
  },
  overhead_dumbbell_press: {
    weightType: 'per_hand',
    instructions: [
      t('Brace the abs and glutes; no lower-back arch.', 'شد البطن والأرداف؛ لا تقوس أسفل الظهر.'),
      t('Start at ear level and press straight up.', 'ابدأ بمستوى الأذن وادفع للأعلى مباشرة.'),
      t('Lock out overhead, then lower under control.', 'مد الذراعين فوق الرأس ثم أنزل ببطء.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Dumbbells from ear level to full lockout.', 'من مستوى الأذن حتى مد الذراعين بالكامل.'),
    commonMistakes: [t('Leaning back and pressing with the chest.', 'الميل للخلف والدفع بالصدر.')],
    alternatives: ['seated_dumbbell_press'],
  },
  dumbbell_lateral_raise: {
    weightType: 'per_hand',
    instructions: [
      t('Slight forward lean, soft elbows.', 'ميل خفيف للأمام والمرفقان مرنان.'),
      t('Lead with the elbows up to shoulder height.', 'ارفع بقيادة المرفقين حتى مستوى الكتف.'),
      t('No swinging; lower over 2–3 seconds.', 'دون تأرجح؛ أنزل خلال 2–3 ثوانٍ.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('From the sides of the thighs to shoulder height.', 'من جانب الفخذين حتى مستوى الكتف.'),
    commonMistakes: [t('Shrugging the traps as the weight rises.', 'رفع الكتفين (الترابيس) مع الوزن.')],
    alternatives: ['leaning_lateral_raise'],
  },
  dumbbell_skull_crusher: {
    weightType: 'per_hand',
    instructions: [
      t('Lie down with a neutral grip.', 'استلقِ وأمسك الدمبل بقبضة محايدة.'),
      t('Keep the upper arms vertical and still.', 'أبقِ العضد عموديًا وثابتًا.'),
      t('Lower beside the head, then extend fully.', 'أنزل بجانب الرأس ثم مد الذراعين بالكامل.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Forearms past parallel at the bottom, full extension at the top.', 'الساعدان يتجاوزان التوازي في الأسفل، ومد كامل في الأعلى.'),
    commonMistakes: [t('Letting the elbows drift outward.', 'ترك المرفقين ينفرجان للخارج.')],
    alternatives: ['barbell_skull_crusher', 'triceps_rope_pushdown'],
  },
  triceps_rope_pushdown: {
    weightType: 'total',
    instructions: [
      t('Elbows pinned to the sides.', 'ثبّت المرفقين بجانب الجسم.'),
      t('Push down and split the rope at the bottom.', 'ادفع للأسفل وافصل طرفي الحبل في النهاية.'),
      t('Return only to forearm-parallel.', 'ارجع فقط حتى يوازي الساعد الأرض.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Forearms from parallel to full extension.', 'الساعدان من التوازي حتى المد الكامل.'),
    commonMistakes: [t('Leaning over the cable and using bodyweight.', 'الميل فوق الكابل واستخدام وزن الجسم.')],
    alternatives: ['dumbbell_kickback', 'dumbbell_skull_crusher'],
  },
  lying_leg_raise: {
    weightType: 'bodyweight',
    instructions: [
      t('Lie on the bench and hold it behind your head.', 'استلقِ على المقعد وأمسك به خلف رأسك.'),
      t('Raise straight legs to vertical.', 'ارفع الساقين مستقيمتين حتى الوضع العمودي.'),
      t('Lower slowly without touching down.', 'أنزل ببطء دون لمس المقعد.'),
    ],
    breathing: t('Exhale as the legs rise, inhale as they lower.', 'زفير مع رفع الساقين، وشهيق أثناء نزولهما.'),
    rangeOfMotion: t('Legs from just above the bench to vertical.', 'الساقان من فوق المقعد مباشرة حتى الوضع العمودي.'),
    commonMistakes: [t('Arching the lower back off the bench.', 'تقويس أسفل الظهر ورفعه عن المقعد.')],
    alternatives: [],
  },
  // ── Pull A ────────────────────────────────────────────────────────────────
  dumbbell_bent_over_row: {
    weightType: 'per_hand',
    instructions: [
      t('Knee and hand on the bench, back flat.', 'ركبة ويد على المقعد والظهر مستقيم.'),
      t('Row toward the hip, not the shoulder.', 'اسحب باتجاه الورك لا الكتف.'),
      t('Lower to a full stretch.', 'أنزل حتى تمدد كامل.'),
    ],
    breathing: EXHALE_PULL,
    rangeOfMotion: t('From a full hang to the dumbbell at the hip.', 'من التعليق الكامل حتى يصل الدمبل إلى الورك.'),
    commonMistakes: [t('Twisting the torso to lift more weight.', 'لف الجذع لرفع وزن أكبر.')],
    alternatives: ['seated_close_grip_row'],
  },
  seated_close_grip_row: {
    weightType: 'total',
    instructions: [
      t('Chest up, slight knee bend.', 'الصدر مرفوع والركبتان مثنيتان قليلًا.'),
      t('Pull the handle to the navel and squeeze the shoulder blades.', 'اسحب المقبض إلى السرة واضغط لوحي الكتف.'),
      t('Let the shoulders reach forward on the return.', 'دع الكتفين يمتدان للأمام أثناء الرجوع.'),
    ],
    breathing: EXHALE_PULL,
    rangeOfMotion: t('Arms fully extended to the handle at the navel.', 'من مد الذراعين بالكامل حتى المقبض عند السرة.'),
    commonMistakes: [t('Rocking the torso back and forth.', 'هز الجذع للأمام والخلف.')],
    alternatives: ['dumbbell_bent_over_row', 'hammer_strength_lat_pulldown'],
  },
  standing_lat_pushdown: {
    weightType: 'total',
    instructions: [
      t('Hinge slightly, arms straight with soft elbows.', 'انحنِ قليلًا والذراعان مستقيمتان مع مرفقين مرنين.'),
      t('Pull the bar down to the thighs with the lats.', 'اسحب البار إلى الفخذين باستخدام المجانص.'),
      t('Return to shoulder height under control.', 'ارجع إلى مستوى الكتف بتحكم.'),
    ],
    breathing: EXHALE_PULL,
    rangeOfMotion: t('Bar from shoulder height down to the thighs.', 'البار من مستوى الكتف حتى الفخذين.'),
    commonMistakes: [t('Bending the elbows and turning it into a pushdown.', 'ثني المرفقين فيتحول التمرين إلى تراي.')],
    alternatives: ['wide_grip_lat_pulldown'],
  },
  hammer_strength_lat_pulldown: {
    weightType: 'total',
    instructions: [
      t('Thighs locked under the pads, chest up.', 'ثبّت الفخذين تحت الوسائد والصدر مرفوع.'),
      t('Drive the elbows down and back.', 'ادفع المرفقين للأسفل وللخلف.'),
      t('Return to a full stretch at the top.', 'ارجع حتى تمدد كامل في الأعلى.'),
    ],
    breathing: EXHALE_PULL,
    rangeOfMotion: t('Handles from full extension to chest level.', 'المقابض من المد الكامل حتى مستوى الصدر.'),
    commonMistakes: [t('Leaning far back and pulling with the arms.', 'الميل بعيدًا للخلف والسحب بالذراعين.')],
    alternatives: ['wide_grip_lat_pulldown', 'seated_close_grip_row'],
  },
  dumbbell_front_raise: {
    weightType: 'per_hand',
    instructions: [
      t('Stand tall, dumbbells on the thighs.', 'قف منتصبًا والدمبل على الفخذين.'),
      t('Raise to eye level with straight arms.', 'ارفع حتى مستوى العين بذراعين مستقيمتين.'),
      t('Lower slowly without swinging.', 'أنزل ببطء دون تأرجح.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Thighs to eye level.', 'من الفخذين حتى مستوى العين.'),
    commonMistakes: [t('Using momentum from the hips.', 'الدفع بالوركين.')],
    alternatives: ['overhead_dumbbell_press'],
  },
  reverse_pec_deck: {
    weightType: 'total',
    instructions: [
      t('Chest against the pad, handles in front.', 'الصدر على الوسادة والمقابض أمامك.'),
      t('Open the arms back in a wide arc.', 'افتح الذراعين للخلف في قوس واسع.'),
      t('Pause, then return slowly.', 'توقف لحظة ثم ارجع ببطء.'),
    ],
    breathing: EXHALE_PULL,
    rangeOfMotion: t('Handles from in front of the chest to in line with the shoulders.', 'المقابض من أمام الصدر حتى خط الكتفين.'),
    commonMistakes: [t('Shrugging instead of using the rear delts.', 'رفع الكتفين بدل استخدام الكتف الخلفي.')],
    alternatives: ['dumbbell_bent_over_row'],
  },
  close_grip_ez_bar_curl: {
    weightType: 'total',
    instructions: [
      t('Grip the inner angles of the EZ bar.', 'أمسك الزوايا الداخلية للبار المتعرج.'),
      t('Elbows tight to the sides; curl up without swinging.', 'المرفقان ملتصقان بالجسم؛ اثنِ دون تأرجح.'),
      t('Lower over 2–3 seconds to a full stretch.', 'أنزل خلال 2–3 ثوانٍ حتى تمدد كامل.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Arms straight at the bottom, bar near the shoulders at the top.', 'الذراعان مستقيمتان في الأسفل، والبار قرب الكتفين في الأعلى.'),
    commonMistakes: [t('Elbows drifting forward.', 'تقدم المرفقين للأمام.')],
    alternatives: ['straight_barbell_curl', 'dumbbell_hammer_curl'],
  },
  dumbbell_hammer_curl: {
    weightType: 'per_hand',
    instructions: [
      t('Neutral grip, palms facing each other.', 'قبضة محايدة والكفان متقابلان.'),
      t('Curl to shoulder height with still elbows.', 'اثنِ حتى مستوى الكتف مع ثبات المرفقين.'),
      t('Lower under control.', 'أنزل بتحكم.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Full extension to shoulder height.', 'من المد الكامل حتى مستوى الكتف.'),
    commonMistakes: [t('Swinging the torso.', 'تأرجح الجذع.')],
    alternatives: ['close_grip_ez_bar_curl', 'overhead_cable_curl'],
  },
  // ── Leg A ─────────────────────────────────────────────────────────────────
  dumbbell_deadlift: {
    weightType: 'per_hand',
    instructions: [
      t('Dumbbells beside the shins, back flat.', 'الدمبل بجانب الساقين والظهر مستقيم.'),
      t('Push the floor away and stand tall.', 'ادفع الأرض بقدميك وقف منتصبًا.'),
      t('Hinge back down with the weights close to the legs.', 'انحنِ للأسفل مع إبقاء الأوزان قريبة من الساقين.'),
    ],
    breathing: t('Brace and hold at the bottom, exhale near the top.', 'شد البطن في الأسفل وأخرج الزفير قرب الأعلى.'),
    rangeOfMotion: t('From the floor (or mid-shin) to full hip extension.', 'من الأرض (أو منتصف الساق) حتى مد الورك بالكامل.'),
    commonMistakes: [t('Rounding the lower back.', 'تقوس أسفل الظهر.')],
    alternatives: ['hip_thrust', 'leg_press'],
  },
  leg_extension: {
    weightType: 'total',
    instructions: [
      t('Pad on the shins, knees in line with the pivot.', 'الوسادة على الساقين والركبتان بمحاذاة محور الجهاز.'),
      t('Extend fully and squeeze the quads.', 'مد الساقين بالكامل واضغط الفخذ الأمامي.'),
      t('Lower over 2–3 seconds.', 'أنزل خلال 2–3 ثوانٍ.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('About 90° to full lockout.', 'من 90° تقريبًا حتى المد الكامل.'),
    commonMistakes: [t('Lifting the hips off the seat.', 'رفع الوركين عن المقعد.')],
    alternatives: ['leg_press', 'hack_squat'],
  },
  lying_leg_curl: {
    weightType: 'total',
    instructions: [
      t('Hips pressed into the pad.', 'اضغط الوركين على الوسادة.'),
      t('Curl the heels toward the glutes.', 'اثنِ الكعبين باتجاه الأرداف.'),
      t('Lower slowly to a full stretch.', 'أنزل ببطء حتى تمدد كامل.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Legs straight to heels near the glutes.', 'من الساقين المستقيمتين حتى الكعبين قرب الأرداف.'),
    commonMistakes: [t('Raising the hips to cheat the weight up.', 'رفع الوركين لمساعدة الوزن.')],
    alternatives: ['dumbbell_deadlift'],
  },
  leg_press: {
    weightType: 'total',
    instructions: [
      t('Feet shoulder-width on the platform.', 'القدمان بعرض الكتفين على المنصة.'),
      t('Lower until the knees reach about 90°.', 'أنزل حتى تصل الركبتان إلى 90° تقريبًا.'),
      t('Press without locking the knees hard.', 'ادفع دون قفل الركبتين بقوة.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Knees from about 90° to just short of lockout.', 'الركبتان من 90° تقريبًا حتى ما قبل المد الكامل.'),
    commonMistakes: [t('Letting the hips roll off the seat at the bottom.', 'ترك الوركين ينزلقان عن المقعد في الأسفل.')],
    alternatives: ['hack_squat', 'leg_extension'],
  },
  standing_calf_raise: {
    weightType: 'total',
    instructions: [
      t('Balls of the feet on the edge, heels low.', 'مقدمة القدمين على الحافة والكعبان منخفضان.'),
      t('Rise as high as possible and pause.', 'ارتفع لأقصى حد وتوقف لحظة.'),
      t('Lower to a deep stretch.', 'أنزل حتى تمدد عميق.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Deep stretch at the bottom to full tiptoe at the top.', 'من تمدد عميق في الأسفل حتى أقصى ارتفاع على أطراف الأصابع.'),
    commonMistakes: [t('Bouncing out of the bottom.', 'الارتداد من الأسفل.')],
    alternatives: ['seated_calf_raise', 'leg_press_calf_raise'],
  },
  seated_calf_raise: {
    weightType: 'total',
    instructions: [
      t('Pad on the thighs, balls of the feet on the step.', 'الوسادة على الفخذين ومقدمة القدمين على الدرجة.'),
      t('Rise onto the toes and pause.', 'ارتفع على أطراف الأصابع وتوقف لحظة.'),
      t('Lower slowly to a full stretch.', 'أنزل ببطء حتى تمدد كامل.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Full stretch to full contraction.', 'من التمدد الكامل حتى الانقباض الكامل.'),
    commonMistakes: [t('Short, fast partial reps.', 'تكرارات قصيرة وسريعة.')],
    alternatives: ['standing_calf_raise', 'leg_press_calf_raise'],
  },
  hip_thrust: {
    weightType: 'total',
    instructions: [
      t('Upper back on the bench, bar over the hips.', 'أعلى الظهر على المقعد والبار فوق الوركين.'),
      t('Drive the hips up until the torso is level.', 'ادفع الوركين للأعلى حتى يستوي الجذع.'),
      t('Squeeze the glutes at the top, lower under control.', 'اضغط الأرداف في الأعلى وأنزل بتحكم.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Hips from near the floor to full extension.', 'الوركان من قرب الأرض حتى المد الكامل.'),
    commonMistakes: [t('Hyperextending the lower back at the top.', 'المبالغة في تقويس أسفل الظهر في الأعلى.')],
    alternatives: ['dumbbell_deadlift'],
  },
  // ── Upper B ───────────────────────────────────────────────────────────────
  flat_dumbbell_bench_press: {
    weightType: 'per_hand',
    instructions: [
      t('Feet planted, shoulder blades pinched.', 'القدمان ثابتتان ولوحا الكتف مضمومان.'),
      t('Lower until the dumbbells are level with the chest.', 'أنزل حتى يصبح الدمبل بمستوى الصدر.'),
      t('Press up and slightly inward.', 'ادفع للأعلى وللداخل قليلًا.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Chest level to full extension.', 'من مستوى الصدر حتى المد الكامل.'),
    commonMistakes: [t('Dropping the dumbbells too fast at the bottom.', 'إسقاط الدمبل بسرعة في الأسفل.')],
    alternatives: ['flat_barbell_bench_press', 'incline_dumbbell_bench_press'],
  },
  hammer_strength_incline_press: {
    weightType: 'total',
    instructions: [
      t('Seat set so the handles start at mid-chest.', 'اضبط المقعد بحيث تبدأ المقابض عند منتصف الصدر.'),
      t('Press up and forward in one line.', 'ادفع للأعلى وللأمام في خط واحد.'),
      t('Return slowly without resting the weight.', 'ارجع ببطء دون إراحة الوزن.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Handles from chest level to near lockout.', 'المقابض من مستوى الصدر حتى ما قبل المد الكامل.'),
    commonMistakes: [t('Shoulders rolling forward off the pad.', 'تقدم الكتفين عن الوسادة.')],
    alternatives: ['incline_dumbbell_bench_press', 'flat_barbell_bench_press'],
  },
  wide_grip_lat_pulldown: {
    weightType: 'total',
    instructions: [
      t('Wide overhand grip, chest up.', 'قبضة واسعة علوية والصدر مرفوع.'),
      t('Pull the bar to the upper chest with the elbows.', 'اسحب البار إلى أعلى الصدر بقيادة المرفقين.'),
      t('Return to a full stretch.', 'ارجع حتى تمدد كامل.'),
    ],
    breathing: EXHALE_PULL,
    rangeOfMotion: t('Arms overhead to the bar at the upper chest.', 'من الذراعين فوق الرأس حتى البار عند أعلى الصدر.'),
    commonMistakes: [t('Leaning back and pulling to the stomach.', 'الميل للخلف والسحب نحو البطن.')],
    alternatives: ['hammer_strength_lat_pulldown', 'standing_lat_pushdown'],
  },
  seated_dumbbell_press: {
    weightType: 'per_hand',
    instructions: [
      t('Bench upright at 90°, back flat on the pad.', 'المقعد عمودي عند 90° والظهر مستوٍ على الوسادة.'),
      t('Lower to ear level.', 'أنزل حتى مستوى الأذن.'),
      t('Press up until the arms lock out.', 'ادفع للأعلى حتى تمتد الذراعان.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Ear level to lockout.', 'من مستوى الأذن حتى المد الكامل.'),
    commonMistakes: [t('Flaring the elbows straight out to the sides.', 'فتح المرفقين للجانبين بالكامل.')],
    alternatives: ['overhead_dumbbell_press'],
  },
  leaning_lateral_raise: {
    weightType: 'per_hand',
    instructions: [
      t('Hold a post and lean away from it.', 'أمسك عمودًا ومل بعيدًا عنه.'),
      t('Raise the outer arm to shoulder height.', 'ارفع الذراع الخارجية حتى مستوى الكتف.'),
      t('Lower slowly; switch sides.', 'أنزل ببطء ثم بدّل الجانب.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Thigh to shoulder height, one arm at a time.', 'من الفخذ حتى مستوى الكتف، ذراع واحدة كل مرة.'),
    commonMistakes: [t('Swinging the weight up.', 'تأرجح الوزن للأعلى.')],
    alternatives: ['dumbbell_lateral_raise'],
  },
  barbell_skull_crusher: {
    weightType: 'total',
    instructions: [
      t('Lie down, EZ bar over the forehead.', 'استلقِ والبار المتعرج فوق الجبهة.'),
      t('Keep the upper arms still and lower behind the head.', 'ثبّت العضد وأنزل البار خلف الرأس.'),
      t('Extend fully without locking out hard.', 'مد الذراعين بالكامل دون قفل قوي.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Bar behind the head to full extension.', 'من البار خلف الرأس حتى المد الكامل.'),
    commonMistakes: [t('Elbows flaring outward.', 'انفراج المرفقين للخارج.')],
    alternatives: ['dumbbell_skull_crusher', 'triceps_rope_pushdown'],
  },
  dumbbell_kickback: {
    weightType: 'per_hand',
    instructions: [
      t('Hinge forward, upper arm parallel to the floor.', 'انحنِ للأمام والعضد موازٍ للأرض.'),
      t('Extend the elbow fully and squeeze.', 'مد المرفق بالكامل واضغط.'),
      t('Return without dropping the upper arm.', 'ارجع دون إنزال العضد.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Forearm from vertical to full extension.', 'الساعد من الوضع العمودي حتى المد الكامل.'),
    commonMistakes: [t('Swinging the upper arm.', 'تأرجح العضد.')],
    alternatives: ['triceps_rope_pushdown'],
  },
  overhead_cable_curl: {
    weightType: 'total',
    instructions: [
      t('High pulley, arm out to the side at shoulder height.', 'البكرة عالية والذراع للجانب بمستوى الكتف.'),
      t('Curl the handle toward the head.', 'اثنِ المقبض باتجاه الرأس.'),
      t('Lower slowly; switch arms.', 'أنزل ببطء ثم بدّل الذراع.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Arm straight to the hand near the temple.', 'من الذراع المستقيمة حتى اليد قرب الصدغ.'),
    commonMistakes: [t('Dropping the elbow below shoulder height.', 'إنزال المرفق تحت مستوى الكتف.')],
    alternatives: ['dumbbell_hammer_curl', 'close_grip_ez_bar_curl'],
  },
  straight_barbell_curl: {
    weightType: 'total',
    instructions: [
      t('Wide underhand grip, elbows at the sides.', 'قبضة سفلية واسعة والمرفقان بجانب الجسم.'),
      t('Curl to shoulder height without swinging.', 'اثنِ حتى مستوى الكتف دون تأرجح.'),
      t('Lower over 2–3 seconds.', 'أنزل خلال 2–3 ثوانٍ.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Full extension to shoulder height.', 'من المد الكامل حتى مستوى الكتف.'),
    commonMistakes: [t('Leaning back to finish the rep.', 'الميل للخلف لإنهاء التكرار.')],
    alternatives: ['close_grip_ez_bar_curl', 'dumbbell_hammer_curl'],
  },
  // ── Lower B ───────────────────────────────────────────────────────────────
  hack_squat: {
    weightType: 'total',
    instructions: [
      t('Back flat on the pad, feet mid-platform.', 'الظهر مستوٍ على الوسادة والقدمان في منتصف المنصة.'),
      t('Descend until the thighs are parallel or lower.', 'انزل حتى يوازي الفخذان الأرض أو أقل.'),
      t('Drive through the whole foot.', 'ادفع بكامل القدم.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Parallel (or below) to just short of lockout.', 'من التوازي (أو أقل) حتى ما قبل المد الكامل.'),
    commonMistakes: [t('Heels lifting off the platform.', 'ارتفاع الكعبين عن المنصة.')],
    alternatives: ['leg_press'],
  },
  dumbbell_lunge: {
    weightType: 'per_hand',
    instructions: [
      t('Step forward and keep the torso upright.', 'اخطُ للأمام وأبقِ الجذع منتصبًا.'),
      t('Lower until the back knee nearly touches the floor.', 'انزل حتى تكاد الركبة الخلفية تلمس الأرض.'),
      t('Push back through the front heel.', 'ادفع للخلف بكعب القدم الأمامية.'),
    ],
    breathing: EXHALE_UP,
    rangeOfMotion: t('Back knee near the floor to full standing.', 'من الركبة الخلفية قرب الأرض حتى الوقوف الكامل.'),
    commonMistakes: [t('Front knee collapsing inward.', 'انهيار الركبة الأمامية للداخل.')],
    alternatives: ['hack_squat', 'leg_press'],
  },
  leg_press_calf_raise: {
    weightType: 'total',
    instructions: [
      t('Balls of the feet on the bottom edge of the platform.', 'مقدمة القدمين على الحافة السفلية للمنصة.'),
      t('Press through the toes as far as possible.', 'ادفع بأطراف الأصابع لأقصى مدى.'),
      t('Lower to a deep stretch under control.', 'أنزل حتى تمدد عميق بتحكم.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Deep stretch to full plantar flexion.', 'من التمدد العميق حتى ثني القدم بالكامل.'),
    commonMistakes: [t('Bending the knees to move the weight.', 'ثني الركبتين لتحريك الوزن.')],
    alternatives: ['standing_calf_raise', 'seated_calf_raise'],
  },
  dumbbell_wrist_curl: {
    weightType: 'per_hand',
    instructions: [
      t('Forearms on the thighs, palms up.', 'الساعدان على الفخذين والكفان للأعلى.'),
      t('Let the wrist drop, then curl up fully.', 'دع المعصم ينزل ثم اثنِه بالكامل للأعلى.'),
      t('Move only the wrist.', 'حرّك المعصم فقط.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Full wrist extension to full flexion.', 'من مد المعصم بالكامل حتى ثنيه بالكامل.'),
    commonMistakes: [t('Lifting the forearms off the thighs.', 'رفع الساعدين عن الفخذين.')],
    alternatives: ['forearm_barbell_curl'],
  },
  forearm_barbell_curl: {
    weightType: 'total',
    instructions: [
      t('Overhand grip, shoulder width.', 'قبضة علوية بعرض الكتفين.'),
      t('Elbows tight to the sides.', 'المرفقان ملتصقان بالجسم.'),
      t('Curl up, then lower over 3 seconds.', 'اثنِ للأعلى ثم أنزل خلال 3 ثوانٍ.'),
    ],
    breathing: EXHALE_EFFORT,
    rangeOfMotion: t('Full extension to shoulder height.', 'من المد الكامل حتى مستوى الكتف.'),
    commonMistakes: [t('Letting the wrists bend back.', 'ترك المعصمين ينثنيان للخلف.')],
    alternatives: ['dumbbell_wrist_curl', 'dumbbell_hammer_curl'],
  },
};

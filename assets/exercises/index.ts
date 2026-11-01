import type { ImageSourcePropType } from 'react-native';

/**
 * Exercise photos extracted from the program PDF (p.8–32, one per detail page),
 * named after the exercise id. Metro needs literal `require()` calls, so every
 * image is listed here. `hip_thrust` has no detail page in the PDF → no image.
 */
export const EXERCISE_IMAGES = {
  // Push A (p.8–12)
  flat_barbell_bench_press: require('./flat_barbell_bench_press.jpg'),
  incline_dumbbell_bench_press: require('./incline_dumbbell_bench_press.jpg'),
  pec_deck_fly: require('./pec_deck_fly.jpg'),
  high_low_cable_fly: require('./high_low_cable_fly.jpg'),
  overhead_dumbbell_press: require('./overhead_dumbbell_press.jpg'),
  dumbbell_lateral_raise: require('./dumbbell_lateral_raise.jpg'),
  dumbbell_skull_crusher: require('./dumbbell_skull_crusher.jpg'),
  triceps_rope_pushdown: require('./triceps_rope_pushdown.jpg'),
  lying_leg_raise: require('./lying_leg_raise.jpg'),
  // Pull A (p.14–17)
  dumbbell_bent_over_row: require('./dumbbell_bent_over_row.jpg'),
  seated_close_grip_row: require('./seated_close_grip_row.jpg'),
  standing_lat_pushdown: require('./standing_lat_pushdown.jpg'),
  hammer_strength_lat_pulldown: require('./hammer_strength_lat_pulldown.jpg'),
  dumbbell_front_raise: require('./dumbbell_front_raise.jpg'),
  reverse_pec_deck: require('./reverse_pec_deck.jpg'),
  close_grip_ez_bar_curl: require('./close_grip_ez_bar_curl.jpg'),
  dumbbell_hammer_curl: require('./dumbbell_hammer_curl.jpg'),
  // Leg A (p.19–21)
  dumbbell_deadlift: require('./dumbbell_deadlift.jpg'),
  leg_extension: require('./leg_extension.jpg'),
  lying_leg_curl: require('./lying_leg_curl.jpg'),
  leg_press: require('./leg_press.jpg'),
  standing_calf_raise: require('./standing_calf_raise.jpg'),
  seated_calf_raise: require('./seated_calf_raise.jpg'),
  // Upper B (p.23–27)
  flat_dumbbell_bench_press: require('./flat_dumbbell_bench_press.jpg'),
  hammer_strength_incline_press: require('./hammer_strength_incline_press.jpg'),
  wide_grip_lat_pulldown: require('./wide_grip_lat_pulldown.jpg'),
  seated_dumbbell_press: require('./seated_dumbbell_press.jpg'),
  leaning_lateral_raise: require('./leaning_lateral_raise.jpg'),
  barbell_skull_crusher: require('./barbell_skull_crusher.jpg'),
  dumbbell_kickback: require('./dumbbell_kickback.jpg'),
  overhead_cable_curl: require('./overhead_cable_curl.jpg'),
  straight_barbell_curl: require('./straight_barbell_curl.jpg'),
  // Lower B (p.29–32)
  hack_squat: require('./hack_squat.jpg'),
  dumbbell_lunge: require('./dumbbell_lunge.jpg'),
  leg_press_calf_raise: require('./leg_press_calf_raise.jpg'),
  dumbbell_wrist_curl: require('./dumbbell_wrist_curl.jpg'),
  forearm_barbell_curl: require('./forearm_barbell_curl.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export type ExerciseImageKey = keyof typeof EXERCISE_IMAGES;

/**
 * Stretching posters from the PDF (p.33 + p.35). The p.34 hip rehab sheet is in
 * stretches/hip_rehab.jpg but not wired to a routine yet, so it isn't bundled.
 */
export const STRETCH_POSTERS = {
  static_cooldown: require('./stretches/static_cooldown.jpg'),
  pre_workout_stretches: require('./stretches/pre_workout_stretches.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export type StretchPosterKey = keyof typeof STRETCH_POSTERS;

/**
 * Pixel sizes, so layouts can match each photo's shape. Kept static because
 * `Image.resolveAssetSource` doesn't exist on web.
 */
const EXERCISE_IMAGE_SIZES: Record<ExerciseImageKey, readonly [number, number]> = {
  flat_barbell_bench_press: [1024, 246],
  incline_dumbbell_bench_press: [980, 515],
  pec_deck_fly: [1320, 603],
  high_low_cable_fly: [341, 526],
  overhead_dumbbell_press: [523, 553],
  dumbbell_lateral_raise: [895, 503],
  dumbbell_skull_crusher: [1280, 960],
  triceps_rope_pushdown: [560, 422],
  lying_leg_raise: [623, 176],
  dumbbell_bent_over_row: [620, 291],
  seated_close_grip_row: [714, 484],
  standing_lat_pushdown: [1200, 548],
  hammer_strength_lat_pulldown: [1038, 581],
  dumbbell_front_raise: [741, 346],
  reverse_pec_deck: [650, 368],
  close_grip_ez_bar_curl: [968, 587],
  dumbbell_hammer_curl: [700, 350],
  dumbbell_deadlift: [1100, 500],
  leg_extension: [602, 359],
  lying_leg_curl: [605, 244],
  leg_press: [800, 515],
  standing_calf_raise: [600, 477],
  seated_calf_raise: [594, 514],
  flat_dumbbell_bench_press: [895, 503],
  hammer_strength_incline_press: [835, 584],
  wide_grip_lat_pulldown: [600, 400],
  seated_dumbbell_press: [450, 461],
  leaning_lateral_raise: [1151, 648],
  barbell_skull_crusher: [496, 573],
  dumbbell_kickback: [373, 198],
  overhead_cable_curl: [898, 399],
  straight_barbell_curl: [1320, 818],
  hack_squat: [1488, 742],
  dumbbell_lunge: [600, 425],
  leg_press_calf_raise: [1320, 650],
  dumbbell_wrist_curl: [1024, 487],
  forearm_barbell_curl: [565, 340],
};

const STRETCH_POSTER_SIZES: Record<StretchPosterKey, readonly [number, number]> = {
  static_cooldown: [678, 345],
  pre_workout_stretches: [848, 1200],
};

export function exerciseImageAspect(key: ExerciseImageKey): number {
  const [width, height] = EXERCISE_IMAGE_SIZES[key];
  return width / height;
}

export function stretchPosterAspect(key: StretchPosterKey): number {
  const [width, height] = STRETCH_POSTER_SIZES[key];
  return width / height;
}

export function hasExerciseImage(key: string): key is ExerciseImageKey {
  return key in EXERCISE_IMAGES;
}

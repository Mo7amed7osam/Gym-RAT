import type { ImageSourcePropType } from 'react-native';

/**
 * Warm-up poster from the original program document (p.35). Third-party
 * artwork ("© Neila Rey" is printed on it): kept for the warm-up checklist
 * pending an owner decision on rights. The exercise photos that used to live
 * here were removed with the RepDB illustrations (Master Plan v3 §3.2 rule 7).
 */
export const STRETCH_POSTERS = {
  pre_workout_stretches: require('./stretches/pre_workout_stretches.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export type StretchPosterKey = keyof typeof STRETCH_POSTERS;

const STRETCH_POSTER_SIZES: Record<StretchPosterKey, readonly [number, number]> = {
  pre_workout_stretches: [848, 1200],
};

export function stretchPosterAspect(key: StretchPosterKey): number {
  const [width, height] = STRETCH_POSTER_SIZES[key];
  return width / height;
}

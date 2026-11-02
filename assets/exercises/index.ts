import type { ImageSourcePropType } from 'react-native';

/**
 * Warm-up poster from the original program document (p.35). Third-party
 * artwork ("© Neila Rey" is printed on it). Restored for development and
 * internal testing only: redistribution rights are unverified, so store
 * builds swap this module for `index.store.ts` (see metro.config.js) and the
 * poster is never bundled into TestFlight or App Store binaries.
 */
export type StretchPosterKey = 'pre_workout_stretches';

export const STRETCH_POSTERS: Partial<Record<StretchPosterKey, ImageSourcePropType>> = {
  pre_workout_stretches: require('./stretches/pre_workout_stretches.jpg'),
};

const STRETCH_POSTER_SIZES: Record<StretchPosterKey, readonly [number, number]> = {
  pre_workout_stretches: [848, 1200],
};

export function stretchPosterAspect(key: StretchPosterKey): number {
  const [width, height] = STRETCH_POSTER_SIZES[key];
  return width / height;
}

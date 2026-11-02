import type { ImageSourcePropType } from 'react-native';

/**
 * Warm-up poster from the original program document (p.35). Third-party
 * artwork ("© Neila Rey" is printed on it). Kept for development and internal
 * local testing only: redistribution rights are unverified.
 *
 * Three layers keep it out of every distributable binary:
 * 1. `__DEV__` gate below. Metro inlines `__DEV__` and folds constants before
 *    it collects dependencies, so every release bundle (any EAS profile, any
 *    local Release/Archive build) drops the `require` and never packages the
 *    image. Only development bundles served by Metro include it.
 * 2. metro.config.js swaps this module for `index.store.ts` for the
 *    `production` and `preview` EAS profiles and when GYMRAT_STORE_BUILD=1.
 * 3. plugins/withUnlicensedAssetGuard.js fails any Release Xcode build whose
 *    product contains a file listed in `UNLICENSED.sha1`.
 */
export type StretchPosterKey = 'pre_workout_stretches';

export const STRETCH_POSTERS: Partial<Record<StretchPosterKey, ImageSourcePropType>> = __DEV__
  ? { pre_workout_stretches: require('./stretches/pre_workout_stretches.jpg') }
  : {};

const STRETCH_POSTER_SIZES: Record<StretchPosterKey, readonly [number, number]> = {
  pre_workout_stretches: [848, 1200],
};

export function stretchPosterAspect(key: StretchPosterKey): number {
  const [width, height] = STRETCH_POSTER_SIZES[key];
  return width / height;
}

import type { ImageSourcePropType } from 'react-native';

/**
 * Warm-up poster from the original program document (p.35). Third-party
 * artwork ("© Neila Rey" is printed on it).
 *
 * Owner decision 2026-11-03 (ADR-020, supersedes ADR-014): the poster ships in
 * every build, Development and Release. Owner approval is not a licence:
 * redistribution rights remain unverified (see ADR-020).
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

import type { ImageSourcePropType } from 'react-native';

import type { StretchPosterKey } from './index';

/**
 * Store-build replacement for `./index` (swapped in by metro.config.js): no
 * third-party posters, so the warm-up shows its moves without the image.
 * Keep the exports identical to `./index`.
 */
export const STRETCH_POSTERS: Partial<Record<StretchPosterKey, ImageSourcePropType>> = {};

export function stretchPosterAspect(_key: StretchPosterKey): number {
  return 1;
}

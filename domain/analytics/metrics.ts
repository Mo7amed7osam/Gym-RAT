import { createRecordsStrengthMetrics, totalWeightType, type StrengthMetrics, type WeightTypeResolver } from '@/domain/records/strengthMetrics';

export type { StrengthMetrics } from '@/domain/records/strengthMetrics';

/**
 * Integration boundary with the Phase 3 strength engine (ADR-011, ADR-012).
 *
 * Phase 4 never defines its own e1RM or PR rules: progression charts, goals
 * and history recomputation all ask the registered engine, and that engine is
 * always `domain/records`. The only thing that varies is how an exercise's
 * weight type is resolved: tests use `total` for everything, the app registers
 * a resolver backed by the exercise library at boot so that a live finish and
 * a history replay produce byte-identical summaries.
 */
export const recordsStrengthMetrics: StrengthMetrics = createRecordsStrengthMetrics(totalWeightType);

let registered: StrengthMetrics = recordsStrengthMetrics;

/** Called once at boot with the library-backed resolver; `null` restores the default (tests). */
export function registerStrengthMetrics(engine: StrengthMetrics | WeightTypeResolver | null): void {
  if (engine === null) registered = recordsStrengthMetrics;
  else if (typeof engine === 'function') registered = createRecordsStrengthMetrics(engine);
  else registered = engine;
}

export function getStrengthMetrics(): StrengthMetrics {
  return registered;
}

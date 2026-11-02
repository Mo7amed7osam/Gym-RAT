/** One way to label and print personal records on every screen (toast, finish summary, session detail, records card). */

import { formatKg } from '@/lib/format';
import type { PersonalRecordKind } from '@/types/workout';

export const RECORD_KIND_LABEL_KEY: Record<PersonalRecordKind, string> = {
  top_weight: 'coach.records.topWeight',
  estimated_1rm: 'coach.records.estimated1rm',
  reps_at_weight: 'coach.records.repsAtWeight',
  set_volume: 'coach.records.setVolume',
};

/** "102.5 kg", "1,200 kg", or "12 × 80 kg" for reps at a weight. */
export function formatRecordValue(kind: PersonalRecordKind, value: number, weightKg?: number): string {
  if (kind === 'reps_at_weight') return `${value} × ${formatKg(weightKg ?? 0)}`;
  return formatKg(value);
}

/** The previous best in the same unit: reps for reps-at-weight, kilograms otherwise. */
export function formatRecordPrevious(kind: PersonalRecordKind, previous: number): string {
  return kind === 'reps_at_weight' ? String(previous) : formatKg(previous);
}

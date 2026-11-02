import { BODY_METRIC_LIMITS, BODY_METRIC_UNITS, type BodyEntry, type BodyMetricKind } from '@/types/progress';

import { addDays } from './dates';

const atMs = (entry: BodyEntry) => Date.parse(entry.measuredAt);

export function isValidBodyValue(kind: BodyMetricKind, value: number): boolean {
  const limits = BODY_METRIC_LIMITS[BODY_METRIC_UNITS[kind]];
  return Number.isFinite(value) && value >= limits.min && value <= limits.max;
}

/** Entries of one kind, oldest first. */
export function entriesOf(entries: readonly BodyEntry[], kind: BodyMetricKind): BodyEntry[] {
  return entries.filter((entry) => entry.kind === kind).sort((a, b) => atMs(a) - atMs(b) || a.id.localeCompare(b.id));
}

export function latestEntry(entries: readonly BodyEntry[], kind: BodyMetricKind): BodyEntry | null {
  const list = entriesOf(entries, kind);
  return list[list.length - 1] ?? null;
}

export interface BodyChange {
  from: BodyEntry;
  to: BodyEntry;
  diff: number;
}

/**
 * Latest value against the last entry on or before `days` ago (or the first
 * entry if tracking started more recently). Null with fewer than two entries.
 */
export function changeOver(entries: readonly BodyEntry[], kind: BodyMetricKind, days: number, now: Date): BodyChange | null {
  const list = entriesOf(entries, kind);
  if (list.length < 2) return null;
  const to = list[list.length - 1];
  const cutoff = addDays(now, -days).getTime();
  let from = list[0];
  for (const entry of list) {
    if (atMs(entry) <= cutoff) from = entry;
    else break;
  }
  if (from === to) return null;
  return { from, to, diff: Math.round((to.value - from.value) * 10) / 10 };
}

/** Trailing moving average, same length as the input; smooths day-to-day water swings. */
export function movingAverage(values: readonly number[], window: number): number[] {
  const out: number[] = [];
  let sum = 0;
  values.forEach((value, i) => {
    sum += value;
    if (i >= window) sum -= values[i - window];
    out.push(sum / Math.min(i + 1, window));
  });
  return out;
}

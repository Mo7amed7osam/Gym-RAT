import { getStrengthMetrics, type StrengthMetrics } from '@/domain/analytics/metrics';
import { buildSessionSummary } from '@/lib/workoutMath';
import type { PersonalRecord, SessionSummary, WorkoutSession } from '@/types/workout';

import { validateHistorySession, type HistoryEditError } from './edit';

/**
 * History corrections (ADR-011). Any change to a finished session can change
 * the records of every later session, so summaries are replayed in start
 * order from the earliest affected point. Sessions whose summary comes out
 * identical keep their object, so the write-through diff only rewrites rows
 * that actually changed.
 */

const startMs = (session: WorkoutSession) => Date.parse(session.startedAt);

/** Newest first, ties broken by id (matches the repository's load order). */
export function sortNewestFirst(history: readonly WorkoutSession[]): WorkoutSession[] {
  return [...history].sort((a, b) => startMs(b) - startMs(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Summary of a finished session against the completed sessions before it.
 * Same builder as the live finish (`buildSessionSummary`), so a replayed
 * session and a freshly finished one can never disagree (ADR-012).
 */
export function summarize(session: WorkoutSession, prior: readonly WorkoutSession[], metrics: StrengthMetrics): SessionSummary {
  const end = Date.parse(session.finishedAt ?? session.startedAt);
  return buildSessionSummary(session, prior, new Date(end), metrics);
}

const sameRecord = (a: PersonalRecord, b: PersonalRecord) =>
  a.exerciseId === b.exerciseId && a.kind === b.kind && a.value === b.value && a.previous === b.previous && a.setId === b.setId;

export function sameSummary(a: SessionSummary | null, b: SessionSummary): boolean {
  return (
    a !== null &&
    a.totalVolumeKg === b.totalVolumeKg &&
    a.completedSets === b.completedSets &&
    a.totalSets === b.totalSets &&
    a.durationSeconds === b.durationSeconds &&
    a.activeSeconds === b.activeSeconds &&
    a.personalRecords.length === b.personalRecords.length &&
    a.personalRecords.every((record, i) => sameRecord(record, b.personalRecords[i]))
  );
}

/**
 * Recomputes the summary of every completed session that started at or after
 * `fromMs`. Returns the history newest first; untouched sessions (and any
 * that were already correct) are the same objects as in the input.
 */
export function replayHistory(
  history: readonly WorkoutSession[],
  fromMs: number,
  metrics: StrengthMetrics = getStrengthMetrics(),
): WorkoutSession[] {
  const chronological = sortNewestFirst(history).reverse();
  const replaced = new Map<string, WorkoutSession>();
  const prior: WorkoutSession[] = [];
  for (const session of chronological) {
    if (session.status !== 'completed') continue;
    let current = session;
    if (startMs(session) >= fromMs) {
      const summary = summarize(session, prior, metrics);
      if (!sameSummary(session.summary, summary)) {
        current = { ...session, summary };
        replaced.set(session.id, current);
      }
    }
    prior.push(current);
  }
  const sorted = sortNewestFirst(history);
  return replaced.size === 0 ? sorted : sorted.map((session) => replaced.get(session.id) ?? session);
}

export type CommitResult =
  | { ok: true; history: WorkoutSession[] }
  | { ok: false; errors: HistoryEditError[] };

/** Validates an edited copy of a history session, swaps it in and replays from the earliest affected start. */
export function commitSessionEdit(
  history: readonly WorkoutSession[],
  edited: WorkoutSession,
  now: number,
  metrics: StrengthMetrics = getStrengthMetrics(),
): CommitResult {
  const original = history.find((session) => session.id === edited.id);
  if (!original || original.status !== 'completed') return { ok: false, errors: [{ code: 'not_completed' }] };
  const errors = validateHistorySession(edited, now);
  if (errors.length > 0) return { ok: false, errors };

  // Force a fresh summary for the edited session even if the numbers match.
  const swapped = history.map((session) => (session.id === edited.id ? { ...edited, summary: null } : session));
  return { ok: true, history: replayHistory(swapped, Math.min(startMs(original), startMs(edited)), metrics) };
}

/** Removes a session and replays everything after it (its PRs may now belong to later sessions). */
export function removeFromHistory(
  history: readonly WorkoutSession[],
  sessionId: string,
  metrics: StrengthMetrics = getStrengthMetrics(),
): WorkoutSession[] {
  const removed = history.find((session) => session.id === sessionId);
  if (!removed) return [...history];
  const rest = history.filter((session) => session.id !== sessionId);
  return removed.status === 'completed' ? replayHistory(rest, startMs(removed), metrics) : rest;
}

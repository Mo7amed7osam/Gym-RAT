import { commitSessionEdit, removeFromHistory, type CommitResult } from '@/domain/history/recompute';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';

/**
 * History corrections from the Progress screens (ADR-011). Both go through
 * `useWorkoutStore.setState`, which is the store's guarded write-through: the
 * edited session and every recomputed summary land in one transaction, or
 * nothing changes and `persistenceError` is set.
 */

export type SaveHistoryResult = CommitResult | { ok: false; errors: []; persistenceError: string };

export function saveHistorySession(edited: WorkoutSession, now: number = Date.now()): SaveHistoryResult {
  const before = useWorkoutStore.getState();
  const result = commitSessionEdit(before.history, edited, now);
  if (!result.ok) return result;
  useWorkoutStore.setState({ history: result.history });
  const after = useWorkoutStore.getState();
  if (after.history !== result.history) {
    return { ok: false, errors: [], persistenceError: after.persistenceError ?? 'write failed' };
  }
  return result;
}

/** Deletes a finished session and recomputes later records. Returns false when nothing was removed. */
export function deleteHistorySession(sessionId: string): boolean {
  const { history } = useWorkoutStore.getState();
  if (!history.some((session) => session.id === sessionId)) return false;
  const next = removeFromHistory(history, sessionId);
  useWorkoutStore.setState({ history: next });
  return useWorkoutStore.getState().history === next;
}

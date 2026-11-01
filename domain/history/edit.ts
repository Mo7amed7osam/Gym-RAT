import { endTimeMs, patchExercise, patchSet, removeExercise, renumber, setNotes } from '@/domain/session/reducer';
import type { ExerciseSet, PausedInterval, SetType, WorkoutSession } from '@/types/workout';

/**
 * Pure edits on a finished session (Progress → session → Edit). Callers keep
 * the result as a draft and only commit it through `commitSessionEdit`, which
 * validates and recomputes summaries. No ids are generated here.
 */

export interface HistorySetPatch {
  weightKg?: number | null;
  reps?: number | null;
  completed?: boolean;
  type?: SetType;
}

/** When a set ticked during an edit is considered done: the session's end. */
function completionStamp(session: WorkoutSession): string {
  return new Date(endTimeMs(session, Date.parse(session.startedAt))).toISOString();
}

export function patchHistorySet(session: WorkoutSession, sessionExerciseId: string, setId: string, patch: HistorySetPatch): WorkoutSession {
  return patchSet(session, sessionExerciseId, setId, (set) => {
    const next: ExerciseSet = { ...set, ...patch };
    if (patch.completed === true && !set.completed) next.completedAt = set.completedAt ?? completionStamp(session);
    if (patch.completed === false) next.completedAt = null;
    return next;
  });
}

/** Appends a completed working set copying the last set's numbers (the usual "I forgot to log one"). */
export function addHistorySet(session: WorkoutSession, sessionExerciseId: string, setId: string): WorkoutSession {
  return patchExercise(session, sessionExerciseId, (exercise) => {
    const last = exercise.sets[exercise.sets.length - 1];
    const set: ExerciseSet = {
      id: setId,
      setNumber: exercise.sets.length + 1,
      type: 'working',
      kind: 'normal',
      targetReps: last?.targetReps ?? exercise.prescription.reps,
      weightKg: last?.weightKg ?? null,
      reps: last?.reps ?? null,
      rpe: null,
      rir: null,
      completed: last?.reps != null,
      completedAt: last?.reps != null ? completionStamp(session) : null,
    };
    return { ...exercise, sets: [...exercise.sets, set] };
  });
}

export function removeHistorySet(session: WorkoutSession, sessionExerciseId: string, setId: string): WorkoutSession {
  return patchExercise(session, sessionExerciseId, (exercise) => {
    if (!exercise.sets.some((set) => set.id === setId)) return exercise;
    return { ...exercise, sets: renumber(exercise.sets.filter((set) => set.id !== setId)) };
  });
}

export function removeHistoryExercise(session: WorkoutSession, sessionExerciseId: string): WorkoutSession {
  return removeExercise(session, sessionExerciseId);
}

export function setHistoryNotes(session: WorkoutSession, notes: string): WorkoutSession {
  return setNotes(session, notes);
}

/** Pauses clipped to `[start, end]`; pauses entirely outside disappear. */
function clampPauses(pauses: readonly PausedInterval[], start: number, end: number): PausedInterval[] {
  const out: PausedInterval[] = [];
  for (const pause of pauses) {
    const from = Math.max(Date.parse(pause.from), start);
    const to = Math.min(pause.to === null ? end : Date.parse(pause.to), end);
    if (to > from) out.push({ from: new Date(from).toISOString(), to: new Date(to).toISOString() });
  }
  return out;
}

/**
 * Corrects when the workout happened. `finishedAt` stays the real tap time;
 * the corrected end goes to `endedAtOverride`, which durations already honour.
 */
export function setHistoryTimes(session: WorkoutSession, startedAt: string, endedAt: string): WorkoutSession {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  return {
    ...session,
    startedAt,
    endedAtOverride: endedAt,
    pausedIntervals: clampPauses(session.pausedIntervals, start, Math.max(start, end)),
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type HistoryEditErrorCode =
  | 'not_completed'
  | 'invalid_time'
  | 'end_before_start'
  | 'too_long'
  | 'in_future'
  | 'invalid_weight'
  | 'invalid_reps'
  | 'missing_reps'
  | 'invalid_type';

export interface HistoryEditError {
  code: HistoryEditErrorCode;
  /** Set the error belongs to, when it is about a set. */
  setId?: string;
}

/** Longest believable session; anything above is a typo in the end time. */
export const MAX_SESSION_HOURS = 24;
/** Weights above this are rejected as input mistakes (world records are ~500 kg). */
export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 1000;

export function validateHistorySession(session: WorkoutSession, now: number): HistoryEditError[] {
  const errors: HistoryEditError[] = [];
  if (session.status !== 'completed') errors.push({ code: 'not_completed' });

  const start = Date.parse(session.startedAt);
  const end = endTimeMs(session, start);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    errors.push({ code: 'invalid_time' });
  } else {
    if (end <= start) errors.push({ code: 'end_before_start' });
    else if (end - start > MAX_SESSION_HOURS * 3600_000) errors.push({ code: 'too_long' });
    if (start > now) errors.push({ code: 'in_future' });
  }

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.type !== 'working' && set.type !== 'warmup') errors.push({ code: 'invalid_type', setId: set.id });
      if (set.weightKg !== null && (!Number.isFinite(set.weightKg) || set.weightKg < 0 || set.weightKg > MAX_WEIGHT_KG)) {
        errors.push({ code: 'invalid_weight', setId: set.id });
      }
      if (set.reps !== null && (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > MAX_REPS)) {
        errors.push({ code: 'invalid_reps', setId: set.id });
      }
      if (set.completed && set.reps === null) errors.push({ code: 'missing_reps', setId: set.id });
    }
  }
  return errors;
}

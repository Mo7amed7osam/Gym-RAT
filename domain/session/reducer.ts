import type { ExerciseSet, PausedInterval, SessionExercise, WorkoutSession } from '@/types/workout';

/**
 * Pure session transitions. No I/O, no ids generated here (callers pass ids),
 * no clock reads except through the `now` argument. The store applies these
 * and persists the result in one transaction.
 */

export const isPaused = (session: WorkoutSession): boolean =>
  session.pausedIntervals.some((interval) => interval.to === null);

/** Milliseconds spent paused up to `now` (open pause counted until now). */
export function pausedMs(session: WorkoutSession, now: number): number {
  return session.pausedIntervals.reduce((total, interval) => {
    const from = Date.parse(interval.from);
    const to = interval.to === null ? now : Date.parse(interval.to);
    return total + Math.max(0, to - from);
  }, 0);
}

/** When the session ended for duration purposes: override > finishedAt > now. */
export function endTimeMs(session: WorkoutSession, now: number): number {
  if (session.endedAtOverride) return Date.parse(session.endedAtOverride);
  if (session.finishedAt) return Date.parse(session.finishedAt);
  return now;
}

export function totalSeconds(session: WorkoutSession, now: number): number {
  return Math.max(0, Math.round((endTimeMs(session, now) - Date.parse(session.startedAt)) / 1000));
}

export function activeSeconds(session: WorkoutSession, now: number): number {
  const end = endTimeMs(session, now);
  const paused = session.pausedIntervals.reduce((total, interval) => {
    const from = Date.parse(interval.from);
    const to = Math.min(interval.to === null ? now : Date.parse(interval.to), end);
    return total + Math.max(0, to - from);
  }, 0);
  return Math.max(0, Math.round((end - Date.parse(session.startedAt) - paused) / 1000));
}

export function pause(session: WorkoutSession, now: string): WorkoutSession {
  if (isPaused(session)) return session;
  const interval: PausedInterval = { from: now, to: null };
  return { ...session, pausedIntervals: [...session.pausedIntervals, interval] };
}

export function resume(session: WorkoutSession, now: string): WorkoutSession {
  if (!isPaused(session)) return session;
  return {
    ...session,
    pausedIntervals: session.pausedIntervals.map((interval) => (interval.to === null ? { ...interval, to: now } : interval)),
  };
}

export function clampIndex(session: WorkoutSession, index: number): number {
  return Math.min(Math.max(index, 0), Math.max(session.exercises.length - 1, 0));
}

export function goToExercise(session: WorkoutSession, index: number): WorkoutSession {
  const next = clampIndex(session, index);
  return next === session.currentExerciseIndex ? session : { ...session, currentExerciseIndex: next };
}

/** Moves the exercise to the end of the order and marks it deferred. */
export function deferExercise(session: WorkoutSession, sessionExerciseId: string): WorkoutSession {
  const index = session.exercises.findIndex((exercise) => exercise.id === sessionExerciseId);
  if (index === -1) return session;
  const exercise = session.exercises[index];
  const exercises = [...session.exercises.slice(0, index), ...session.exercises.slice(index + 1), exercise];
  const deferredIds = session.deferredIds.includes(sessionExerciseId) ? session.deferredIds : [...session.deferredIds, sessionExerciseId];
  // Keep the pointer on the same position so the next exercise slides in.
  return { ...session, exercises, deferredIds, currentExerciseIndex: clampIndex({ ...session, exercises }, session.currentExerciseIndex) };
}

/** Moves an exercise to a new position; clears its deferred flag. */
export function reorderExercise(session: WorkoutSession, sessionExerciseId: string, toIndex: number): WorkoutSession {
  const from = session.exercises.findIndex((exercise) => exercise.id === sessionExerciseId);
  if (from === -1) return session;
  const to = Math.min(Math.max(toIndex, 0), session.exercises.length - 1);
  if (from === to) return session;
  const exercises = [...session.exercises];
  const [moved] = exercises.splice(from, 1);
  exercises.splice(to, 0, moved);
  const currentId = session.exercises[session.currentExerciseIndex]?.id;
  const currentExerciseIndex = Math.max(0, exercises.findIndex((exercise) => exercise.id === currentId));
  return {
    ...session,
    exercises,
    deferredIds: session.deferredIds.filter((id) => id !== sessionExerciseId),
    currentExerciseIndex,
  };
}

export function patchExercise(
  session: WorkoutSession,
  sessionExerciseId: string,
  update: (exercise: SessionExercise) => SessionExercise,
): WorkoutSession {
  let changed = false;
  const exercises = session.exercises.map((exercise) => {
    if (exercise.id !== sessionExerciseId) return exercise;
    const next = update(exercise);
    if (next !== exercise) changed = true;
    return next;
  });
  return changed ? { ...session, exercises } : session;
}

export function patchSet(
  session: WorkoutSession,
  sessionExerciseId: string,
  setId: string,
  update: (set: ExerciseSet) => ExerciseSet,
): WorkoutSession {
  return patchExercise(session, sessionExerciseId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((item) => (item.id === setId ? update(item) : item)),
  }));
}

export function renumber(sets: ExerciseSet[]): ExerciseSet[] {
  return sets.map((set, i) => (set.setNumber === i + 1 ? set : { ...set, setNumber: i + 1 }));
}

export function setNotes(session: WorkoutSession, notes: string): WorkoutSession {
  return session.notes === notes ? session : { ...session, notes };
}

export function setEndedAtOverride(session: WorkoutSession, endedAt: string | null): WorkoutSession {
  return { ...session, endedAtOverride: endedAt };
}

/** Closes any open pause and stamps the finish time. */
export function finish(session: WorkoutSession, now: string): WorkoutSession {
  const closed = resume(session, now);
  return { ...closed, status: 'completed', finishedAt: now };
}

/** Exercises that have at least one completed set, and those skipped or untouched. */
export function exerciseOutcome(session: WorkoutSession): { completed: string[]; skipped: string[]; untouched: string[] } {
  const completed: string[] = [];
  const skipped: string[] = [];
  const untouched: string[] = [];
  for (const exercise of session.exercises) {
    if (exercise.skipped) skipped.push(exercise.id);
    else if (exercise.sets.some((set) => set.completed)) completed.push(exercise.id);
    else untouched.push(exercise.id);
  }
  return { completed, skipped, untouched };
}

import type { ExercisePrescription, ExerciseSet, PausedInterval, SessionExercise, WorkoutSession } from '@/types/workout';

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

// ─── Phase 2 engine additions (P2.4 / P2.5) ──────────────────────────────────

/** Inserts an exercise after `afterIndex` (default: after the current one). */
export function addExercise(session: WorkoutSession, exercise: SessionExercise, afterIndex: number = session.currentExerciseIndex): WorkoutSession {
  const at = Math.min(Math.max(afterIndex + 1, 0), session.exercises.length);
  const exercises = [...session.exercises.slice(0, at), exercise, ...session.exercises.slice(at)];
  return { ...session, exercises };
}

/** Removes an exercise from the session (its logged sets go with it; callers confirm first). */
export function removeExercise(session: WorkoutSession, sessionExerciseId: string): WorkoutSession {
  const index = session.exercises.findIndex((exercise) => exercise.id === sessionExerciseId);
  if (index === -1) return session;
  const exercises = session.exercises.filter((exercise) => exercise.id !== sessionExerciseId);
  const next = { ...session, exercises, deferredIds: session.deferredIds.filter((id) => id !== sessionExerciseId) };
  const currentExerciseIndex = index < session.currentExerciseIndex ? session.currentExerciseIndex - 1 : session.currentExerciseIndex;
  return { ...next, currentExerciseIndex: clampIndex(next, currentExerciseIndex) };
}

/**
 * Swaps the movement for this session only. `prescription.exerciseId` keeps
 * the plan's original slot (so "save to plan" can replace it); `exerciseId`
 * is what is actually being performed. Completed sets stay as logged,
 * incomplete sets lose their prefill.
 */
export function substituteExercise(session: WorkoutSession, sessionExerciseId: string, exerciseId: string): WorkoutSession {
  return patchExercise(session, sessionExerciseId, (exercise) => {
    if (exercise.exerciseId === exerciseId) return exercise;
    return {
      ...exercise,
      exerciseId,
      sets: exercise.sets.map((set) => (set.completed ? set : { ...set, weightKg: null, reps: null })),
    };
  });
}

/**
 * Session-only target edit: number of sets (trailing incomplete sets are
 * added or dropped), rep range on incomplete sets, rest. The plan is untouched.
 */
export function patchPrescription(
  session: WorkoutSession,
  sessionExerciseId: string,
  patch: Partial<Pick<ExercisePrescription, 'sets' | 'reps' | 'rest'>>,
  makeSet: (setNumber: number, template: ExerciseSet | undefined) => ExerciseSet,
): WorkoutSession {
  return patchExercise(session, sessionExerciseId, (exercise) => {
    const prescription = { ...exercise.prescription, ...patch };
    let sets = exercise.sets;
    if (patch.reps) sets = sets.map((set) => (set.completed ? set : { ...set, targetReps: patch.reps! }));
    if (patch.sets !== undefined) {
      const working = sets.filter((set) => set.type === 'working').length;
      if (patch.sets > working) {
        const extra = Array.from({ length: patch.sets - working }, (_, i) => makeSet(sets.length + i + 1, sets[sets.length - 1]));
        sets = [...sets, ...extra];
      } else if (patch.sets < working) {
        let toDrop = working - patch.sets;
        const kept: ExerciseSet[] = [];
        for (let i = sets.length - 1; i >= 0; i -= 1) {
          const set = sets[i];
          if (toDrop > 0 && set.type === 'working' && !set.completed) {
            toDrop -= 1;
            continue;
          }
          kept.unshift(set);
        }
        sets = renumber(kept);
      }
    }
    return { ...exercise, prescription, sets };
  });
}

/** Marks the next incomplete set of an exercise with an advanced kind (or back to normal). */
export function setNextSetKind(session: WorkoutSession, sessionExerciseId: string, kind: ExerciseSet['kind']): WorkoutSession {
  return patchExercise(session, sessionExerciseId, (exercise) => {
    const target = exercise.sets.find((set) => !set.completed);
    if (!target || target.kind === kind) return exercise;
    return { ...exercise, sets: exercise.sets.map((set) => (set.id === target.id ? { ...set, kind } : set)) };
  });
}

/** Prepends warm-up sets (ramping percentages of `workingKg`) before the first working set. */
export function addWarmupSets(
  session: WorkoutSession,
  sessionExerciseId: string,
  warmups: { weightKg: number; reps: number }[],
  makeId: () => string,
): WorkoutSession {
  return patchExercise(session, sessionExerciseId, (exercise) => {
    if (warmups.length === 0 || exercise.sets.some((set) => set.completed)) return exercise;
    const firstWorking = exercise.sets.findIndex((set) => set.type === 'working');
    const at = firstWorking === -1 ? exercise.sets.length : firstWorking;
    const template = exercise.sets[at] ?? exercise.sets[0];
    const added: ExerciseSet[] = warmups.map((item) => ({
      id: makeId(),
      setNumber: 0,
      type: 'warmup',
      kind: 'normal',
      targetReps: { min: item.reps, max: item.reps },
      weightKg: item.weightKg,
      reps: item.reps,
      rpe: null,
      rir: null,
      completed: false,
      completedAt: null,
    }));
    const sets = renumber([...exercise.sets.slice(0, at), ...added, ...exercise.sets.slice(at)]);
    return { ...exercise, sets };
  });
}

/** Groups two or more exercises (by session-exercise id) into a superset / giant set, or ungroups them. */
export function setGroup(session: WorkoutSession, sessionExerciseIds: string[], groupId: string | null): WorkoutSession {
  const ids = new Set(sessionExerciseIds);
  const groupKind: SessionExercise['groupKind'] = groupId === null ? null : ids.size >= 3 ? 'giant' : 'superset';
  let changed = false;
  const exercises = session.exercises.map((exercise) => {
    if (!ids.has(exercise.id)) return exercise;
    if (exercise.groupId === groupId && exercise.groupKind === groupKind) return exercise;
    changed = true;
    return { ...exercise, groupId, groupKind };
  });
  return changed ? { ...session, exercises } : session;
}

/** Timestamp of the most recent user activity in the session (set logged, start, or resume). */
export function lastActivityMs(session: WorkoutSession): number {
  let latest = Date.parse(session.startedAt);
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.completedAt) latest = Math.max(latest, Date.parse(set.completedAt));
    }
  }
  for (const interval of session.pausedIntervals) {
    if (interval.to) latest = Math.max(latest, Date.parse(interval.to));
  }
  return latest;
}

/**
 * Rest after `completedSet` on `exercise` (spec §10): warm-up sets rest
 * briefly, drop sets not at all, rest-pause sets 15 s, grouped exercises
 * only rest after the last member of the group; otherwise the user's
 * per-exercise override, then the prescription.
 */
export function restSecondsAfter(
  session: WorkoutSession,
  exercise: SessionExercise,
  completedSet: ExerciseSet,
  options: { warmupRestSeconds: number; userRestSeconds: number | null },
): number {
  if (completedSet.kind === 'drop') return 0;
  if (completedSet.kind === 'rest_pause') return 15;
  if (completedSet.type === 'warmup') return options.warmupRestSeconds;
  if (exercise.groupId) {
    const members = session.exercises.filter((item) => item.groupId === exercise.groupId && !item.skipped);
    const position = members.findIndex((item) => item.id === exercise.id);
    const later = members.slice(position + 1);
    if (later.some((item) => item.sets.some((set) => !set.completed))) return 0;
  }
  return options.userRestSeconds ?? exercise.prescription.rest.defaultSeconds;
}

import type {
  ExerciseSet,
  PersonalRecord,
  SessionExercise,
  SessionSummary,
  WorkoutSession,
} from '@/types/workout';

/**
 * Pure helpers for volume, estimated 1RM, history lookups and PR detection.
 * Shared by the store and the UI. History is always ordered newest-first.
 */

/** A set that counts toward volume / records. Warm-up sets never count. */
export function isCountedSet(set: ExerciseSet): set is ExerciseSet & { weightKg: number; reps: number } {
  return set.completed && set.type === 'working' && set.weightKg !== null && set.reps !== null;
}

export function setVolumeKg(set: ExerciseSet): number {
  return isCountedSet(set) ? set.weightKg * set.reps : 0;
}

export function exerciseVolumeKg(exercise: SessionExercise): number {
  return exercise.sets.reduce((total, set) => total + setVolumeKg(set), 0);
}

export function sessionVolumeKg(session: WorkoutSession): number {
  return session.exercises.reduce((total, exercise) => total + exerciseVolumeKg(exercise), 0);
}

/** Epley formula. Returns 0 for empty sets. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** "57.5 × 12", or "—" when nothing was logged. */
export function formatSet(set: Pick<ExerciseSet, 'weightKg' | 'reps'>): string {
  if (set.reps === null) return '—';
  return set.weightKg ? `${set.weightKg} × ${set.reps}` : `BW × ${set.reps}`;
}

export function countSets(session: WorkoutSession): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const exercise of session.exercises) {
    if (exercise.skipped) continue;
    for (const set of exercise.sets) {
      if (set.type !== 'working') continue;
      total += 1;
      if (set.completed) completed += 1;
    }
  }
  return { completed, total };
}

export interface PreviousPerformance {
  session: WorkoutSession;
  exercise: SessionExercise;
}

/**
 * Most recent completed session that logged at least one set of this exercise.
 * Returns references into `history` (stable for zustand selectors).
 */
export function getPreviousPerformance(
  history: readonly WorkoutSession[],
  exerciseId: string,
): PreviousPerformance | null {
  for (const session of history) {
    if (session.status !== 'completed') continue;
    const exercise = session.exercises.find(
      (item) => item.exerciseId === exerciseId && item.sets.some(isCountedSet),
    );
    if (exercise) return { session, exercise };
  }
  return null;
}

/** The completed working set at the same position last time, falling back to the last one logged. */
export function getPreviousSetAt(previous: SessionExercise | null, setNumber: number): ExerciseSet | null {
  if (!previous) return null;
  const working = previous.sets.filter(isCountedSet);
  return working[setNumber - 1] ?? working[working.length - 1] ?? null;
}

export interface ExerciseBests {
  topWeightKg: number;
  bestOneRepMax: number;
  bestSet: ExerciseSet | null;
}

export function getExerciseBests(history: readonly WorkoutSession[], exerciseId: string): ExerciseBests {
  const bests: ExerciseBests = { topWeightKg: 0, bestOneRepMax: 0, bestSet: null };
  for (const session of history) {
    if (session.status !== 'completed') continue;
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        if (!isCountedSet(set)) continue;
        bests.topWeightKg = Math.max(bests.topWeightKg, set.weightKg);
        const e1rm = estimateOneRepMax(set.weightKg, set.reps);
        if (e1rm > bests.bestOneRepMax) {
          bests.bestOneRepMax = e1rm;
          bests.bestSet = set;
        }
      }
    }
  }
  return bests;
}

/** One record per exercise per kind: the best new set that beats all prior history. */
export function detectPersonalRecords(
  session: WorkoutSession,
  history: readonly WorkoutSession[],
): PersonalRecord[] {
  const records: PersonalRecord[] = [];

  for (const exercise of session.exercises) {
    const counted = exercise.sets.filter(isCountedSet);
    if (counted.length === 0) continue;

    const prior = getExerciseBests(history, exercise.exerciseId);
    // First time doing the exercise isn't a PR — there is nothing to beat.
    if (prior.bestSet === null) continue;

    let topSet = counted[0];
    let bestE1rmSet = counted[0];
    for (const set of counted) {
      if (set.weightKg > topSet.weightKg) topSet = set;
      if (estimateOneRepMax(set.weightKg, set.reps) > estimateOneRepMax(bestE1rmSet.weightKg, bestE1rmSet.reps)) {
        bestE1rmSet = set;
      }
    }

    if (topSet.weightKg > prior.topWeightKg) {
      records.push({
        exerciseId: exercise.exerciseId,
        kind: 'top_weight',
        value: topSet.weightKg,
        previous: prior.topWeightKg,
        setId: topSet.id,
      });
    }

    const bestE1rm = estimateOneRepMax(bestE1rmSet.weightKg, bestE1rmSet.reps);
    if (bestE1rm > prior.bestOneRepMax) {
      records.push({
        exerciseId: exercise.exerciseId,
        kind: 'estimated_1rm',
        value: roundTo(bestE1rm, 0.5),
        previous: roundTo(prior.bestOneRepMax, 0.5),
        setId: bestE1rmSet.id,
      });
    }
  }

  return records;
}

export function buildSessionSummary(
  session: WorkoutSession,
  history: readonly WorkoutSession[],
  finishedAt: Date,
): SessionSummary {
  const { completed, total } = countSets(session);
  return {
    totalVolumeKg: sessionVolumeKg(session),
    completedSets: completed,
    totalSets: total,
    durationSeconds: Math.max(0, Math.round((finishedAt.getTime() - Date.parse(session.startedAt)) / 1000)),
    personalRecords: detectPersonalRecords(session, history),
  };
}

/** Volume per program week (weeks start Saturday) for the last `weeks` weeks, oldest first. */
export function weeklyVolumeKg(history: readonly WorkoutSession[], weeks: number, now: Date): number[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceSaturday = (startOfToday.getDay() + 1) % 7;
  const currentWeekStart = startOfToday.getTime() - daysSinceSaturday * DAY_MS;

  const buckets: number[] = new Array<number>(weeks).fill(0);
  for (const session of history) {
    if (session.status !== 'completed') continue;
    const started = Date.parse(session.startedAt);
    const weeksAgo = Math.floor((currentWeekStart + 7 * DAY_MS - 1 - started) / (7 * DAY_MS));
    if (weeksAgo < 0 || weeksAgo >= weeks) continue;
    buckets[weeks - 1 - weeksAgo] += session.summary?.totalVolumeKg ?? sessionVolumeKg(session);
  }
  return buckets;
}

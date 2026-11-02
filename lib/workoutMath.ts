import { getStrengthMetrics, type StrengthMetrics } from '@/domain/analytics/metrics';
import { activeSeconds, totalSeconds } from '@/domain/session/reducer';
import type {
  ExerciseSet,
  PersonalRecord,
  SessionExercise,
  SessionSummary,
  WeekStart,
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

/**
 * Estimated 1RM from the one strength engine (`domain/records`: Epley, no
 * estimate above 12 reps). 0 when there is no estimate.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  return getStrengthMetrics().estimateOneRepMax(weightKg, reps);
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

/**
 * Best performance shown on the exercise card, library and Today. Uses the
 * same engine as Records and the progress charts: `bestSet` is the set with
 * the highest e1RM; when no set has an estimate (bodyweight, assisted, or only
 * sets above 12 reps) it falls back to the heaviest set, then the most reps.
 */
export function getExerciseBests(
  history: readonly WorkoutSession[],
  exerciseId: string,
  metrics: StrengthMetrics = getStrengthMetrics(),
): ExerciseBests {
  const bests: ExerciseBests = { topWeightKg: 0, bestOneRepMax: 0, bestSet: null };
  const loadCounts = metrics.hasComparableLoad(exerciseId);
  let fallback: ExerciseSet | null = null;
  for (const session of history) {
    if (session.status !== 'completed') continue;
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        if (!isCountedSet(set) || set.reps <= 0) continue;
        if (loadCounts) bests.topWeightKg = Math.max(bests.topWeightKg, set.weightKg);
        if (!fallback || set.weightKg > (fallback.weightKg ?? 0) || (set.weightKg === fallback.weightKg && set.reps > (fallback.reps ?? 0))) {
          fallback = set;
        }
        const e1rm = loadCounts ? metrics.estimateOneRepMax(set.weightKg, set.reps) : 0;
        if (e1rm > bests.bestOneRepMax) {
          bests.bestOneRepMax = e1rm;
          bests.bestSet = set;
        }
      }
    }
  }
  if (!bests.bestSet) bests.bestSet = fallback;
  return bests;
}

/** Summary for a session whose `finishedAt` (and optional override) is already set. */
export function buildSessionSummary(
  session: WorkoutSession,
  history: readonly WorkoutSession[],
  finishedAt: Date,
  metrics: StrengthMetrics = getStrengthMetrics(),
): SessionSummary {
  const { completed, total } = countSets(session);
  const stamped: WorkoutSession = session.finishedAt ? session : { ...session, finishedAt: finishedAt.toISOString() };
  return {
    totalVolumeKg: sessionVolumeKg(session),
    completedSets: completed,
    totalSets: total,
    durationSeconds: totalSeconds(stamped, finishedAt.getTime()),
    activeSeconds: activeSeconds(stamped, finishedAt.getTime()),
    // The one strength engine (ADR-012): one record per kind per exercise, against history without this session.
    personalRecords: metrics.detectPersonalRecords(session, history),
  };
}

const WEEK_START_DAY: Record<WeekStart, number> = { sunday: 0, monday: 1, saturday: 6 };

/** Local midnight of the first day of the week containing `date`. */
export function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() - WEEK_START_DAY[weekStart] + 7) % 7));
  return start;
}

/** Volume per week for the last `weeks` weeks, oldest first. */
export function weeklyVolumeKg(history: readonly WorkoutSession[], weeks: number, now: Date, weekStart: WeekStart = 'saturday'): number[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const currentWeekStart = startOfWeek(now, weekStart).getTime();

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

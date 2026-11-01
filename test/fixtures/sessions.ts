import type { ExerciseSet, SessionExercise, WorkoutSession } from '@/types/workout';

/** Session/set builders shared by the Phase 4 analytics and history tests. */

let counter = 0;
export const nextId = (prefix = 'id') => `${prefix}-${++counter}`;

export function set(partial: Partial<ExerciseSet> = {}): ExerciseSet {
  return {
    id: nextId('set'),
    setNumber: 1,
    type: 'working',
    kind: 'normal',
    rpe: null,
    rir: null,
    targetReps: { min: 8, max: 12 },
    weightKg: null,
    reps: null,
    completed: false,
    completedAt: null,
    ...partial,
  };
}

export const done = (weightKg: number | null, reps: number, extra: Partial<ExerciseSet> = {}): ExerciseSet =>
  set({ weightKg, reps, completed: true, completedAt: '2026-10-01T10:00:00.000Z', ...extra });

export function exercise(exerciseId: string, sets: ExerciseSet[], extra: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: nextId('sx'),
    exerciseId,
    prescription: {
      exerciseId,
      sets: sets.length,
      reps: { min: 8, max: 12 },
      rest: { defaultSeconds: 120, minSeconds: 120, maxSeconds: 120 },
    },
    sets: sets.map((item, i) => ({ ...item, setNumber: i + 1 })),
    skipped: false,
    notes: '',
    groupId: null,
    groupKind: null,
    ...extra,
  };
}

/** A completed session starting at a local date; `minutes` long. */
export function session(
  start: Date,
  exercises: SessionExercise[],
  extra: Partial<WorkoutSession> & { minutes?: number } = {},
): WorkoutSession {
  const { minutes = 60, ...rest } = extra;
  return {
    id: nextId('session'),
    schemaVersion: 2,
    kind: 'plan',
    planId: 'plan',
    planDayId: 'plan:day',
    title: { en: 'Push', ar: 'دفع' },
    code: 'Push A',
    focus: 'hypertrophy',
    status: 'completed',
    startedAt: start.toISOString(),
    finishedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
    endedAtOverride: null,
    pausedIntervals: [],
    exercises,
    deferredIds: [],
    currentExerciseIndex: 0,
    warmupCompletedIds: [],
    notes: '',
    summary: null,
    ...rest,
  };
}

/** Local date helper: month is 1-based to read naturally in tests. */
export const local = (year: number, month: number, day: number, hour = 18, minute = 0) => new Date(year, month - 1, day, hour, minute);

/** Newest first, like the store. */
export const newestFirst = (sessions: WorkoutSession[]) => [...sessions].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

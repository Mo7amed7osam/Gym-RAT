/**
 * Wire format for POST /api/sessions/sync — the app's `WorkoutSession` from
 * types/workout.ts, serialized as-is. Kept as a standalone copy so the server
 * doesn't pull in React Native types; update both together.
 */

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface RepRange {
  min: number;
  max: number;
}

export interface ExerciseSet {
  id: string;
  setNumber: number;
  type: 'warmup' | 'working';
  targetReps: RepRange;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  completedAt: string | null;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  prescription: Record<string, unknown>;
  sets: ExerciseSet[];
  skipped: boolean;
  notes: string;
}

export interface WorkoutSession {
  id: string;
  schemaVersion: number;
  routineId: string;
  weekday: string;
  title: LocalizedText;
  code: string;
  focus: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  startedAt: string;
  finishedAt: string | null;
  exercises: SessionExercise[];
  currentExerciseIndex: number;
  warmupCompletedIds: string[];
  cooldownCompletedIds: string[];
  summary: Record<string, unknown> | null;
}

export interface SyncRequest {
  /** Sessions to create or fully replace (idempotent by id). */
  upserts: WorkoutSession[];
  /** Session ids deleted on the device. */
  deletes: string[];
}

export interface SyncResponse {
  synced: string[];
  deleted: string[];
  failed: { id: string; error: string }[];
}

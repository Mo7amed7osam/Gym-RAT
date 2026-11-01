/**
 * Core domain model for Gym RAT.
 *
 * Two layers:
 *  - Program: Exercise dictionary + Plan → PlanDay → ExercisePrescription (rotation, not weekdays).
 *  - Log (user data, persisted): WorkoutSession → SessionExercise → ExerciseSet.
 *
 * Everything in the log layer uses string UUIDs and ISO-8601 timestamps so it maps
 * cleanly onto relational tables.
 */

import type { ExerciseImageKey, StretchPosterKey } from '@/assets/exercises';

// ─── Shared primitives ───────────────────────────────────────────────────────

export interface LocalizedText {
  en: string;
  ar: string;
}

/** ISO-8601 timestamp, e.g. "2026-10-31T18:12:00.000Z". */
export type ISODateString = string;

/** First day of the week for weekly stats and the calendar strip. */
export type WeekStart = 'saturday' | 'sunday' | 'monday';

export type MuscleGroup =
  | 'chest'
  | 'upper_chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'triceps'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'biceps'
  | 'brachialis'
  | 'forearms'
  | 'abs'
  | 'hip_flexors'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export type Equipment =
  | 'barbell'
  | 'ez_bar'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bench'
  | 'bodyweight';

// ─── Program layer ───────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: LocalizedText;
  /** Where the Arabic name came from — the PDF omits it for a few movements. */
  arabicNameSource: 'pdf' | 'supplied';
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  /** Performed one side at a time (log per side or per arm). */
  isUnilateral: boolean;
  /** Short coaching cues, shown in order. */
  formCues: string[];
  /** YouTube search URL for a form tutorial. */
  videoUrl: string;
  /** Local photo from the program PDF (see assets/exercises); absent when the PDF has none. */
  thumbnailKey?: ExerciseImageKey;
}

export interface RepRange {
  min: number;
  max: number;
}

/** PDF gives rest as either "2 min" or "1–2 min"; keep the range, timer uses `defaultSeconds`. */
export interface RestPeriod {
  defaultSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

/** How an exercise is programmed on a specific day. Same exercise can differ per day. */
export interface ExercisePrescription {
  exerciseId: string;
  sets: number;
  reps: RepRange;
  rest: RestPeriod;
  note?: LocalizedText;
}

export type TrainingFocus = 'strength' | 'hypertrophy';

/**
 * One workout inside a plan. Plans rotate through their days in order; the
 * next day is tracked by `Plan.nextDayIndex`, never by the calendar.
 */
export interface PlanDay {
  id: string;
  /** 0-based position in the rotation. */
  position: number;
  /** Short label used in UI, e.g. "Push A". */
  code: string;
  title: LocalizedText;
  muscleSummary: LocalizedText;
  focus: TrainingFocus | null;
  exercises: ExercisePrescription[];
}

/**
 * `active`: the single plan the rotation follows (at most one).
 * `template`: bundled or user-made plan the user can start extra sessions from or adopt.
 * `reference`: immutable record of an original program (e.g. the PDF); browse-only.
 */
export type PlanKind = 'active' | 'template' | 'reference';

export interface Plan {
  id: string;
  kind: PlanKind;
  name: LocalizedText;
  description: LocalizedText | null;
  /** Template or reference this plan was copied from, if any. */
  sourcePlanId: string | null;
  /** Locked plans cannot be edited (bundled templates and references). */
  locked: boolean;
  /** Index into `days` of the next workout in the rotation. */
  nextDayIndex: number;
  days: PlanDay[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─── Warm-up / stretching ────────────────────────────────────────────────────

export type StretchRoutineId = 'dynamic_warmup' | 'pre_workout_stretches';

export interface StretchMove {
  id: string;
  name: LocalizedText;
  instruction: LocalizedText;
  holdSeconds: number;
  /** Repeat on the other side. */
  bothSides: boolean;
}

export interface StretchRoutine {
  id: StretchRoutineId;
  title: LocalizedText;
  description: LocalizedText;
  /** Reference poster from the PDF (see assets/exercises/stretches). */
  posterKey?: StretchPosterKey;
  moves: StretchMove[];
}

export interface WarmupStage {
  id: 'treadmill' | 'dynamic_stretches' | 'acclimation_sets';
  order: number;
  title: LocalizedText;
  detail: LocalizedText;
  durationMinutes?: RepRange;
  routineId?: StretchRoutineId;
}

// ─── Log layer (persisted) ───────────────────────────────────────────────────

export type SetType = 'warmup' | 'working';

export interface ExerciseSet {
  id: string;
  /** 1-based position within the exercise. */
  setNumber: number;
  type: SetType;
  targetReps: RepRange;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  completedAt: ISODateString | null;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  /** Snapshot of the day's prescription at session start (program may change later). */
  prescription: ExercisePrescription;
  sets: ExerciseSet[];
  skipped: boolean;
  notes: string;
}

export type SessionStatus = 'in_progress' | 'completed' | 'cancelled';

/** `plan` sessions move the rotation on "finish and advance"; the others never do. */
export type SessionKind = 'plan' | 'template' | 'extra';

/** A pause; `to` is null while the pause is still open. */
export interface PausedInterval {
  from: ISODateString;
  to: ISODateString | null;
}

export interface PersonalRecord {
  exerciseId: string;
  kind: 'top_weight' | 'estimated_1rm';
  value: number;
  previous: number | null;
  setId: string;
}

export interface SessionSummary {
  totalVolumeKg: number;
  completedSets: number;
  totalSets: number;
  /** Wall-clock seconds from start to end (including pauses). */
  durationSeconds: number;
  /** Seconds excluding paused time. Rest periods count as active. */
  activeSeconds: number;
  personalRecords: PersonalRecord[];
}

export interface WorkoutSession {
  id: string;
  schemaVersion: 2;
  kind: SessionKind;
  /** Plan and day the session was started from; null for ad-hoc extra sessions. */
  planId: string | null;
  planDayId: string | null;
  title: LocalizedText;
  /** Day code snapshot, e.g. "Push A". */
  code: string;
  focus: TrainingFocus | null;
  status: SessionStatus;
  startedAt: ISODateString;
  finishedAt: ISODateString | null;
  /** User-corrected end time; overrides `finishedAt` for duration when set. */
  endedAtOverride: ISODateString | null;
  pausedIntervals: PausedInterval[];
  /** Order is the working order; "do later" moves an exercise to the end and lists it here. */
  exercises: SessionExercise[];
  deferredIds: string[];
  currentExerciseIndex: number;
  warmupCompletedIds: string[];
  notes: string;
  summary: SessionSummary | null;
}

// ─── Rest timer ──────────────────────────────────────────────────────────────

export type RestTimerStatus = 'idle' | 'running' | 'paused';

export interface RestTimerContext {
  sessionExerciseId: string;
  /** The set just completed. */
  completedSetId: string;
  /** The set the user rests for, if any remain on this exercise. */
  nextSetId: string | null;
}

/**
 * Timestamp-based, never ticked in the store: remaining = endsAt - now.
 * Survives app backgrounding / relaunch, and ±15 s just shifts `endsAt`.
 */
export interface RestTimerState {
  status: RestTimerStatus;
  /** Total planned rest incl. adjustments (drives progress ring). */
  durationMs: number;
  /** Epoch ms when rest ends; set while running. */
  endsAt: number | null;
  /** Frozen remaining time while paused. */
  pausedRemainingMs: number | null;
  /** Epoch ms when the countdown first crossed zero (haptic/sound fired once). */
  elapsedAt: number | null;
  context: RestTimerContext | null;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface WorkoutSettings {
  /** First day of the week for weekly stats; Saturday matches the original program. */
  weekStart: WeekStart;
  autoStartRestTimer: boolean;
  /** Prefill weights/reps from the previous session of the same exercise. */
  prefillFromHistory: boolean;
  /** Seconds remaining at which the timer enters its "warning" phase. */
  restWarningSeconds: number;
  hapticsEnabled: boolean;
  restSoundEnabled: boolean;
}

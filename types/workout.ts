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
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';

// ─── Program layer ───────────────────────────────────────────────────────────

export type ExerciseOrigin = 'builtin' | 'custom';

/**
 * How the logged weight is read for analytics and PRs.
 * `per_hand`: dumbbells, the number entered is one hand. `assisted`: the number is assistance, so lighter is harder.
 */
export type WeightType = 'total' | 'per_hand' | 'bodyweight' | 'weighted_bodyweight' | 'assisted';

/**
 * One exercise in the runtime library (ADR-007). Built-ins are seeded from
 * `data/exercisesData.ts` and refreshed on update; the user-owned fields
 * (`userNotes`, `userRestSeconds`, `imageUri`, `archived`) are never touched by the seed.
 * Sessions reference exercises by id only, so renaming or archiving keeps history intact.
 */
export interface Exercise {
  id: string;
  origin: ExerciseOrigin;
  name: LocalizedText;
  /** Where the Arabic name came from; `user` for custom exercises. */
  arabicNameSource: 'pdf' | 'supplied' | 'user';
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  weightType: WeightType;
  /** Performed one side at a time (log per side or per arm). */
  isUnilateral: boolean;
  /** Technique steps in order; the first two double as the workout card cues. */
  instructions: LocalizedText[];
  breathing: LocalizedText | null;
  rangeOfMotion: LocalizedText | null;
  commonMistakes: LocalizedText[];
  /** Ids of exercises that train the same muscles (substitution candidates). */
  alternatives: string[];
  /** Curated YouTube video id for the embedded player (Phase 5); null = none yet. */
  videoId: string | null;
  /** Custom media in the app sandbox (file URI); built-ins use the bundled manifest instead. */
  imageUri: string | null;
  userNotes: string;
  /** Per-exercise rest override in seconds; null = use the plan's prescription. */
  userRestSeconds: number | null;
  archived: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** The authored part of an exercise: everything except id, origin, timestamps and user fields. */
export type ExerciseContent = Omit<Exercise, 'id' | 'origin' | 'imageUri' | 'userNotes' | 'userRestSeconds' | 'archived' | 'createdAt' | 'updatedAt'>;

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
 */
export type PlanKind = 'active' | 'template';

export interface Plan {
  id: string;
  kind: PlanKind;
  name: LocalizedText;
  description: LocalizedText | null;
  /** Template this plan was copied from, if any. */
  sourcePlanId: string | null;
  /** Locked plans cannot be edited in place (bundled templates); adopt or duplicate them instead. */
  locked: boolean;
  /** Index into `days` of the next workout in the rotation. */
  nextDayIndex: number;
  days: PlanDay[];
  /** Hidden from the Plan tab; never deleted, so history keeps its day ids. Active plans cannot be archived. */
  archived: boolean;
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

/**
 * Advanced set variants (spec §8). `type` stays warm-up/working for analytics;
 * `kind` only changes rest behaviour and the badge in the grid.
 * `drop`: no rest, strip weight and go again. `rest_pause`: 15 s mini-rest.
 * `amrap`: as many reps as possible, normal rest.
 */
export type SetKind = 'normal' | 'drop' | 'rest_pause' | 'amrap';

export interface ExerciseSet {
  id: string;
  /** 1-based position within the exercise. */
  setNumber: number;
  type: SetType;
  kind: SetKind;
  targetReps: RepRange;
  weightKg: number | null;
  reps: number | null;
  /** Optional rate of perceived exertion (6–10) and reps in reserve. */
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  completedAt: ISODateString | null;
}

/** Exercises sharing a `groupId` are performed back to back (superset = 2, giant set = 3+). */
export type ExerciseGroupKind = 'superset' | 'giant';

export interface SessionExercise {
  id: string;
  exerciseId: string;
  /** Snapshot of the day's prescription at session start (program may change later). */
  prescription: ExercisePrescription;
  sets: ExerciseSet[];
  skipped: boolean;
  notes: string;
  groupId: string | null;
  groupKind: ExerciseGroupKind | null;
  /** Phase 3: what the user did with the overload suggestion for this exercise, if anything. */
  recommendation: RecommendationDecision | null;
}

export type SessionStatus = 'in_progress' | 'completed' | 'cancelled';

/** `plan` sessions move the rotation on "finish and advance"; the others never do. */
export type SessionKind = 'plan' | 'template' | 'extra';

/** A pause; `to` is null while the pause is still open. */
export interface PausedInterval {
  from: ISODateString;
  to: ISODateString | null;
}

/**
 * Record kinds (spec §13). `estimated_1rm` is an estimate (Epley, ≤ 12 reps);
 * `reps_at_weight` is the most reps at a given weight; `set_volume` is kg × reps of one set.
 */
export type PersonalRecordKind = 'top_weight' | 'estimated_1rm' | 'reps_at_weight' | 'set_volume';

export interface PersonalRecord {
  exerciseId: string;
  kind: PersonalRecordKind;
  value: number;
  previous: number | null;
  setId: string;
  /** For `reps_at_weight`: the weight the reps were done at. */
  weightKg?: number;
}

/** Outcome of a progressive-overload suggestion for one session exercise (persisted so it survives a kill). */
export interface RecommendationDecision {
  weightKg: number | null;
  repsMin: number;
  repsMax: number;
  /** `accepted` applied the prefill; `edited` the user changed it; `dismissed` hid it for this session. */
  decision: 'accepted' | 'edited' | 'dismissed';
  decidedAt: ISODateString;
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

export type ThemeMode = 'system' | 'light' | 'dark' | 'trueBlack';
export type AccentId = 'orange' | 'blue' | 'green' | 'purple' | 'pink' | 'teal';
export type TextScale = 'default' | 'large' | 'xlarge';
export type Density = 'comfortable' | 'compact';

export interface AppearanceSettings {
  mode: ThemeMode;
  accent: AccentId;
  textScale: TextScale;
  density: Density;
}

export type LanguageSetting = 'system' | 'en' | 'ar';

export type TrainingGoal = 'hypertrophy' | 'strength' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/** Answers from onboarding; all optional, used by later recommendations. */
export interface UserProfile {
  goal: TrainingGoal | null;
  experience: ExperienceLevel | null;
  bodyweightKg: number | null;
  heightCm: number | null;
}

export interface WorkoutSettings {
  /** First-launch flow finished (or skipped). Legacy installs with history are treated as complete. */
  onboardingComplete: boolean;
  profile: UserProfile;
  appearance: AppearanceSettings;
  /** UI language; `system` follows the device. Exercise names stay English with an Arabic subtitle. */
  language: LanguageSetting;
  /** First day of the week for weekly stats; Saturday matches the original program. */
  weekStart: WeekStart;
  autoStartRestTimer: boolean;
  /** Prefill weights/reps from the previous session of the same exercise. */
  prefillFromHistory: boolean;
  /** Seconds remaining at which the timer enters its "warning" phase. */
  restWarningSeconds: number;
  hapticsEnabled: boolean;
  restSoundEnabled: boolean;
  /** Rest after a warm-up set (working sets use the prescription or the exercise override). */
  warmupRestSeconds: number;
  /** Minutes without a logged set before the workout screen offers Resume / Finish / Keep open. */
  inactivityPromptMinutes: number;
  /** Suggestion step for load increases (total / machine / barbell). Never used to round typed weights. */
  progressionStepKg: number;
  /** Suggestion step for per-hand (dumbbell) loads. */
  progressionStepPerHandKg: number;
  /** Show overload suggestions on the workout card. */
  recommendationsEnabled: boolean;
  /** Show the coach card on Today. */
  coachEnabled: boolean;
  /** Record kinds the user does not want celebrated or listed. */
  hiddenRecordKinds: PersonalRecordKind[];
  /** Coach insights the user dismissed: key → ISO date dismissed. */
  dismissedInsights: Record<string, ISODateString>;
}

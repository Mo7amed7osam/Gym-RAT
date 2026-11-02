import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';
import { create } from 'zustand';

import type { PersistedWorkoutState } from '@/data/db/repository';
import { clampDayIndex, clonePlan, getNextDay, isSessionForDay } from '@/data/plans';
import * as planEditor from '@/domain/plan/editor';
import { recommend, type Recommendation } from '@/domain/progression';
import * as reducer from '@/domain/session/reducer';
import {
  buildSessionSummary,
  getPreviousPerformance,
  getPreviousSetAt,
  type PreviousPerformance,
} from '@/lib/workoutMath';
import type {
  Exercise,
  ExerciseContent,
  ExercisePrescription,
  ExerciseSet,
  LocalizedText,
  Plan,
  PlanDay,
  RestTimerContext,
  RestTimerState,
  SessionExercise,
  SessionKind,
  SetKind,
  WorkoutSession,
  WorkoutSettings,
} from '@/types/workout';

export type { PersistedWorkoutState };

// ─── State shape ─────────────────────────────────────────────────────────────

interface WorkoutState extends PersistedWorkoutState {
  /** Day the Today screen is previewing; null = the rotation's next day. */
  previewDayIndex: number | null;
  /** Last database write failure, if any. Not persisted. */
  persistenceError: string | null;
}

export type StartWorkoutResult =
  | { ok: true; session: WorkoutSession }
  | { ok: false; reason: 'no_active_plan' | 'empty_plan' | 'session_in_progress' | 'unknown_plan' };

export type FinishMode = 'advance' | 'repeat';

export interface SetValues {
  weightKg?: number | null;
  reps?: number | null;
}

/** Fields a user may set on any exercise (built-in or custom). */
export interface ExerciseUserPatch {
  userNotes?: string;
  userRestSeconds?: number | null;
  imageUri?: string | null;
}

/** What the custom-exercise editor supplies; the store fills ids, origin and timestamps. */
export type CustomExerciseInput = Omit<ExerciseContent, 'arabicNameSource'> & { imageUri?: string | null };

interface WorkoutActions {
  // Exercise library (ADR-007)
  createCustomExercise: (input: CustomExerciseInput) => Exercise;
  /** Edits the authored fields of a custom exercise; built-ins are refused. */
  updateCustomExercise: (id: string, patch: Partial<CustomExerciseInput>) => void;
  /** Notes, rest override and photo: allowed on every exercise. */
  updateExerciseUser: (id: string, patch: ExerciseUserPatch) => void;
  /** Archives (never deletes) a custom exercise; history keeps referencing it. */
  setExerciseArchived: (id: string, archived: boolean) => void;

  // Plans & rotation
  /** Makes a template the active plan (copied), replacing the current active plan. */
  adoptPlan: (sourcePlanId: string) => Plan | null;
  /** Makes any plan the single active one: locked templates are copied, user plans flip in place (P2.3). */
  activatePlan: (planId: string) => Plan | null;

  // Plan builder (P2.3) — bundled templates throw LockedPlanError; duplicate them first.
  createPlan: (name: LocalizedText) => Plan;
  duplicatePlan: (planId: string) => Plan | null;
  renamePlan: (planId: string, name: LocalizedText, description: LocalizedText | null) => void;
  setPlanArchived: (planId: string, archived: boolean) => void;
  addPlanDay: (planId: string, code: string) => PlanDay;
  removePlanDay: (planId: string, dayId: string) => void;
  reorderPlanDay: (planId: string, dayId: string, toIndex: number) => void;
  updatePlanDay: (planId: string, dayId: string, patch: Parameters<typeof planEditor.updateDay>[2]) => void;
  addPlanExercise: (planId: string, dayId: string, exerciseId: string) => void;
  removePlanExercise: (planId: string, dayId: string, index: number) => void;
  reorderPlanExercise: (planId: string, dayId: string, from: number, to: number) => void;
  substitutePlanExercise: (planId: string, dayId: string, index: number, exerciseId: string) => void;
  updatePlanExercise: (planId: string, dayId: string, index: number, patch: Partial<Omit<ExercisePrescription, 'exerciseId'>>) => void;
  /** Points the rotation at a specific day of the active plan. */
  setNextDay: (dayIndex: number) => void;
  previewDay: (dayIndex: number | null) => void;

  // Session lifecycle
  /** Starts the rotation's next day, or a specific day; `kind` defaults to `plan`. */
  startWorkout: (options?: { dayIndex?: number; planId?: string; kind?: SessionKind }) => StartWorkoutResult;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  /** Finishes the active session. `advance` moves the rotation (plan sessions only). */
  finishWorkout: (mode?: FinishMode) => WorkoutSession | null;
  cancelWorkout: () => void;
  setSessionNotes: (notes: string) => void;
  setEndedAtOverride: (endedAt: string | null) => void;

  // Navigation inside the session
  goToExercise: (index: number) => void;
  goToNextExercise: () => void;
  goToPreviousExercise: () => void;
  deferExercise: (sessionExerciseId: string) => void;
  reorderExercise: (sessionExerciseId: string, toIndex: number) => void;
  setExerciseSkipped: (sessionExerciseId: string, skipped: boolean) => void;
  setExerciseNotes: (sessionExerciseId: string, notes: string) => void;

  // Session engine (P2.4 / P2.5)
  /** Adds an exercise to the running session after the current one; `kind` of the session is unchanged. */
  addSessionExercise: (exerciseId: string) => void;
  removeSessionExercise: (sessionExerciseId: string) => void;
  /** This session only; the plan keeps its exercise. */
  substituteSessionExercise: (sessionExerciseId: string, exerciseId: string) => void;
  /** This session only: sets / reps / rest. */
  updateSessionPrescription: (sessionExerciseId: string, patch: Partial<Pick<ExercisePrescription, 'sets' | 'reps' | 'rest'>>) => void;
  /** Writes the session's current targets (and exercise) back into the active plan's day. Plan sessions on unlocked plans only. */
  saveTargetsToPlan: (sessionExerciseId: string) => boolean;
  setNextSetKind: (sessionExerciseId: string, kind: SetKind) => void;
  setSetFeedback: (sessionExerciseId: string, setId: string, feedback: { rpe?: number | null; rir?: number | null }) => void;
  /** Prepends ramp-up warm-up sets based on the first working weight (or last session). */
  addWarmupSets: (sessionExerciseId: string) => number;
  groupSessionExercises: (sessionExerciseIds: string[]) => void;
  ungroupSessionExercise: (sessionExerciseId: string) => void;

  // Phase 3: progressive overload + coach
  /** The deterministic suggestion for a session exercise (null when disabled). Pure; no state change. */
  recommendationFor: (sessionExerciseId: string) => Recommendation | null;
  /** Writes the suggestion into the prefill of incomplete sets only and records the decision. */
  applyRecommendation: (sessionExerciseId: string) => boolean;
  dismissRecommendation: (sessionExerciseId: string) => void;
  /** The user changed the suggested targets themselves (targets sheet). */
  markRecommendationEdited: (sessionExerciseId: string, weightKg: number | null, reps: { min: number; max: number }) => void;
  dismissInsight: (key: string) => void;

  // Set logging
  updateSet: (sessionExerciseId: string, setId: string, values: SetValues) => void;
  completeSet: (sessionExerciseId: string, setId: string, values?: SetValues) => void;
  uncompleteSet: (sessionExerciseId: string, setId: string) => void;
  addSet: (sessionExerciseId: string) => void;
  removeSet: (sessionExerciseId: string, setId: string) => void;
  toggleSetType: (sessionExerciseId: string, setId: string) => void;

  // Warm-up checklist
  toggleWarmupItem: (itemId: string) => void;

  // Rest timer
  startRestTimer: (seconds: number, context?: RestTimerContext | null) => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  skipRestTimer: () => void;
  markRestTimerElapsed: (now?: number) => void;

  // History & settings
  updateSettings: (patch: Partial<WorkoutSettings>) => void;

  // Persistence plumbing (called by data/db/boot.ts)
  /** Replaces the persisted slices with what the database holds. Does not write. */
  hydrate: (state: PersistedWorkoutState) => void;
  reportPersistenceError: (message: string | null) => void;
}

export type WorkoutStore = WorkoutState & WorkoutActions;

// ─── Defaults ────────────────────────────────────────────────────────────────

export const IDLE_REST_TIMER: RestTimerState = {
  status: 'idle',
  durationMs: 0,
  endsAt: null,
  pausedRemainingMs: null,
  elapsedAt: null,
  context: null,
};

export const DEFAULT_SETTINGS: WorkoutSettings = {
  onboardingComplete: false,
  profile: { goal: null, experience: null, bodyweightKg: null, heightCm: null },
  appearance: { mode: 'system', accent: 'orange', textScale: 'default', density: 'comfortable' },
  language: 'system',
  weekStart: 'saturday',
  autoStartRestTimer: true,
  prefillFromHistory: true,
  restWarningSeconds: 15,
  hapticsEnabled: true,
  restSoundEnabled: true,
  warmupRestSeconds: 45,
  inactivityPromptMinutes: 20,
  progressionStepKg: 2.5,
  progressionStepPerHandKg: 1,
  recommendationsEnabled: true,
  coachEnabled: true,
  hiddenRecordKinds: [],
  dismissedInsights: {},
  keepScreenAwake: true,
  restNotificationsEnabled: false,
  liveActivityEnabled: true,
  healthExportEnabled: false,
  healthExportSince: null,
};

const MIN_REST_DURATION_MS = 5_000;

// ─── Write-through persistence ───────────────────────────────────────────────

export interface Persistence {
  /** Must write synchronously and throw on failure; a throw cancels the state change. */
  persist: (prev: PersistedWorkoutState, next: PersistedWorkoutState) => void;
}

let persistence: Persistence | null = null;
/** The write-through `set`, captured so `useWorkoutStore.setState` can be routed through it too. */
let guardedSet: ((partial: Partial<WorkoutStore> | ((state: WorkoutStore) => Partial<WorkoutStore>), replace?: boolean) => void) | null = null;

/** Installed once by the database boot; `null` detaches (tests). */
export function attachPersistence(adapter: Persistence | null): void {
  persistence = adapter;
}

const pickPersisted = (state: WorkoutState): PersistedWorkoutState => ({
  exercises: state.exercises,
  plans: state.plans,
  activeSession: state.activeSession,
  history: state.history,
  restTimer: state.restTimer,
  settings: state.settings,
});

const persistedChanged = (prev: WorkoutState, next: WorkoutState): boolean =>
  prev.exercises !== next.exercises ||
  prev.plans !== next.plans ||
  prev.activeSession !== next.activeSession ||
  prev.history !== next.history ||
  prev.restTimer !== next.restTimer ||
  prev.settings !== next.settings;

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** Remaining rest in ms; negative once in overtime. 0 when idle. */
export function getRestRemainingMs(timer: RestTimerState, now: number = Date.now()): number {
  if (timer.status === 'paused') return timer.pausedRemainingMs ?? 0;
  if (timer.status === 'running' && timer.endsAt !== null) return timer.endsAt - now;
  return 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildSessionExercise(
  day: PlanDay,
  index: number,
  history: readonly WorkoutSession[],
  prefill: boolean,
): SessionExercise {
  const prescription = day.exercises[index];
  const previous: PreviousPerformance | null = prefill
    ? getPreviousPerformance(history, prescription.exerciseId)
    : null;

  const sets: ExerciseSet[] = Array.from({ length: prescription.sets }, (_, i) => {
    const previousSet = getPreviousSetAt(previous?.exercise ?? null, i + 1);
    return {
      id: randomUUID(),
      setNumber: i + 1,
      type: 'working',
      kind: 'normal',
      targetReps: prescription.reps,
      weightKg: previousSet?.weightKg ?? null,
      reps: previousSet?.reps ?? null,
      rpe: null,
      rir: null,
      completed: false,
      completedAt: null,
    };
  });

  return {
    id: randomUUID(),
    exerciseId: prescription.exerciseId,
    prescription,
    sets,
    skipped: false,
    notes: '',
    groupId: null,
    groupKind: null,
    recommendation: null,
  };
}

function buildSession(
  plan: Plan,
  day: PlanDay,
  kind: SessionKind,
  history: readonly WorkoutSession[],
  settings: WorkoutSettings,
): WorkoutSession {
  return {
    id: randomUUID(),
    schemaVersion: 2,
    kind,
    planId: plan.id,
    planDayId: day.id,
    title: day.title,
    code: day.code,
    focus: day.focus,
    status: 'in_progress',
    startedAt: nowIso(),
    finishedAt: null,
    endedAtOverride: null,
    pausedIntervals: [],
    exercises: day.exercises.map((_, index) => buildSessionExercise(day, index, history, settings.prefillFromHistory)),
    deferredIds: [],
    currentExerciseIndex: 0,
    warmupCompletedIds: [],
    notes: '',
    summary: null,
  };
}

function sanitizeNumber(value: number | null | undefined, fallback: number | null): number | null {
  if (value === undefined) return fallback;
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutStore>()((rawSet, get) => {
  /**
   * Every state change goes through here: the new state is computed, the
   * persisted slices are written in one transaction, and only then does the
   * in-memory state (and the UI) change. A failed write leaves the state
   * untouched and records the error.
   */
  const set: typeof rawSet = (partial, replace) => {
    const prev = get();
    const patch = typeof partial === 'function' ? partial(prev) : partial;
    const next = (replace ? patch : { ...prev, ...patch }) as WorkoutStore;
    if (persistence && persistedChanged(prev, next)) {
      try {
        persistence.persist(pickPersisted(prev), pickPersisted(next));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[db] write failed; state change discarded', error);
        rawSet({ persistenceError: message });
        return;
      }
    }
    rawSet(next, true);
  };
  guardedSet = set as typeof guardedSet;

  /** Applies a pure reducer step to the active session, if any. */
  const updateSession = (update: (session: WorkoutSession) => WorkoutSession): void => {
    set((state) => {
      if (!state.activeSession) return {};
      const next = update(state.activeSession);
      return next === state.activeSession ? {} : { activeSession: next };
    });
  };

  const updatePlan = (planId: string, update: (plan: Plan) => Plan): void => {
    set((state) => ({ plans: state.plans.map((plan) => (plan.id === planId ? update(plan) : plan)) }));
  };

  /** Like updatePlan, but a no-op when the editor returns the same object (locked plans throw before reaching here). */
  const editPlan = (planId: string, update: (plan: Plan) => Plan): void => {
    const current = get().plans.find((plan) => plan.id === planId);
    if (!current) return;
    const next = update(current);
    if (next !== current) updatePlan(planId, () => next);
  };

  return {
    previewDayIndex: null,
    persistenceError: null,
    exercises: [],
    plans: [],
    activeSession: null,
    history: [],
    restTimer: IDLE_REST_TIMER,
    settings: DEFAULT_SETTINGS,

    // ── Plans & rotation ─────────────────────────────────────────────────

    createCustomExercise: (input) => {
      const now = nowIso();
      const exercise: Exercise = {
        ...input,
        id: randomUUID(),
        origin: 'custom',
        arabicNameSource: 'user',
        imageUri: input.imageUri ?? null,
        userNotes: '',
        userRestSeconds: null,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ exercises: [...state.exercises, exercise] }));
      return exercise;
    },

    updateCustomExercise: (id, patch) =>
      set((state) => ({
        exercises: state.exercises.map((exercise) =>
          exercise.id === id && exercise.origin === 'custom' ? { ...exercise, ...patch, updatedAt: nowIso() } : exercise,
        ),
      })),

    updateExerciseUser: (id, patch) =>
      set((state) => ({
        exercises: state.exercises.map((exercise) => (exercise.id === id ? { ...exercise, ...patch, updatedAt: nowIso() } : exercise)),
      })),

    setExerciseArchived: (id, archived) =>
      set((state) => ({
        exercises: state.exercises.map((exercise) =>
          exercise.id === id && exercise.origin === 'custom' && exercise.archived !== archived
            ? { ...exercise, archived, updatedAt: nowIso() }
            : exercise,
        ),
      })),

    adoptPlan: (sourcePlanId) => {
      const { plans } = get();
      const source = plans.find((plan) => plan.id === sourcePlanId);
      if (!source) return null;
      const adopted = clonePlan(source, randomUUID(), 'active', nowIso());
      set({
        plans: [...plans.filter((plan) => plan.kind !== 'active'), adopted],
        previewDayIndex: null,
      });
      return adopted;
    },

    activatePlan: (planId) => {
      const result = planEditor.activatePlan(get().plans, planId, randomUUID(), nowIso());
      if (!result) return null;
      set({ plans: result.plans, previewDayIndex: null });
      return result.active;
    },

    createPlan: (name) => {
      const plan = planEditor.createEmptyPlan(randomUUID(), name, nowIso());
      set((state) => ({ plans: [...state.plans, plan] }));
      return plan;
    },

    duplicatePlan: (planId) => {
      const source = get().plans.find((plan) => plan.id === planId);
      if (!source) return null;
      const copy = planEditor.duplicatePlan(source, randomUUID(), nowIso());
      set((state) => ({ plans: [...state.plans, copy] }));
      return copy;
    },

    renamePlan: (planId, name, description) => editPlan(planId, (plan) => planEditor.renamePlan(plan, name, description, nowIso())),

    setPlanArchived: (planId, archived) => editPlan(planId, (plan) => planEditor.setPlanArchived(plan, archived, nowIso())),

    addPlanDay: (planId, code) => {
      const day = planEditor.makeDay(randomUUID(), get().plans.find((plan) => plan.id === planId)?.days.length ?? 0, code);
      editPlan(planId, (plan) => planEditor.addDay(plan, day, nowIso()));
      return day;
    },

    removePlanDay: (planId, dayId) => editPlan(planId, (plan) => planEditor.removeDay(plan, dayId, nowIso())),

    reorderPlanDay: (planId, dayId, toIndex) => editPlan(planId, (plan) => planEditor.reorderDay(plan, dayId, toIndex)),

    updatePlanDay: (planId, dayId, patch) => editPlan(planId, (plan) => planEditor.updateDay(plan, dayId, patch, nowIso())),

    addPlanExercise: (planId, dayId, exerciseId) => {
      const rest = get().exercises.find((exercise) => exercise.id === exerciseId)?.userRestSeconds ?? null;
      editPlan(planId, (plan) => planEditor.addExercise(plan, dayId, planEditor.defaultPrescription(exerciseId, rest), nowIso()));
    },

    removePlanExercise: (planId, dayId, index) => editPlan(planId, (plan) => planEditor.removeExercise(plan, dayId, index, nowIso())),

    reorderPlanExercise: (planId, dayId, from, to) => editPlan(planId, (plan) => planEditor.reorderExercise(plan, dayId, from, to, nowIso())),

    substitutePlanExercise: (planId, dayId, index, exerciseId) =>
      editPlan(planId, (plan) => planEditor.substituteExercise(plan, dayId, index, exerciseId, nowIso())),

    updatePlanExercise: (planId, dayId, index, patch) =>
      editPlan(planId, (plan) => planEditor.updatePrescription(plan, dayId, index, patch, nowIso())),

    setNextDay: (dayIndex) => {
      const active = selectActivePlan(get());
      if (!active) return;
      updatePlan(active.id, (plan) => ({ ...plan, nextDayIndex: clampDayIndex(plan, dayIndex), updatedAt: nowIso() }));
      set({ previewDayIndex: null });
    },

    previewDay: (dayIndex) => set({ previewDayIndex: dayIndex }),

    // ── Session lifecycle ────────────────────────────────────────────────

    startWorkout: (options = {}) => {
      const state = get();
      if (state.activeSession) return { ok: false, reason: 'session_in_progress' };

      const plan = options.planId ? state.plans.find((item) => item.id === options.planId) : selectActivePlan(state);
      if (!plan) return { ok: false, reason: options.planId ? 'unknown_plan' : 'no_active_plan' };
      if (plan.days.length === 0) return { ok: false, reason: 'empty_plan' };

      const dayIndex = options.dayIndex ?? plan.nextDayIndex;
      const day = plan.days[clampDayIndex(plan, dayIndex)];
      const kind: SessionKind = options.kind ?? (plan.kind === 'active' ? 'plan' : 'template');
      const session = buildSession(plan, day, kind, state.history, state.settings);
      set({ activeSession: session, restTimer: IDLE_REST_TIMER, previewDayIndex: null });
      return { ok: true, session };
    },

    pauseWorkout: () => updateSession((session) => reducer.pause(session, nowIso())),

    resumeWorkout: () => updateSession((session) => reducer.resume(session, nowIso())),

    finishWorkout: (mode = 'advance') => {
      const { activeSession, history, plans } = get();
      if (!activeSession) return null;

      const finishedAt = new Date();
      const stamped = reducer.finish(activeSession, finishedAt.toISOString());
      const finished: WorkoutSession = { ...stamped, summary: buildSessionSummary(stamped, history, finishedAt) };

      let nextPlans = plans;
      const active = selectActivePlan(get());
      if (mode === 'advance' && finished.kind === 'plan' && active) {
        const dayIndex = active.days.findIndex((day) => isSessionForDay(finished, active, day));
        if (dayIndex !== -1) {
          nextPlans = plans.map((plan) =>
            plan.id === active.id ? { ...plan, nextDayIndex: clampDayIndex(plan, dayIndex + 1), updatedAt: finishedAt.toISOString() } : plan,
          );
        }
      }

      set({
        activeSession: null,
        history: [finished, ...history],
        plans: nextPlans,
        restTimer: IDLE_REST_TIMER,
      });
      return finished;
    },

    cancelWorkout: () => set({ activeSession: null, restTimer: IDLE_REST_TIMER }),

    setSessionNotes: (notes) => updateSession((session) => reducer.setNotes(session, notes)),

    setEndedAtOverride: (endedAt) => updateSession((session) => reducer.setEndedAtOverride(session, endedAt)),

    // ── Navigation ───────────────────────────────────────────────────────

    goToExercise: (index) => updateSession((session) => reducer.goToExercise(session, index)),

    goToNextExercise: () => {
      const session = get().activeSession;
      if (session) get().goToExercise(session.currentExerciseIndex + 1);
    },

    goToPreviousExercise: () => {
      const session = get().activeSession;
      if (session) get().goToExercise(session.currentExerciseIndex - 1);
    },

    deferExercise: (sessionExerciseId) => updateSession((session) => reducer.deferExercise(session, sessionExerciseId)),

    reorderExercise: (sessionExerciseId, toIndex) =>
      updateSession((session) => reducer.reorderExercise(session, sessionExerciseId, toIndex)),

    setExerciseSkipped: (sessionExerciseId, skipped) =>
      updateSession((session) => reducer.patchExercise(session, sessionExerciseId, (exercise) => ({ ...exercise, skipped }))),

    setExerciseNotes: (sessionExerciseId, notes) =>
      updateSession((session) => reducer.patchExercise(session, sessionExerciseId, (exercise) => ({ ...exercise, notes }))),

    // ── Set logging ──────────────────────────────────────────────────────

    updateSet: (sessionExerciseId, setId, values) =>
      updateSession((session) =>
        reducer.patchSet(session, sessionExerciseId, setId, (current) => ({
          ...current,
          weightKg: sanitizeNumber(values.weightKg, current.weightKg),
          reps: sanitizeNumber(values.reps, current.reps),
        })),
      ),

    completeSet: (sessionExerciseId, setId, values = {}) => {
      const session = get().activeSession;
      const exercise = session?.exercises.find((item) => item.id === sessionExerciseId);
      const target = exercise?.sets.find((item) => item.id === setId);
      if (!session || !exercise || !target || target.completed) return;

      // Missing inputs: bodyweight (0 kg) and the top of the target range.
      const weightKg = sanitizeNumber(values.weightKg, target.weightKg) ?? 0;
      const reps = sanitizeNumber(values.reps, target.reps) ?? target.targetReps.max;
      const completedSet: ExerciseSet = {
        ...target,
        weightKg,
        reps,
        completed: true,
        completedAt: nowIso(),
      };

      const targetIndex = exercise.sets.findIndex((item) => item.id === setId);
      const sets = exercise.sets.map((item, i) => {
        if (item.id === setId) return completedSet;
        // Carry the logged numbers forward into the next untouched set.
        if (i === targetIndex + 1 && !item.completed) {
          return {
            ...item,
            weightKg: item.weightKg ?? weightKg,
            reps: item.reps ?? reps,
          };
        }
        return item;
      });
      updateSession((current) => reducer.patchExercise(current, sessionExerciseId, (item) => ({ ...item, sets })));

      if (!get().settings.autoStartRestTimer) return;

      const nextSet = sets.find((item) => !item.completed) ?? null;
      const hasWorkLeft =
        nextSet !== null ||
        session.exercises.some(
          (item) => item.id !== sessionExerciseId && !item.skipped && item.sets.some((s) => !s.completed),
        );
      if (!hasWorkLeft) {
        set({ restTimer: IDLE_REST_TIMER });
        return;
      }

      const userRestSeconds = get().exercises.find((item) => item.id === exercise.exerciseId)?.userRestSeconds ?? null;
      const seconds = reducer.restSecondsAfter(get().activeSession ?? session, exercise, completedSet, {
        warmupRestSeconds: get().settings.warmupRestSeconds,
        userRestSeconds,
      });
      if (seconds <= 0) {
        set({ restTimer: IDLE_REST_TIMER });
        return;
      }
      get().startRestTimer(seconds, {
        sessionExerciseId,
        completedSetId: setId,
        nextSetId: nextSet?.id ?? null,
      });
    },

    // ── Session engine (P2.4 / P2.5) ─────────────────────────────────────

    addSessionExercise: (exerciseId) => {
      const state = get();
      if (!state.activeSession) return;
      const rest = state.exercises.find((item) => item.id === exerciseId)?.userRestSeconds ?? null;
      const prescription = planEditor.defaultPrescription(exerciseId, rest);
      const day: PlanDay = { id: 'adhoc', position: 0, code: '', title: { en: '', ar: '' }, muscleSummary: { en: '', ar: '' }, focus: null, exercises: [prescription] };
      const exercise = buildSessionExercise(day, 0, state.history, state.settings.prefillFromHistory);
      updateSession((session) => reducer.addExercise(session, exercise));
    },

    removeSessionExercise: (sessionExerciseId) => {
      updateSession((session) => reducer.removeExercise(session, sessionExerciseId));
      if (get().restTimer.context?.sessionExerciseId === sessionExerciseId) set({ restTimer: IDLE_REST_TIMER });
    },

    substituteSessionExercise: (sessionExerciseId, exerciseId) =>
      updateSession((session) => reducer.substituteExercise(session, sessionExerciseId, exerciseId)),

    updateSessionPrescription: (sessionExerciseId, patch) =>
      updateSession((session) =>
        reducer.patchPrescription(session, sessionExerciseId, patch, (setNumber, template) => ({
          id: randomUUID(),
          setNumber,
          type: 'working',
          kind: 'normal',
          targetReps: patch.reps ?? template?.targetReps ?? { min: 8, max: 12 },
          weightKg: template?.weightKg ?? null,
          reps: template?.reps ?? null,
          rpe: null,
          rir: null,
          completed: false,
          completedAt: null,
        })),
      ),

    saveTargetsToPlan: (sessionExerciseId) => {
      const state = get();
      const session = state.activeSession;
      const exercise = session?.exercises.find((item) => item.id === sessionExerciseId);
      if (!session || !exercise || session.kind !== 'plan' || !session.planDayId) return false;
      const plan = state.plans.find((item) => item.id === session.planId);
      if (!plan || plan.locked) return false;
      const day = plan.days.find((item) => item.id === session.planDayId);
      if (!day) return false;
      // The snapshot's exerciseId is the plan slot this session exercise came from; a substitution replaces that slot.
      const index = day.exercises.findIndex((item) => item.exerciseId === exercise.prescription.exerciseId);
      const now = nowIso();
      const { sets, reps, rest } = exercise.prescription;
      editPlan(plan.id, (current) => {
        if (index === -1) return planEditor.addExercise(current, day.id, { exerciseId: exercise.exerciseId, sets, reps, rest }, now);
        const substituted = planEditor.substituteExercise(current, day.id, index, exercise.exerciseId, now);
        return planEditor.updatePrescription(substituted, day.id, index, { sets, reps, rest }, now);
      });
      return true;
    },

    setNextSetKind: (sessionExerciseId, kind) => updateSession((session) => reducer.setNextSetKind(session, sessionExerciseId, kind)),

    setSetFeedback: (sessionExerciseId, setId, feedback) =>
      updateSession((session) =>
        reducer.patchSet(session, sessionExerciseId, setId, (current) => ({
          ...current,
          rpe: feedback.rpe === undefined ? current.rpe : feedback.rpe,
          rir: feedback.rir === undefined ? current.rir : feedback.rir,
        })),
      ),

    addWarmupSets: (sessionExerciseId) => {
      const session = get().activeSession;
      const exercise = session?.exercises.find((item) => item.id === sessionExerciseId);
      if (!session || !exercise) return 0;
      const firstWorking = exercise.sets.find((set) => set.type === 'working');
      const workingKg = firstWorking?.weightKg ?? getPreviousSetAt(getPreviousPerformance(get().history, exercise.exerciseId)?.exercise ?? null, 1)?.weightKg ?? null;
      if (!workingKg || workingKg < 20) return 0;
      const round = (kg: number) => Math.max(0, Math.round(kg / 2.5) * 2.5);
      const warmups = [
        { weightKg: round(workingKg * 0.5), reps: 10 },
        { weightKg: round(workingKg * 0.75), reps: 5 },
      ].filter((item, i, all) => item.weightKg > 0 && (i === 0 || item.weightKg !== all[i - 1].weightKg));
      updateSession((current) => reducer.addWarmupSets(current, sessionExerciseId, warmups, randomUUID));
      return warmups.length;
    },

    recommendationFor: (sessionExerciseId) => {
      const state = get();
      const session = state.activeSession;
      const exercise = session?.exercises.find((item) => item.id === sessionExerciseId);
      if (!session || !exercise || !state.settings.recommendationsEnabled) return null;
      const library = state.exercises.find((item) => item.id === exercise.exerciseId);
      return recommend({
        history: state.history,
        exerciseId: exercise.exerciseId,
        prescription: { reps: exercise.prescription.reps },
        weightType: library?.weightType ?? 'total',
        stepKg: state.settings.progressionStepKg,
        stepPerHandKg: state.settings.progressionStepPerHandKg,
        now: nowIso(),
        excludeSessionId: session.id,
      });
    },

    applyRecommendation: (sessionExerciseId) => {
      const recommendation = get().recommendationFor(sessionExerciseId);
      if (!recommendation || recommendation.action === 'insufficient_data') return false;
      const decidedAt = nowIso();
      updateSession((session) =>
        reducer.patchExercise(session, sessionExerciseId, (exercise) => ({
          ...exercise,
          // Prefill only: completed sets are logs and never change.
          sets: exercise.sets.map((set) =>
            set.completed || set.type === 'warmup'
              ? set
              : { ...set, weightKg: recommendation.weightKg ?? set.weightKg, reps: recommendation.reps.min, targetReps: recommendation.reps },
          ),
          recommendation: { weightKg: recommendation.weightKg, repsMin: recommendation.reps.min, repsMax: recommendation.reps.max, decision: 'accepted', decidedAt },
        })),
      );
      return true;
    },

    dismissRecommendation: (sessionExerciseId) => {
      const recommendation = get().recommendationFor(sessionExerciseId);
      updateSession((session) =>
        reducer.patchExercise(session, sessionExerciseId, (exercise) => ({
          ...exercise,
          recommendation: {
            weightKg: recommendation?.weightKg ?? null,
            repsMin: recommendation?.reps.min ?? exercise.prescription.reps.min,
            repsMax: recommendation?.reps.max ?? exercise.prescription.reps.max,
            decision: 'dismissed',
            decidedAt: nowIso(),
          },
        })),
      );
    },

    markRecommendationEdited: (sessionExerciseId, weightKg, reps) =>
      updateSession((session) =>
        reducer.patchExercise(session, sessionExerciseId, (exercise) => ({
          ...exercise,
          recommendation: { weightKg, repsMin: reps.min, repsMax: reps.max, decision: 'edited', decidedAt: nowIso() },
        })),
      ),

    dismissInsight: (key) =>
      set((state) => ({ settings: { ...state.settings, dismissedInsights: { ...state.settings.dismissedInsights, [key]: nowIso() } } })),

    groupSessionExercises: (sessionExerciseIds) => {
      if (sessionExerciseIds.length < 2) return;
      updateSession((session) => reducer.setGroup(session, sessionExerciseIds, randomUUID()));
    },

    ungroupSessionExercise: (sessionExerciseId) => {
      const session = get().activeSession;
      const exercise = session?.exercises.find((item) => item.id === sessionExerciseId);
      if (!session || !exercise?.groupId) return;
      const members = session.exercises.filter((item) => item.groupId === exercise.groupId).map((item) => item.id);
      // Removing one member from a pair dissolves the group; from a giant set it just leaves.
      updateSession((current) => (members.length <= 2 ? reducer.setGroup(current, members, null) : reducer.setGroup(current, [sessionExerciseId], null)));
    },

    uncompleteSet: (sessionExerciseId, setId) => {
      updateSession((session) =>
        reducer.patchSet(session, sessionExerciseId, setId, (current) => ({ ...current, completed: false, completedAt: null })),
      );
      if (get().restTimer.context?.completedSetId === setId) set({ restTimer: IDLE_REST_TIMER });
    },

    addSet: (sessionExerciseId) =>
      updateSession((session) =>
        reducer.patchExercise(session, sessionExerciseId, (exercise) => {
          const last = exercise.sets[exercise.sets.length - 1];
          const added: ExerciseSet = {
            id: randomUUID(),
            setNumber: exercise.sets.length + 1,
            type: 'working',
            kind: 'normal',
            targetReps: last?.targetReps ?? exercise.prescription.reps,
            weightKg: last?.weightKg ?? null,
            reps: last?.reps ?? null,
            rpe: null,
            rir: null,
            completed: false,
            completedAt: null,
          };
          return { ...exercise, sets: [...exercise.sets, added] };
        }),
      ),

    removeSet: (sessionExerciseId, setId) => {
      updateSession((session) =>
        reducer.patchExercise(session, sessionExerciseId, (exercise) => ({
          ...exercise,
          sets: reducer.renumber(exercise.sets.filter((item) => item.id !== setId)),
        })),
      );
      const context = get().restTimer.context;
      if (context?.completedSetId === setId || context?.nextSetId === setId) {
        set({ restTimer: IDLE_REST_TIMER });
      }
    },

    toggleSetType: (sessionExerciseId, setId) =>
      updateSession((session) =>
        reducer.patchSet(session, sessionExerciseId, setId, (current) => ({
          ...current,
          type: current.type === 'working' ? 'warmup' : 'working',
        })),
      ),

    // ── Checklist ────────────────────────────────────────────────────────

    toggleWarmupItem: (itemId) =>
      updateSession((session) => ({ ...session, warmupCompletedIds: toggleId(session.warmupCompletedIds, itemId) })),

    // ── Rest timer ───────────────────────────────────────────────────────

    startRestTimer: (seconds, context = null) => {
      const durationMs = Math.max(seconds * 1000, MIN_REST_DURATION_MS);
      set({
        restTimer: {
          status: 'running',
          durationMs,
          endsAt: Date.now() + durationMs,
          pausedRemainingMs: null,
          elapsedAt: null,
          context,
        },
      });
    },

    pauseRestTimer: () => {
      const timer = get().restTimer;
      if (timer.status !== 'running') return;
      set({
        restTimer: {
          ...timer,
          status: 'paused',
          endsAt: null,
          pausedRemainingMs: getRestRemainingMs(timer),
        },
      });
    },

    resumeRestTimer: () => {
      const timer = get().restTimer;
      if (timer.status !== 'paused') return;
      set({
        restTimer: {
          ...timer,
          status: 'running',
          endsAt: Date.now() + (timer.pausedRemainingMs ?? 0),
          pausedRemainingMs: null,
        },
      });
    },

    adjustRestTimer: (deltaSeconds) => {
      const timer = get().restTimer;
      if (timer.status === 'idle') return;

      const deltaMs = deltaSeconds * 1000;
      // Subtracting never pushes the timer past zero.
      const remaining = Math.max(getRestRemainingMs(timer) + deltaMs, 0);
      const appliedDelta = remaining - getRestRemainingMs(timer);
      const durationMs = Math.max(timer.durationMs + appliedDelta, remaining, MIN_REST_DURATION_MS);
      const elapsedAt = remaining > 0 ? null : timer.elapsedAt;

      set({
        restTimer:
          timer.status === 'running'
            ? { ...timer, durationMs, endsAt: Date.now() + remaining, elapsedAt }
            : { ...timer, durationMs, pausedRemainingMs: remaining, elapsedAt },
      });
    },

    skipRestTimer: () => set({ restTimer: IDLE_REST_TIMER }),

    markRestTimerElapsed: (now = Date.now()) => {
      const timer = get().restTimer;
      if (timer.status !== 'running' || timer.elapsedAt !== null) return;
      set({ restTimer: { ...timer, elapsedAt: now } });
    },

    // ── History & settings ───────────────────────────────────────────────

    updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

    // ── Persistence plumbing ─────────────────────────────────────────────

    hydrate: (state) => rawSet({ ...state }),

    reportPersistenceError: (message) => rawSet({ persistenceError: message }),
  };
});

// External writers (tests, dev tools) must persist too.
useWorkoutStore.setState = ((partial, replace) => guardedSet?.(partial as never, replace as never)) as typeof useWorkoutStore.setState;

// ─── Selectors ───────────────────────────────────────────────────────────────
// All selectors return primitives or existing references, so they are safe to
// pass straight to `useWorkoutStore(selector)` without `useShallow`.

export const selectActivePlan = (state: WorkoutState): Plan | null =>
  state.plans.find((plan) => plan.kind === 'active') ?? null;

/** The rotation's next day, or the previewed day when the user is browsing. */
export const selectPreviewedDay = (state: WorkoutState): PlanDay | null => {
  const plan = selectActivePlan(state);
  if (!plan || plan.days.length === 0) return null;
  if (state.previewDayIndex === null) return getNextDay(plan);
  return plan.days[clampDayIndex(plan, state.previewDayIndex)];
};

export const selectNextDay = (state: WorkoutState): PlanDay | null => {
  const plan = selectActivePlan(state);
  return plan ? getNextDay(plan) : null;
};

export const selectCurrentSessionExercise = (state: WorkoutState): SessionExercise | null =>
  state.activeSession?.exercises[state.activeSession.currentExerciseIndex] ?? null;

export const selectIsWorkoutActive = (state: WorkoutState): boolean => state.activeSession !== null;

export const selectIsWorkoutPaused = (state: WorkoutState): boolean =>
  state.activeSession !== null && reducer.isPaused(state.activeSession);

/** Last logged instance of an exercise; pair with `getPreviousSetAt` for the "Previous" column. */
export const selectPreviousExercise =
  (exerciseId: string) =>
  (state: WorkoutState): SessionExercise | null =>
    getPreviousPerformance(state.history, exerciseId)?.exercise ?? null;

/** History sessions for one plan day, newest first — memoize in the component if you need the array. */
export function getDayHistory(state: WorkoutState, planDayId: string): WorkoutSession[] {
  return state.history.filter((session) => session.planDayId === planDayId);
}

// ─── Exercise selectors ───────────────────────────────────────────────────────

/** Looks an exercise up by id (archived ones included, so history always resolves). */
export const selectExercise =
  (id: string | null | undefined) =>
  (state: WorkoutState): Exercise | undefined =>
    id ? state.exercises.find((exercise) => exercise.id === id) : undefined;

/**
 * Non-archived exercises for pickers and the Library, English name order.
 * Returns a new array: call it inside useMemo, never as a zustand selector.
 */
export const selectLibrary = (state: Pick<WorkoutState, 'exercises'>): Exercise[] =>
  state.exercises.filter((exercise) => !exercise.archived).sort((a, b) => a.name.en.localeCompare(b.name.en));

/** Hook form of `selectExercise`; re-renders only when that exercise changes. */
export const useExercise = (id: string | null | undefined): Exercise | undefined => useWorkoutStore(selectExercise(id));

/** Id → exercise map for list renders; memoised on the exercises slice. */
export function useExerciseMap(): Map<string, Exercise> {
  const exercises = useWorkoutStore((state) => state.exercises);
  return useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
}

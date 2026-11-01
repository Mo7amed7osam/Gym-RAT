import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import type { PersistedWorkoutState } from '@/data/db/repository';
import { getDaySchedule, weekdayFromDate } from '@/data/scheduleData';
import {
  buildSessionSummary,
  getPreviousPerformance,
  getPreviousSetAt,
  type PreviousPerformance,
} from '@/lib/workoutMath';
import type {
  DaySchedule,
  ExerciseSet,
  RestTimerContext,
  RestTimerState,
  SessionExercise,
  TrainingDay,
  Weekday,
  WorkoutSession,
  WorkoutSettings,
} from '@/types/workout';

export type { PersistedWorkoutState };

// ─── State shape ─────────────────────────────────────────────────────────────

interface WorkoutState extends PersistedWorkoutState {
  /** Manual day override from the Plan screen; null = follow the calendar. */
  selectedWeekday: Weekday | null;
  /** Last database write failure, if any. Not persisted. */
  persistenceError: string | null;
}

export type StartWorkoutResult =
  | { ok: true; session: WorkoutSession }
  | { ok: false; reason: 'not_training_day' | 'session_in_progress' };

export interface SetValues {
  weightKg?: number | null;
  reps?: number | null;
}

interface WorkoutActions {
  // Day selection
  selectWeekday: (weekday: Weekday | null) => void;

  // Session lifecycle
  startWorkout: (weekday?: Weekday) => StartWorkoutResult;
  finishWorkout: () => WorkoutSession | null;
  cancelWorkout: () => void;

  // Navigation inside the session
  goToExercise: (index: number) => void;
  goToNextExercise: () => void;
  goToPreviousExercise: () => void;
  setExerciseSkipped: (sessionExerciseId: string, skipped: boolean) => void;
  setExerciseNotes: (sessionExerciseId: string, notes: string) => void;

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
  deleteSession: (sessionId: string) => void;
  clearHistory: () => void;
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
  autoStartRestTimer: true,
  prefillFromHistory: true,
  restWarningSeconds: 15,
  hapticsEnabled: true,
  restSoundEnabled: true,
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
  activeSession: state.activeSession,
  history: state.history,
  restTimer: state.restTimer,
  settings: state.settings,
});

const persistedChanged = (prev: WorkoutState, next: WorkoutState): boolean =>
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
  day: TrainingDay,
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
      targetReps: prescription.reps,
      weightKg: previousSet?.weightKg ?? null,
      reps: previousSet?.reps ?? null,
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
  };
}

function buildSession(day: TrainingDay, history: readonly WorkoutSession[], settings: WorkoutSettings): WorkoutSession {
  return {
    id: randomUUID(),
    schemaVersion: 1,
    routineId: day.routineId,
    weekday: day.weekday,
    title: day.title,
    code: day.code,
    focus: day.focus,
    status: 'in_progress',
    startedAt: nowIso(),
    finishedAt: null,
    exercises: day.exercises.map((_, index) =>
      buildSessionExercise(day, index, history, settings.prefillFromHistory),
    ),
    currentExerciseIndex: 0,
    warmupCompletedIds: [],
    summary: null,
  };
}

function renumber(sets: ExerciseSet[]): ExerciseSet[] {
  return sets.map((set, i) => (set.setNumber === i + 1 ? set : { ...set, setNumber: i + 1 }));
}

function sanitizeNumber(value: number | null | undefined, fallback: number | null): number | null {
  if (value === undefined) return fallback;
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function clampIndex(session: WorkoutSession, index: number): number {
  return Math.min(Math.max(index, 0), Math.max(session.exercises.length - 1, 0));
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

      /** Immutable update of one exercise inside the active session. */
      const patchExercise = (
        sessionExerciseId: string,
        update: (exercise: SessionExercise) => SessionExercise,
      ): void => {
        set((state) => {
          if (!state.activeSession) return {};
          return {
            activeSession: {
              ...state.activeSession,
              exercises: state.activeSession.exercises.map((exercise) =>
                exercise.id === sessionExerciseId ? update(exercise) : exercise,
              ),
            },
          };
        });
      };

      const patchSet = (
        sessionExerciseId: string,
        setId: string,
        update: (current: ExerciseSet) => ExerciseSet,
      ): void => {
        patchExercise(sessionExerciseId, (exercise) => ({
          ...exercise,
          sets: exercise.sets.map((item) => (item.id === setId ? update(item) : item)),
        }));
      };

      return {
        selectedWeekday: null,
        persistenceError: null,
        activeSession: null,
        history: [],
        restTimer: IDLE_REST_TIMER,
        settings: DEFAULT_SETTINGS,

        // ── Day selection ────────────────────────────────────────────────────

        selectWeekday: (weekday) => set({ selectedWeekday: weekday }),

        // ── Session lifecycle ────────────────────────────────────────────────

        startWorkout: (weekday) => {
          const { activeSession, history, settings } = get();
          if (activeSession) return { ok: false, reason: 'session_in_progress' };

          const day = getDaySchedule(weekday ?? selectActiveWeekday(get()));
          if (day.kind !== 'training') return { ok: false, reason: 'not_training_day' };

          const session = buildSession(day, history, settings);
          set({ activeSession: session, restTimer: IDLE_REST_TIMER });
          return { ok: true, session };
        },

        finishWorkout: () => {
          const { activeSession, history } = get();
          if (!activeSession) return null;

          const finishedAt = new Date();
          const finished: WorkoutSession = {
            ...activeSession,
            status: 'completed',
            finishedAt: finishedAt.toISOString(),
            summary: buildSessionSummary(activeSession, history, finishedAt),
          };
          set({
            activeSession: null,
            history: [finished, ...history],
            restTimer: IDLE_REST_TIMER,
          });
          return finished;
        },

        cancelWorkout: () => set({ activeSession: null, restTimer: IDLE_REST_TIMER }),

        // ── Navigation ───────────────────────────────────────────────────────

        goToExercise: (index) =>
          set((state) =>
            state.activeSession
              ? { activeSession: { ...state.activeSession, currentExerciseIndex: clampIndex(state.activeSession, index) } }
              : {},
          ),

        goToNextExercise: () => {
          const session = get().activeSession;
          if (session) get().goToExercise(session.currentExerciseIndex + 1);
        },

        goToPreviousExercise: () => {
          const session = get().activeSession;
          if (session) get().goToExercise(session.currentExerciseIndex - 1);
        },

        setExerciseSkipped: (sessionExerciseId, skipped) =>
          patchExercise(sessionExerciseId, (exercise) => ({ ...exercise, skipped })),

        setExerciseNotes: (sessionExerciseId, notes) =>
          patchExercise(sessionExerciseId, (exercise) => ({ ...exercise, notes })),

        // ── Set logging ──────────────────────────────────────────────────────

        updateSet: (sessionExerciseId, setId, values) =>
          patchSet(sessionExerciseId, setId, (current) => ({
            ...current,
            weightKg: sanitizeNumber(values.weightKg, current.weightKg),
            reps: sanitizeNumber(values.reps, current.reps),
          })),

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
          patchExercise(sessionExerciseId, (current) => ({ ...current, sets }));

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

          get().startRestTimer(exercise.prescription.rest.defaultSeconds, {
            sessionExerciseId,
            completedSetId: setId,
            nextSetId: nextSet?.id ?? null,
          });
        },

        uncompleteSet: (sessionExerciseId, setId) => {
          patchSet(sessionExerciseId, setId, (current) => ({ ...current, completed: false, completedAt: null }));
          if (get().restTimer.context?.completedSetId === setId) set({ restTimer: IDLE_REST_TIMER });
        },

        addSet: (sessionExerciseId) =>
          patchExercise(sessionExerciseId, (exercise) => {
            const last = exercise.sets[exercise.sets.length - 1];
            const added: ExerciseSet = {
              id: randomUUID(),
              setNumber: exercise.sets.length + 1,
              type: 'working',
              targetReps: last?.targetReps ?? exercise.prescription.reps,
              weightKg: last?.weightKg ?? null,
              reps: last?.reps ?? null,
              completed: false,
              completedAt: null,
            };
            return { ...exercise, sets: [...exercise.sets, added] };
          }),

        removeSet: (sessionExerciseId, setId) => {
          patchExercise(sessionExerciseId, (exercise) => ({
            ...exercise,
            sets: renumber(exercise.sets.filter((item) => item.id !== setId)),
          }));
          const context = get().restTimer.context;
          if (context?.completedSetId === setId || context?.nextSetId === setId) {
            set({ restTimer: IDLE_REST_TIMER });
          }
        },

        toggleSetType: (sessionExerciseId, setId) =>
          patchSet(sessionExerciseId, setId, (current) => ({
            ...current,
            type: current.type === 'working' ? 'warmup' : 'working',
          })),

        // ── Checklists ───────────────────────────────────────────────────────

        toggleWarmupItem: (itemId) =>
          set((state) =>
            state.activeSession
              ? {
                  activeSession: {
                    ...state.activeSession,
                    warmupCompletedIds: toggleId(state.activeSession.warmupCompletedIds, itemId),
                  },
                }
              : {},
          ),

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

        deleteSession: (sessionId) =>
          set((state) => ({ history: state.history.filter((session) => session.id !== sessionId) })),

        clearHistory: () => set({ history: [] }),

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

export function selectActiveWeekday(state: WorkoutState, now: Date = new Date()): Weekday {
  return state.selectedWeekday ?? weekdayFromDate(now);
}

export function selectActiveDaySchedule(state: WorkoutState): DaySchedule {
  return getDaySchedule(selectActiveWeekday(state));
}

export const selectTodaySchedule = (): DaySchedule => getDaySchedule(weekdayFromDate(new Date()));

export const selectCurrentSessionExercise = (state: WorkoutState): SessionExercise | null =>
  state.activeSession?.exercises[state.activeSession.currentExerciseIndex] ?? null;

export const selectIsWorkoutActive = (state: WorkoutState): boolean => state.activeSession !== null;

/** Last logged instance of an exercise; pair with `getPreviousSetAt` for the "Previous" column. */
export const selectPreviousExercise =
  (exerciseId: string) =>
  (state: WorkoutState): SessionExercise | null =>
    getPreviousPerformance(state.history, exerciseId)?.exercise ?? null;

/** History sessions for one routine, newest first — memoize in the component if you need the array. */
export function getRoutineHistory(state: WorkoutState, routineId: WorkoutSession['routineId']): WorkoutSession[] {
  return state.history.filter((session) => session.routineId === routineId);
}

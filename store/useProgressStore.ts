import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { EMPTY_PROGRESS, type PersistedProgressState } from '@/data/db/progressRepository';
import { isValidBodyValue } from '@/domain/analytics/body';
import type { BodyEntry, BodyMetricKind, Goal, GoalKind } from '@/types/progress';

/**
 * Body measurements and goals (ADR-011). Kept apart from the workout store so
 * Phase 3 and Phase 4 never edit the same state shape. Same write-through
 * contract: the database commits first, then the state changes; a failed
 * write leaves the state untouched and records `persistenceError`.
 */

interface ProgressState extends PersistedProgressState {
  persistenceError: string | null;
}

export interface BodyEntryInput {
  kind: BodyMetricKind;
  value: number;
  measuredAt: string;
  note?: string;
}

export interface GoalInput {
  kind: GoalKind;
  exerciseId?: string | null;
  bodyMetric?: BodyMetricKind | null;
  targetValue: number;
  baselineValue: number | null;
  deadline?: string | null;
}

interface ProgressActions {
  /** Returns null (and writes nothing) when the value is outside the kind's plausible range. */
  addBodyEntry: (input: BodyEntryInput) => BodyEntry | null;
  updateBodyEntry: (id: string, patch: Partial<Pick<BodyEntry, 'value' | 'measuredAt' | 'note'>>) => boolean;
  deleteBodyEntry: (id: string) => void;
  /** Null when the write failed. */
  createGoal: (input: GoalInput) => Goal | null;
  updateGoal: (id: string, patch: Partial<Pick<Goal, 'targetValue' | 'deadline'>>) => void;
  setGoalArchived: (id: string, archived: boolean) => void;
  deleteGoal: (id: string) => void;
  /** Stamps `achievedAt` on goals that do not have one yet; idempotent. */
  markGoalsAchieved: (ids: readonly string[], at: string) => void;
  hydrate: (state: PersistedProgressState) => void;
}

export type ProgressStore = ProgressState & ProgressActions;

export interface ProgressPersistence {
  persist: (prev: PersistedProgressState, next: PersistedProgressState) => void;
}

let persistence: ProgressPersistence | null = null;

/** Installed by the database boot; `null` detaches (tests, reset). */
export function attachProgressPersistence(adapter: ProgressPersistence | null): void {
  persistence = adapter;
}

const pick = (state: ProgressState): PersistedProgressState => ({ bodyEntries: state.bodyEntries, goals: state.goals });

const nowIso = () => new Date().toISOString();

const byMeasuredAt = (a: BodyEntry, b: BodyEntry) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt) || a.id.localeCompare(b.id);

export const useProgressStore = create<ProgressStore>()((rawSet, get) => {
  const set = (patch: Partial<PersistedProgressState>): boolean => {
    const prev = get();
    const next = { ...prev, ...patch };
    if (persistence && (prev.bodyEntries !== next.bodyEntries || prev.goals !== next.goals)) {
      try {
        persistence.persist(pick(prev), pick(next));
      } catch (error) {
        console.error('[db] progress write failed; state change discarded', error);
        rawSet({ persistenceError: error instanceof Error ? error.message : String(error) });
        return false;
      }
    }
    rawSet({ ...patch, persistenceError: null });
    return true;
  };

  const patchGoal = (id: string, update: (goal: Goal) => Goal | null) => {
    const goals = get().goals;
    let changed = false;
    const next = goals.map((goal) => {
      if (goal.id !== id) return goal;
      const updated = update(goal);
      if (!updated || updated === goal) return goal;
      changed = true;
      return updated;
    });
    if (changed) set({ goals: next });
  };

  return {
    ...EMPTY_PROGRESS,
    persistenceError: null,

    addBodyEntry: (input) => {
      if (!isValidBodyValue(input.kind, input.value) || Number.isNaN(Date.parse(input.measuredAt))) return null;
      const at = nowIso();
      const entry: BodyEntry = {
        id: randomUUID(),
        kind: input.kind,
        value: Math.round(input.value * 10) / 10,
        measuredAt: input.measuredAt,
        note: input.note?.trim() ?? '',
        createdAt: at,
        updatedAt: at,
      };
      return set({ bodyEntries: [...get().bodyEntries, entry].sort(byMeasuredAt) }) ? entry : null;
    },

    updateBodyEntry: (id, patch) => {
      const current = get().bodyEntries.find((entry) => entry.id === id);
      if (!current) return false;
      const next: BodyEntry = { ...current, ...patch, updatedAt: nowIso() };
      if (!isValidBodyValue(next.kind, next.value) || Number.isNaN(Date.parse(next.measuredAt))) return false;
      return set({ bodyEntries: get().bodyEntries.map((entry) => (entry.id === id ? next : entry)).sort(byMeasuredAt) });
    },

    deleteBodyEntry: (id) => {
      const entries = get().bodyEntries;
      if (entries.some((entry) => entry.id === id)) set({ bodyEntries: entries.filter((entry) => entry.id !== id) });
    },

    createGoal: (input) => {
      const at = nowIso();
      const goal: Goal = {
        id: randomUUID(),
        kind: input.kind,
        exerciseId: input.exerciseId ?? null,
        bodyMetric: input.bodyMetric ?? null,
        targetValue: input.targetValue,
        baselineValue: input.baselineValue,
        deadline: input.deadline ?? null,
        achievedAt: null,
        archived: false,
        createdAt: at,
        updatedAt: at,
      };
      return set({ goals: [...get().goals, goal] }) ? goal : null;
    },

    updateGoal: (id, patch) => patchGoal(id, (goal) => ({ ...goal, ...patch, achievedAt: null, updatedAt: nowIso() })),

    setGoalArchived: (id, archived) =>
      patchGoal(id, (goal) => (goal.archived === archived ? null : { ...goal, archived, updatedAt: nowIso() })),

    deleteGoal: (id) => {
      const goals = get().goals;
      if (goals.some((goal) => goal.id === id)) set({ goals: goals.filter((goal) => goal.id !== id) });
    },

    markGoalsAchieved: (ids, at) => {
      if (ids.length === 0) return;
      const wanted = new Set(ids);
      const goals = get().goals;
      if (!goals.some((goal) => wanted.has(goal.id) && goal.achievedAt === null)) return;
      set({ goals: goals.map((goal) => (wanted.has(goal.id) && goal.achievedAt === null ? { ...goal, achievedAt: at, updatedAt: at } : goal)) });
    },

    hydrate: (state) => rawSet({ ...state, persistenceError: null }),
  };
});

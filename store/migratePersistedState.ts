import type { WorkoutSession, WorkoutSettings } from '@/types/workout';

/**
 * Upgrades a persisted state blob written by an older app version. Pure and
 * cumulative: a v1 blob passes through every step. Used by the SQLite importer
 * for the legacy AsyncStorage blob (`{ state, version }`).
 *
 * v1 → v2: (sync queue added; nothing to do here)
 * v2 → v3: server sync removed → drop `syncQueue`
 * v3 → v4: cool-down and fixed weight increment removed
 * v4 → v5: weekday schedule → plan rotation (sessions reference PDF plan day ids)
 */
import { PDF_PROGRAM_ID, pdfDayId } from '@/data/seeds/pdfProgram';

export const PERSISTED_STATE_VERSION = 5;

export function migratePersistedState(persisted: Record<string, unknown>, version: number): Record<string, unknown> {
  let state = { ...persisted };

  if (version < 3) {
    const { syncQueue: _dropped, ...rest } = state;
    state = rest;
  }

  if (version < 4) {
    const stripSession = (session: WorkoutSession & { cooldownCompletedIds?: unknown }): WorkoutSession => {
      const { cooldownCompletedIds: _ids, ...rest } = session;
      return rest;
    };
    const { weightIncrementKg: _step, ...settings } = (state.settings ?? {}) as WorkoutSettings & { weightIncrementKg?: unknown };
    const activeSession = state.activeSession as (WorkoutSession & { cooldownCompletedIds?: unknown }) | null | undefined;
    const history = (state.history ?? []) as (WorkoutSession & { cooldownCompletedIds?: unknown })[];
    state = {
      ...state,
      activeSession: activeSession ? stripSession(activeSession) : (activeSession ?? null),
      history: history.map(stripSession),
      settings,
    };
  }

  if (version < 5) {
    type Legacy = WorkoutSession & { routineId?: string; weekday?: string; schemaVersion: number };
    const upgrade = (session: Legacy): WorkoutSession => {
      const { routineId, weekday: _weekday, ...rest } = session;
      const summary = rest.summary ? { ...rest.summary, activeSeconds: rest.summary.activeSeconds ?? rest.summary.durationSeconds } : null;
      return {
        ...rest,
        schemaVersion: 2,
        kind: 'plan',
        planId: PDF_PROGRAM_ID,
        planDayId: routineId ? pdfDayId(routineId) : null,
        focus: rest.focus ?? null,
        endedAtOverride: null,
        pausedIntervals: [],
        deferredIds: [],
        notes: rest.notes ?? '',
        summary,
      };
    };
    const activeSession = state.activeSession as Legacy | null | undefined;
    const history = (state.history ?? []) as Legacy[];
    const settings = { weekStart: 'saturday', ...((state.settings ?? {}) as object) };
    state = {
      ...state,
      activeSession: activeSession ? upgrade(activeSession) : (activeSession ?? null),
      history: history.map(upgrade),
      settings,
    };
  }

  return state;
}

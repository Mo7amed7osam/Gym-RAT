import type { WorkoutSession, WorkoutSettings } from '@/types/workout';

/**
 * Upgrades a persisted state blob written by an older app version. Pure and
 * cumulative: a v1 blob passes through every step. Used by the SQLite importer
 * for the legacy AsyncStorage blob (`{ state, version }`).
 *
 * v1 → v2: (sync queue added; nothing to do here)
 * v2 → v3: server sync removed → drop `syncQueue`
 * v3 → v4: cool-down and fixed weight increment removed
 */
export const PERSISTED_STATE_VERSION = 4;

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

  return state;
}

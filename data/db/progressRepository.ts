import type { BodyEntry, BodyMetricKind, Goal, GoalKind } from '@/types/progress';

import type { Driver } from './driver';

/** The Phase 4 slices that live in the database (ADR-011). */
export interface PersistedProgressState {
  /** Oldest measurement first. */
  bodyEntries: BodyEntry[];
  /** Creation order. */
  goals: Goal[];
}

export const EMPTY_PROGRESS: PersistedProgressState = { bodyEntries: [], goals: [] };

interface BodyRow {
  id: string;
  kind: string;
  value: number;
  measured_at: string;
  note: string;
  created_at: string;
  updated_at: string;
}

interface GoalRow {
  id: string;
  kind: string;
  exercise_id: string | null;
  body_metric: string | null;
  target_value: number;
  baseline_value: number | null;
  deadline: string | null;
  achieved_at: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

/**
 * Reads and writes `body_metrics` and `goals`. Same contract as
 * `WorkoutRepository`: every write is one transaction and a throw means
 * nothing changed.
 */
export class ProgressRepository {
  constructor(private readonly driver: Driver) {}

  loadAll(): PersistedProgressState {
    return {
      bodyEntries: this.driver.all<BodyRow>('SELECT * FROM body_metrics ORDER BY measured_at, id').map((row) => ({
        id: row.id,
        kind: row.kind as BodyMetricKind,
        value: row.value,
        measuredAt: row.measured_at,
        note: row.note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      goals: this.driver.all<GoalRow>('SELECT * FROM goals ORDER BY created_at, id').map((row) => ({
        id: row.id,
        kind: row.kind as GoalKind,
        exerciseId: row.exercise_id,
        bodyMetric: row.body_metric as BodyMetricKind | null,
        targetValue: row.target_value,
        baselineValue: row.baseline_value,
        deadline: row.deadline,
        achievedAt: row.achieved_at,
        archived: row.archived === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  }

  /** Writes what changed between two states (by id + reference). */
  persistDiff(prev: PersistedProgressState, next: PersistedProgressState): void {
    if (prev.bodyEntries === next.bodyEntries && prev.goals === next.goals) return;
    this.driver.transaction(() => {
      if (prev.bodyEntries !== next.bodyEntries) {
        diffById(prev.bodyEntries, next.bodyEntries, (entry) => this.upsertBodyEntry(entry), (id) => this.driver.run('DELETE FROM body_metrics WHERE id = ?', [id]));
      }
      if (prev.goals !== next.goals) {
        diffById(prev.goals, next.goals, (goal) => this.upsertGoal(goal), (id) => this.driver.run('DELETE FROM goals WHERE id = ?', [id]));
      }
    });
  }

  /** Must be called inside a transaction. */
  upsertBodyEntry(entry: BodyEntry): void {
    this.driver.run(
      `INSERT INTO body_metrics (id, kind, value, measured_at, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, value = excluded.value, measured_at = excluded.measured_at,
         note = excluded.note, created_at = excluded.created_at, updated_at = excluded.updated_at`,
      [entry.id, entry.kind, entry.value, entry.measuredAt, entry.note, entry.createdAt, entry.updatedAt],
    );
  }

  /** Must be called inside a transaction. */
  upsertGoal(goal: Goal): void {
    this.driver.run(
      `INSERT INTO goals (id, kind, exercise_id, body_metric, target_value, baseline_value, deadline, achieved_at, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, exercise_id = excluded.exercise_id, body_metric = excluded.body_metric,
         target_value = excluded.target_value, baseline_value = excluded.baseline_value, deadline = excluded.deadline,
         achieved_at = excluded.achieved_at, archived = excluded.archived, created_at = excluded.created_at, updated_at = excluded.updated_at`,
      [
        goal.id,
        goal.kind,
        goal.exerciseId,
        goal.bodyMetric,
        goal.targetValue,
        goal.baselineValue,
        goal.deadline,
        goal.achievedAt,
        goal.archived,
        goal.createdAt,
        goal.updatedAt,
      ],
    );
  }
}

function diffById<T extends { id: string }>(prev: readonly T[], next: readonly T[], upsert: (item: T) => void, remove: (id: string) => void): void {
  const prevById = new Map(prev.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));
  for (const item of next) {
    if (prevById.get(item.id) !== item) upsert(item);
  }
  for (const id of prevById.keys()) {
    if (!nextIds.has(id)) remove(id);
  }
}

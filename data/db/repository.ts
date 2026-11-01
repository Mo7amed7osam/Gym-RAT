import type { ExerciseSet, RestTimerState, SessionExercise, WorkoutSession, WorkoutSettings } from '@/types/workout';

import type { Driver } from './driver';
import { KV } from './schema';

/** The slices of store state that live in the database. */
export interface PersistedWorkoutState {
  activeSession: WorkoutSession | null;
  /** Finished sessions, newest first. */
  history: WorkoutSession[];
  restTimer: RestTimerState;
  settings: WorkoutSettings;
}

export interface RowCounts {
  sessions: number;
  exercises: number;
  sets: number;
}

interface SessionRow {
  id: string;
  schema_version: number;
  routine_id: string;
  weekday: string;
  title_json: string;
  code: string;
  focus: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  current_exercise_index: number;
  warmup_completed_json: string;
  summary_json: string | null;
}

interface ExerciseRow {
  id: string;
  session_id: string;
  position: number;
  exercise_id: string;
  prescription_json: string;
  skipped: number;
  notes: string;
}

interface SetRow {
  id: string;
  session_exercise_id: string;
  set_number: number;
  type: string;
  target_min: number;
  target_max: number;
  weight_kg: number | null;
  reps: number | null;
  completed: number;
  completed_at: string | null;
}

/**
 * All reads and writes for workout data. Every write happens inside one
 * transaction; callers (the store's `set` wrapper) treat a thrown error as
 * "nothing changed".
 */
export class WorkoutRepository {
  constructor(private readonly driver: Driver) {}

  // ── Reads ─────────────────────────────────────────────────────────────

  loadAll(defaults: Pick<PersistedWorkoutState, 'restTimer' | 'settings'>): PersistedWorkoutState {
    const sessions = this.loadSessions();
    const active = sessions.filter((session) => session.status === 'in_progress');
    if (active.length > 1) {
      console.warn(`[db] ${active.length} in-progress sessions found; keeping the most recent`);
    }
    return {
      activeSession: active[0] ?? null,
      history: sessions.filter((session) => session.status !== 'in_progress'),
      restTimer: this.readKv<RestTimerState>(KV.restTimer) ?? defaults.restTimer,
      settings: { ...defaults.settings, ...(this.readKv<Partial<WorkoutSettings>>(KV.settings) ?? {}) },
    };
  }

  counts(): RowCounts {
    const count = (table: string) => Number(this.driver.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0);
    return { sessions: count('sessions'), exercises: count('session_exercises'), sets: count('sets') };
  }

  readKv<T>(key: string): T | null {
    const row = this.driver.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
    return row ? (JSON.parse(row.value) as T) : null;
  }

  // ── Writes ────────────────────────────────────────────────────────────

  /**
   * Persists what changed between two store states. Slices are compared by
   * reference; history sessions by id + reference.
   */
  persistDiff(prev: PersistedWorkoutState, next: PersistedWorkoutState): void {
    if (
      prev.activeSession === next.activeSession &&
      prev.history === next.history &&
      prev.restTimer === next.restTimer &&
      prev.settings === next.settings
    ) {
      return;
    }
    this.driver.transaction(() => {
      if (prev.history !== next.history) {
        const prevById = new Map(prev.history.map((session) => [session.id, session]));
        const nextIds = new Set(next.history.map((session) => session.id));
        for (const session of next.history) {
          if (prevById.get(session.id) !== session) this.upsertSession(session);
        }
        for (const id of prevById.keys()) {
          if (!nextIds.has(id)) this.deleteSession(id);
        }
      }
      if (prev.activeSession !== next.activeSession) {
        if (next.activeSession) {
          this.upsertSession(next.activeSession);
        } else if (prev.activeSession && !next.history.some((session) => session.id === prev.activeSession?.id)) {
          // Discarded (not finished): the finished case was upserted via history above.
          this.deleteSession(prev.activeSession.id);
        }
      }
      if (prev.restTimer !== next.restTimer) this.writeKv(KV.restTimer, next.restTimer);
      if (prev.settings !== next.settings) this.writeKv(KV.settings, next.settings);
    });
  }

  /** Replaces every row with the given state (used by the one-time importer). */
  replaceAll(state: PersistedWorkoutState): void {
    this.driver.transaction(() => {
      this.driver.exec('DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions;');
      for (const session of state.history) this.upsertSession(session);
      if (state.activeSession) this.upsertSession(state.activeSession);
      this.writeKv(KV.restTimer, state.restTimer);
      this.writeKv(KV.settings, state.settings);
    });
  }

  writeKv(key: string, value: unknown): void {
    this.driver.run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
      key,
      JSON.stringify(value),
    ]);
  }

  deleteKv(key: string): void {
    this.driver.run('DELETE FROM kv WHERE key = ?', [key]);
  }

  /** Must be called inside a transaction. Whole-session replace: cheap and atomic. */
  upsertSession(session: WorkoutSession): void {
    const d = this.driver;
    d.run(
      `INSERT INTO sessions (id, schema_version, routine_id, weekday, title_json, code, focus, status, started_at, finished_at,
         current_exercise_index, warmup_completed_json, summary_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         schema_version = excluded.schema_version, routine_id = excluded.routine_id, weekday = excluded.weekday,
         title_json = excluded.title_json, code = excluded.code, focus = excluded.focus, status = excluded.status,
         started_at = excluded.started_at, finished_at = excluded.finished_at,
         current_exercise_index = excluded.current_exercise_index, warmup_completed_json = excluded.warmup_completed_json,
         summary_json = excluded.summary_json, updated_at = excluded.updated_at`,
      [
        session.id,
        session.schemaVersion,
        session.routineId,
        session.weekday,
        JSON.stringify(session.title),
        session.code,
        session.focus,
        session.status,
        session.startedAt,
        session.finishedAt,
        session.currentExerciseIndex,
        JSON.stringify(session.warmupCompletedIds),
        session.summary ? JSON.stringify(session.summary) : null,
        new Date().toISOString(),
      ],
    );
    d.run('DELETE FROM sets WHERE session_exercise_id IN (SELECT id FROM session_exercises WHERE session_id = ?)', [session.id]);
    d.run('DELETE FROM session_exercises WHERE session_id = ?', [session.id]);
    session.exercises.forEach((exercise, position) => {
      d.run(
        'INSERT INTO session_exercises (id, session_id, position, exercise_id, prescription_json, skipped, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [exercise.id, session.id, position, exercise.exerciseId, JSON.stringify(exercise.prescription), exercise.skipped, exercise.notes],
      );
      for (const set of exercise.sets) {
        d.run(
          'INSERT INTO sets (id, session_exercise_id, set_number, type, target_min, target_max, weight_kg, reps, completed, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [set.id, exercise.id, set.setNumber, set.type, set.targetReps.min, set.targetReps.max, set.weightKg, set.reps, set.completed, set.completedAt],
        );
      }
    });
  }

  /** Must be called inside a transaction. */
  deleteSession(id: string): void {
    this.driver.run('DELETE FROM sets WHERE session_exercise_id IN (SELECT id FROM session_exercises WHERE session_id = ?)', [id]);
    this.driver.run('DELETE FROM session_exercises WHERE session_id = ?', [id]);
    this.driver.run('DELETE FROM sessions WHERE id = ?', [id]);
  }

  // ── Row mapping ───────────────────────────────────────────────────────

  private loadSessions(): WorkoutSession[] {
    const sessionRows = this.driver.all<SessionRow>('SELECT * FROM sessions ORDER BY started_at DESC, id');
    if (sessionRows.length === 0) return [];
    const exerciseRows = this.driver.all<ExerciseRow>('SELECT * FROM session_exercises ORDER BY session_id, position');
    const setRows = this.driver.all<SetRow>('SELECT * FROM sets ORDER BY session_exercise_id, set_number');

    const setsByExercise = new Map<string, ExerciseSet[]>();
    for (const row of setRows) {
      const list = setsByExercise.get(row.session_exercise_id) ?? [];
      list.push({
        id: row.id,
        setNumber: row.set_number,
        type: row.type as ExerciseSet['type'],
        targetReps: { min: row.target_min, max: row.target_max },
        weightKg: row.weight_kg,
        reps: row.reps,
        completed: row.completed === 1,
        completedAt: row.completed_at,
      });
      setsByExercise.set(row.session_exercise_id, list);
    }

    const exercisesBySession = new Map<string, SessionExercise[]>();
    for (const row of exerciseRows) {
      const list = exercisesBySession.get(row.session_id) ?? [];
      list.push({
        id: row.id,
        exerciseId: row.exercise_id,
        prescription: JSON.parse(row.prescription_json) as SessionExercise['prescription'],
        sets: setsByExercise.get(row.id) ?? [],
        skipped: row.skipped === 1,
        notes: row.notes,
      });
      exercisesBySession.set(row.session_id, list);
    }

    return sessionRows.map((row) => ({
      id: row.id,
      schemaVersion: 1,
      routineId: row.routine_id as WorkoutSession['routineId'],
      weekday: row.weekday as WorkoutSession['weekday'],
      title: JSON.parse(row.title_json) as WorkoutSession['title'],
      code: row.code,
      focus: row.focus as WorkoutSession['focus'],
      status: row.status as WorkoutSession['status'],
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      exercises: exercisesBySession.get(row.id) ?? [],
      currentExerciseIndex: row.current_exercise_index,
      warmupCompletedIds: JSON.parse(row.warmup_completed_json) as string[],
      summary: row.summary_json ? (JSON.parse(row.summary_json) as WorkoutSession['summary']) : null,
    }));
  }
}

import type { ExerciseSet, Plan, PlanDay, RestTimerState, SessionExercise, WorkoutSession, WorkoutSettings } from '@/types/workout';

import type { Driver } from './driver';
import { KV } from './schema';

/** The slices of store state that live in the database. */
export interface PersistedWorkoutState {
  /** Every plan (active, templates, references). */
  plans: Plan[];
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
  plans: number;
}

interface SessionRow {
  id: string;
  kind: string;
  plan_id: string | null;
  plan_day_id: string | null;
  title_json: string;
  code: string;
  focus: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  ended_at_override: string | null;
  paused_intervals_json: string;
  deferred_ids_json: string;
  current_exercise_index: number;
  warmup_completed_json: string;
  notes: string;
  summary_json: string | null;
}

type SessionSummaryShape = NonNullable<WorkoutSession['summary']>;

/** Defaults first, then stored values; nested appearance is merged too so new keys get defaults. */
export function mergeSettings(defaults: WorkoutSettings, stored: Partial<WorkoutSettings> | null): WorkoutSettings {
  return {
    ...defaults,
    ...(stored ?? {}),
    appearance: { ...defaults.appearance, ...(stored?.appearance ?? {}) },
  };
}

interface PlanRow {
  id: string;
  kind: string;
  name_json: string;
  description_json: string | null;
  source_plan_id: string | null;
  locked: number;
  next_day_index: number;
  created_at: string;
  updated_at: string;
}

interface PlanDayRow {
  id: string;
  plan_id: string;
  position: number;
  code: string;
  title_json: string;
  muscle_summary_json: string;
  focus: string | null;
}

interface PlanExerciseRow {
  id: string;
  plan_day_id: string;
  position: number;
  exercise_id: string;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_default: number;
  rest_min: number;
  rest_max: number;
  note_json: string | null;
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
      plans: this.loadPlans(),
      activeSession: active[0] ?? null,
      history: sessions.filter((session) => session.status !== 'in_progress'),
      restTimer: this.readKv<RestTimerState>(KV.restTimer) ?? defaults.restTimer,
      settings: mergeSettings(defaults.settings, this.readKv<Partial<WorkoutSettings>>(KV.settings)),
    };
  }

  counts(): RowCounts {
    const count = (table: string) => Number(this.driver.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0);
    return { sessions: count('sessions'), exercises: count('session_exercises'), sets: count('sets'), plans: count('plans') };
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
      prev.plans === next.plans &&
      prev.activeSession === next.activeSession &&
      prev.history === next.history &&
      prev.restTimer === next.restTimer &&
      prev.settings === next.settings
    ) {
      return;
    }
    this.driver.transaction(() => {
      if (prev.plans !== next.plans) {
        const prevById = new Map(prev.plans.map((plan) => [plan.id, plan]));
        const nextIds = new Set(next.plans.map((plan) => plan.id));
        for (const plan of next.plans) {
          if (prevById.get(plan.id) !== plan) this.upsertPlan(plan);
        }
        for (const id of prevById.keys()) {
          if (!nextIds.has(id)) this.deletePlan(id);
        }
      }
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
      this.driver.exec(
        'DELETE FROM sets; DELETE FROM session_exercises; DELETE FROM sessions; DELETE FROM plan_exercises; DELETE FROM plan_days; DELETE FROM plans;',
      );
      for (const plan of state.plans) this.upsertPlan(plan);
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

  /** Must be called inside a transaction. Whole-plan replace. */
  upsertPlan(plan: Plan): void {
    const d = this.driver;
    d.run(
      `INSERT INTO plans (id, kind, name_json, description_json, source_plan_id, locked, next_day_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, name_json = excluded.name_json,
         description_json = excluded.description_json, source_plan_id = excluded.source_plan_id, locked = excluded.locked,
         next_day_index = excluded.next_day_index, created_at = excluded.created_at, updated_at = excluded.updated_at`,
      [
        plan.id,
        plan.kind,
        JSON.stringify(plan.name),
        plan.description ? JSON.stringify(plan.description) : null,
        plan.sourcePlanId,
        plan.locked,
        plan.nextDayIndex,
        plan.createdAt,
        plan.updatedAt,
      ],
    );
    d.run('DELETE FROM plan_exercises WHERE plan_day_id IN (SELECT id FROM plan_days WHERE plan_id = ?)', [plan.id]);
    d.run('DELETE FROM plan_days WHERE plan_id = ?', [plan.id]);
    plan.days.forEach((day, position) => {
      d.run('INSERT INTO plan_days (id, plan_id, position, code, title_json, muscle_summary_json, focus) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        day.id,
        plan.id,
        position,
        day.code,
        JSON.stringify(day.title),
        JSON.stringify(day.muscleSummary),
        day.focus,
      ]);
      day.exercises.forEach((exercise, index) => {
        d.run(
          'INSERT INTO plan_exercises (id, plan_day_id, position, exercise_id, sets, rep_min, rep_max, rest_default, rest_min, rest_max, note_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            `${day.id}:${index}`,
            day.id,
            index,
            exercise.exerciseId,
            exercise.sets,
            exercise.reps.min,
            exercise.reps.max,
            exercise.rest.defaultSeconds,
            exercise.rest.minSeconds,
            exercise.rest.maxSeconds,
            exercise.note ? JSON.stringify(exercise.note) : null,
          ],
        );
      });
    });
  }

  /** Must be called inside a transaction. */
  deletePlan(id: string): void {
    this.driver.run('DELETE FROM plan_exercises WHERE plan_day_id IN (SELECT id FROM plan_days WHERE plan_id = ?)', [id]);
    this.driver.run('DELETE FROM plan_days WHERE plan_id = ?', [id]);
    this.driver.run('DELETE FROM plans WHERE id = ?', [id]);
  }

  /** Must be called inside a transaction. Whole-session replace: cheap and atomic. */
  upsertSession(session: WorkoutSession): void {
    const d = this.driver;
    d.run(
      `INSERT INTO sessions (id, schema_version, kind, plan_id, plan_day_id, title_json, code, focus, status, started_at, finished_at,
         ended_at_override, paused_intervals_json, deferred_ids_json, current_exercise_index, warmup_completed_json, notes, summary_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         schema_version = excluded.schema_version, kind = excluded.kind, plan_id = excluded.plan_id, plan_day_id = excluded.plan_day_id,
         title_json = excluded.title_json, code = excluded.code, focus = excluded.focus, status = excluded.status,
         started_at = excluded.started_at, finished_at = excluded.finished_at, ended_at_override = excluded.ended_at_override,
         paused_intervals_json = excluded.paused_intervals_json, deferred_ids_json = excluded.deferred_ids_json,
         current_exercise_index = excluded.current_exercise_index, warmup_completed_json = excluded.warmup_completed_json,
         notes = excluded.notes, summary_json = excluded.summary_json, updated_at = excluded.updated_at`,
      [
        session.id,
        session.schemaVersion,
        session.kind,
        session.planId,
        session.planDayId,
        JSON.stringify(session.title),
        session.code,
        session.focus,
        session.status,
        session.startedAt,
        session.finishedAt,
        session.endedAtOverride,
        JSON.stringify(session.pausedIntervals),
        JSON.stringify(session.deferredIds),
        session.currentExerciseIndex,
        JSON.stringify(session.warmupCompletedIds),
        session.notes,
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

  private loadPlans(): Plan[] {
    // rowid = insertion order (upserts keep it), which mirrors the store's array order.
    const planRows = this.driver.all<PlanRow>('SELECT * FROM plans ORDER BY rowid');
    if (planRows.length === 0) return [];
    const dayRows = this.driver.all<PlanDayRow>('SELECT * FROM plan_days ORDER BY plan_id, position');
    const exerciseRows = this.driver.all<PlanExerciseRow>('SELECT * FROM plan_exercises ORDER BY plan_day_id, position');

    const exercisesByDay = new Map<string, PlanDay['exercises']>();
    for (const row of exerciseRows) {
      const list = exercisesByDay.get(row.plan_day_id) ?? [];
      list.push({
        exerciseId: row.exercise_id,
        sets: row.sets,
        reps: { min: row.rep_min, max: row.rep_max },
        rest: { defaultSeconds: row.rest_default, minSeconds: row.rest_min, maxSeconds: row.rest_max },
        ...(row.note_json ? { note: JSON.parse(row.note_json) as PlanDay['exercises'][number]['note'] } : {}),
      });
      exercisesByDay.set(row.plan_day_id, list);
    }
    const daysByPlan = new Map<string, PlanDay[]>();
    for (const row of dayRows) {
      const list = daysByPlan.get(row.plan_id) ?? [];
      list.push({
        id: row.id,
        position: row.position,
        code: row.code,
        title: JSON.parse(row.title_json) as PlanDay['title'],
        muscleSummary: JSON.parse(row.muscle_summary_json) as PlanDay['muscleSummary'],
        focus: row.focus as PlanDay['focus'],
        exercises: exercisesByDay.get(row.id) ?? [],
      });
      daysByPlan.set(row.plan_id, list);
    }
    return planRows.map((row) => ({
      id: row.id,
      kind: row.kind as Plan['kind'],
      name: JSON.parse(row.name_json) as Plan['name'],
      description: row.description_json ? (JSON.parse(row.description_json) as Plan['description']) : null,
      sourcePlanId: row.source_plan_id,
      locked: row.locked === 1,
      nextDayIndex: row.next_day_index,
      days: daysByPlan.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

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

    return sessionRows.map((row) => {
      const summary = row.summary_json ? (JSON.parse(row.summary_json) as Partial<SessionSummaryShape> & WorkoutSession['summary']) : null;
      return {
        id: row.id,
        schemaVersion: 2,
        kind: row.kind as WorkoutSession['kind'],
        planId: row.plan_id,
        planDayId: row.plan_day_id,
        title: JSON.parse(row.title_json) as WorkoutSession['title'],
        code: row.code,
        focus: (row.focus || null) as WorkoutSession['focus'],
        status: row.status as WorkoutSession['status'],
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        endedAtOverride: row.ended_at_override,
        pausedIntervals: JSON.parse(row.paused_intervals_json) as WorkoutSession['pausedIntervals'],
        exercises: exercisesBySession.get(row.id) ?? [],
        deferredIds: JSON.parse(row.deferred_ids_json) as string[],
        currentExerciseIndex: row.current_exercise_index,
        warmupCompletedIds: JSON.parse(row.warmup_completed_json) as string[],
        notes: row.notes,
        // Legacy summaries (pre-v2) have no activeSeconds: treat the whole duration as active.
        summary: summary ? { ...summary, activeSeconds: summary.activeSeconds ?? summary.durationSeconds } : null,
      };
    });
  }
}

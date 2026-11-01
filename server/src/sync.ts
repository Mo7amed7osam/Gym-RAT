import type { FastifyPluginAsync } from 'fastify';
import type pg from 'pg';

import { pool, withTransaction } from './db.js';
import type { SyncRequest, SyncResponse, WorkoutSession } from './types.js';

const MAX_SESSIONS_PER_REQUEST = 50;

const uuid = { type: 'string', format: 'uuid' } as const;
const isoDate = { type: 'string', format: 'date-time' } as const;

const setSchema = {
  type: 'object',
  required: ['id', 'setNumber', 'type', 'targetReps', 'weightKg', 'reps', 'completed', 'completedAt'],
  properties: {
    id: uuid,
    setNumber: { type: 'integer', minimum: 1 },
    type: { enum: ['warmup', 'working'] },
    targetReps: {
      type: 'object',
      required: ['min', 'max'],
      properties: { min: { type: 'integer', minimum: 0 }, max: { type: 'integer', minimum: 0 } },
    },
    weightKg: { type: ['number', 'null'], minimum: 0 },
    reps: { type: ['integer', 'null'], minimum: 0 },
    completed: { type: 'boolean' },
    completedAt: { anyOf: [isoDate, { type: 'null' }] },
  },
} as const;

const exerciseSchema = {
  type: 'object',
  required: ['id', 'exerciseId', 'prescription', 'sets', 'skipped', 'notes'],
  properties: {
    id: uuid,
    exerciseId: { type: 'string', minLength: 1 },
    prescription: { type: 'object' },
    sets: { type: 'array', items: setSchema },
    skipped: { type: 'boolean' },
    notes: { type: 'string' },
  },
} as const;

const sessionSchema = {
  type: 'object',
  required: [
    'id', 'routineId', 'weekday', 'title', 'code', 'focus', 'status', 'startedAt', 'finishedAt',
    'exercises', 'currentExerciseIndex', 'warmupCompletedIds', 'cooldownCompletedIds', 'summary',
  ],
  properties: {
    id: uuid,
    schemaVersion: { type: 'integer' },
    routineId: { type: 'string' },
    weekday: { type: 'string' },
    title: { type: 'object', required: ['en', 'ar'] },
    code: { type: 'string' },
    focus: { type: 'string' },
    status: { enum: ['in_progress', 'completed', 'cancelled'] },
    startedAt: isoDate,
    finishedAt: { anyOf: [isoDate, { type: 'null' }] },
    exercises: { type: 'array', items: exerciseSchema },
    currentExerciseIndex: { type: 'integer', minimum: 0 },
    warmupCompletedIds: { type: 'array', items: { type: 'string' } },
    cooldownCompletedIds: { type: 'array', items: { type: 'string' } },
    summary: { type: ['object', 'null'] },
  },
} as const;

const bodySchema = {
  type: 'object',
  required: ['upserts', 'deletes'],
  additionalProperties: false,
  properties: {
    upserts: { type: 'array', maxItems: MAX_SESSIONS_PER_REQUEST, items: sessionSchema },
    deletes: { type: 'array', maxItems: 500, items: uuid },
  },
} as const;

/**
 * Writes one session as a full replace: upsert the parent row, drop its
 * children (CASCADE clears sets) and re-insert them. Ids come from the device,
 * so re-sending the same payload is a no-op in effect.
 */
async function replaceSession(client: pg.PoolClient, session: WorkoutSession): Promise<void> {
  await client.query(
    `INSERT INTO workout_sessions (
       id, schema_version, routine_id, weekday, title, code, focus, status, started_at, finished_at,
       current_exercise_index, warmup_completed_ids, cooldown_completed_ids, summary
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (id) DO UPDATE SET
       schema_version = EXCLUDED.schema_version,
       routine_id = EXCLUDED.routine_id,
       weekday = EXCLUDED.weekday,
       title = EXCLUDED.title,
       code = EXCLUDED.code,
       focus = EXCLUDED.focus,
       status = EXCLUDED.status,
       started_at = EXCLUDED.started_at,
       finished_at = EXCLUDED.finished_at,
       current_exercise_index = EXCLUDED.current_exercise_index,
       warmup_completed_ids = EXCLUDED.warmup_completed_ids,
       cooldown_completed_ids = EXCLUDED.cooldown_completed_ids,
       summary = EXCLUDED.summary`,
    [
      session.id,
      session.schemaVersion ?? 1,
      session.routineId,
      session.weekday,
      session.title,
      session.code,
      session.focus,
      session.status,
      session.startedAt,
      session.finishedAt,
      session.currentExerciseIndex,
      session.warmupCompletedIds,
      session.cooldownCompletedIds,
      session.summary,
    ],
  );

  await client.query('DELETE FROM session_exercises WHERE session_id = $1', [session.id]);
  if (session.exercises.length === 0) return;

  const exercises = session.exercises.map((exercise, position) => ({
    id: exercise.id,
    session_id: session.id,
    position,
    exercise_id: exercise.exerciseId,
    prescription: exercise.prescription,
    skipped: exercise.skipped,
    notes: exercise.notes,
  }));
  await client.query(
    `INSERT INTO session_exercises (id, session_id, position, exercise_id, prescription, skipped, notes)
     SELECT id, session_id, position, exercise_id, prescription, skipped, notes
     FROM jsonb_to_recordset($1::jsonb) AS x(
       id uuid, session_id uuid, position integer, exercise_id text, prescription jsonb, skipped boolean, notes text
     )`,
    [JSON.stringify(exercises)],
  );

  const sets = session.exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({
      id: set.id,
      session_exercise_id: exercise.id,
      set_number: set.setNumber,
      type: set.type,
      target_min: set.targetReps.min,
      target_max: set.targetReps.max,
      weight_kg: set.weightKg,
      reps: set.reps,
      completed: set.completed,
      completed_at: set.completedAt,
    })),
  );
  if (sets.length === 0) return;
  await client.query(
    `INSERT INTO exercise_sets (
       id, session_exercise_id, set_number, type, target_min, target_max, weight_kg, reps, completed, completed_at
     )
     SELECT id, session_exercise_id, set_number, type, target_min, target_max, weight_kg, reps, completed, completed_at
     FROM jsonb_to_recordset($1::jsonb) AS x(
       id uuid, session_exercise_id uuid, set_number integer, type text, target_min integer, target_max integer,
       weight_kg numeric, reps integer, completed boolean, completed_at timestamptz
     )`,
    [JSON.stringify(sets)],
  );
}

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: SyncRequest; Reply: SyncResponse }>(
    '/api/sessions/sync',
    { schema: { body: bodySchema }, bodyLimit: 5 * 1024 * 1024 },
    async (request) => {
      const { upserts, deletes } = request.body;
      const response: SyncResponse = { synced: [], deleted: [], failed: [] };

      // One transaction per session: a bad session can't block the rest of the queue.
      for (const session of upserts) {
        try {
          await withTransaction((client) => replaceSession(client, session));
          response.synced.push(session.id);
        } catch (error) {
          request.log.warn({ err: error, sessionId: session.id }, 'session sync failed');
          response.failed.push({ id: session.id, error: error instanceof Error ? error.message : String(error) });
        }
      }

      if (deletes.length > 0) {
        // Deleting a missing id is fine — the device already considers it gone.
        await pool.query('DELETE FROM workout_sessions WHERE id = ANY($1::uuid[])', [deletes]);
        response.deleted = deletes;
      }

      return response;
    },
  );
};

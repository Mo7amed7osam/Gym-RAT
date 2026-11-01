-- Gym RAT workout log — mirrors the "Log layer" in types/workout.ts.
--   WorkoutSession  → workout_sessions
--   SessionExercise → session_exercises
--   ExerciseSet     → exercise_sets
--
-- Primary keys are generated on the device (expo-crypto randomUUID) so the same
-- session can be re-sent any number of times; the server never invents ids.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- Keeps updated_at honest on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ─── workout_sessions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_sessions (
  id                      uuid        PRIMARY KEY,
  schema_version          smallint    NOT NULL DEFAULT 1,
  routine_id              text        NOT NULL
                          CHECK (routine_id IN ('push_a', 'pull_a', 'leg_a', 'upper_b', 'lower_b')),
  weekday                 text        NOT NULL
                          CHECK (weekday IN ('saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  title                   jsonb       NOT NULL,              -- LocalizedText { en, ar }
  code                    text        NOT NULL,              -- "Push A"
  focus                   text        NOT NULL CHECK (focus IN ('strength', 'hypertrophy')),
  status                  text        NOT NULL CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at              timestamptz NOT NULL,
  finished_at             timestamptz,
  current_exercise_index  integer     NOT NULL DEFAULT 0 CHECK (current_exercise_index >= 0),
  warmup_completed_ids    text[]      NOT NULL DEFAULT '{}',
  cooldown_completed_ids  text[]      NOT NULL DEFAULT '{}',
  summary                 jsonb,                             -- SessionSummary, null until finished
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finished_after_start CHECK (finished_at IS NULL OR finished_at >= started_at)
);

-- History screen: newest first.
CREATE INDEX IF NOT EXISTS workout_sessions_started_at_idx
  ON workout_sessions (started_at DESC);
-- "Last Push A" / per-routine history.
CREATE INDEX IF NOT EXISTS workout_sessions_routine_started_idx
  ON workout_sessions (routine_id, started_at DESC);
-- Calendar / weekly volume queries by local day.
CREATE INDEX IF NOT EXISTS workout_sessions_started_date_idx
  ON workout_sessions (((started_at AT TIME ZONE 'UTC')::date));
-- Completed-only scans (stats, PRs).
CREATE INDEX IF NOT EXISTS workout_sessions_completed_idx
  ON workout_sessions (finished_at DESC) WHERE status = 'completed';

DROP TRIGGER IF EXISTS workout_sessions_updated_at ON workout_sessions;
CREATE TRIGGER workout_sessions_updated_at
  BEFORE UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── session_exercises ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_exercises (
  id            uuid        PRIMARY KEY,
  session_id    uuid        NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
  position      integer     NOT NULL CHECK (position >= 0),  -- order within the session
  exercise_id   text        NOT NULL,                        -- key into data/exercisesData.ts
  prescription  jsonb       NOT NULL,                        -- ExercisePrescription snapshot
  skipped       boolean     NOT NULL DEFAULT false,
  notes         text        NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_exercises_position_uniq UNIQUE (session_id, position)
    DEFERRABLE INITIALLY DEFERRED
);

-- The unique constraint above already serves "exercises of session X in order".
-- Per-exercise history ("previous" column, PRs).
CREATE INDEX IF NOT EXISTS session_exercises_exercise_idx
  ON session_exercises (exercise_id, session_id);

DROP TRIGGER IF EXISTS session_exercises_updated_at ON session_exercises;
CREATE TRIGGER session_exercises_updated_at
  BEFORE UPDATE ON session_exercises
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── exercise_sets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercise_sets (
  id                   uuid         PRIMARY KEY,
  session_exercise_id  uuid         NOT NULL REFERENCES session_exercises (id) ON DELETE CASCADE,
  set_number           integer      NOT NULL CHECK (set_number >= 1),
  type                 text         NOT NULL CHECK (type IN ('warmup', 'working')),
  target_min           integer      NOT NULL CHECK (target_min >= 0),
  target_max           integer      NOT NULL CHECK (target_max >= target_min),
  weight_kg            numeric(6,2) CHECK (weight_kg >= 0),
  reps                 integer      CHECK (reps >= 0),
  completed            boolean      NOT NULL DEFAULT false,
  completed_at         timestamptz,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT exercise_sets_number_uniq UNIQUE (session_exercise_id, set_number)
    DEFERRABLE INITIALLY DEFERRED
);

-- Volume / activity by date.
CREATE INDEX IF NOT EXISTS exercise_sets_completed_at_idx
  ON exercise_sets (completed_at DESC) WHERE completed;

DROP TRIGGER IF EXISTS exercise_sets_updated_at ON exercise_sets;
CREATE TRIGGER exercise_sets_updated_at
  BEFORE UPDATE ON exercise_sets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO schema_migrations (version) VALUES ('001_init') ON CONFLICT DO NOTHING;

COMMIT;

/**
 * SQLite schema. Shared verbatim by the app driver and the test driver.
 * Bump SCHEMA_VERSION and append a step in migrations.ts for every change;
 * never edit an applied step.
 */

export const DATABASE_NAME = 'gymrat.db';
export const BACKUP_DATABASE_NAME = 'gymrat.backup.db';

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  routine_id TEXT NOT NULL,
  weekday TEXT NOT NULL,
  title_json TEXT NOT NULL,
  code TEXT NOT NULL,
  focus TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  current_exercise_index INTEGER NOT NULL DEFAULT 0,
  warmup_completed_json TEXT NOT NULL DEFAULT '[]',
  summary_json TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);

CREATE TABLE IF NOT EXISTS session_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  exercise_id TEXT NOT NULL,
  prescription_json TEXT NOT NULL,
  skipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises (session_id, position);
CREATE INDEX IF NOT EXISTS idx_session_exercises_exercise ON session_exercises (exercise_id);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY NOT NULL,
  session_exercise_id TEXT NOT NULL REFERENCES session_exercises (id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('warmup', 'working')),
  target_min INTEGER NOT NULL,
  target_max INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets (session_exercise_id, set_number);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

/** v2: plans + rotation; sessions reference plan days instead of weekdays. */
export const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('active', 'template', 'reference')), -- 'reference' retired in v3
  name_json TEXT NOT NULL,
  description_json TEXT,
  source_plan_id TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  next_day_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plan_days (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  code TEXT NOT NULL,
  title_json TEXT NOT NULL,
  muscle_summary_json TEXT NOT NULL,
  focus TEXT
);
CREATE INDEX IF NOT EXISTS idx_plan_days_plan ON plan_days (plan_id, position);
CREATE TABLE IF NOT EXISTS plan_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  plan_day_id TEXT NOT NULL REFERENCES plan_days (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  exercise_id TEXT NOT NULL,
  sets INTEGER NOT NULL,
  rep_min INTEGER NOT NULL,
  rep_max INTEGER NOT NULL,
  rest_default INTEGER NOT NULL,
  rest_min INTEGER NOT NULL,
  rest_max INTEGER NOT NULL,
  note_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_plan_exercises_day ON plan_exercises (plan_day_id, position);

-- sessions: rebuild (focus becomes nullable; weekday/routine_id replaced by plan references).
CREATE TABLE sessions_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 2,
  kind TEXT NOT NULL DEFAULT 'plan' CHECK (kind IN ('plan', 'template', 'extra')),
  plan_id TEXT,
  plan_day_id TEXT,
  title_json TEXT NOT NULL,
  code TEXT NOT NULL,
  focus TEXT,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  ended_at_override TEXT,
  paused_intervals_json TEXT NOT NULL DEFAULT '[]',
  deferred_ids_json TEXT NOT NULL DEFAULT '[]',
  current_exercise_index INTEGER NOT NULL DEFAULT 0,
  warmup_completed_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  summary_json TEXT,
  updated_at TEXT NOT NULL
);
INSERT INTO sessions_v2 (id, schema_version, kind, plan_id, plan_day_id, title_json, code, focus, status, started_at, finished_at,
  current_exercise_index, warmup_completed_json, summary_json, updated_at)
SELECT id, 2, 'plan', 'pdf_ppl_ul_v5', 'pdf_ppl_ul_v5:' || routine_id, title_json, code, NULLIF(focus, ''), status, started_at, finished_at,
  current_exercise_index, warmup_completed_json, summary_json, updated_at
FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_v2 RENAME TO sessions;
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_plan_day ON sessions (plan_day_id);
`;

export const REQUIRED_TABLES = ['sessions', 'session_exercises', 'sets', 'kv', 'plans', 'plan_days', 'plan_exercises', 'exercises'] as const;

/** Keys inside the `kv` table. */
export const KV = {
  settings: 'settings',
  restTimer: 'restTimer',
  importedAt: 'import.asyncStorage.importedAt',
  importError: 'import.asyncStorage.error',
} as const;

/** v3: the bundled program is an ordinary template; the `reference` kind is retired. */
export const SCHEMA_V3 = `
UPDATE plans SET kind = 'template' WHERE kind = 'reference';
`;

/** v4: runtime exercise library (ADR-007). Built-in rows are seeded at boot; customs live here too. */
export const SCHEMA_V4 = `
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('builtin', 'custom')),
  name_json TEXT NOT NULL,
  arabic_name_source TEXT NOT NULL DEFAULT 'supplied',
  primary_muscles_json TEXT NOT NULL DEFAULT '[]',
  secondary_muscles_json TEXT NOT NULL DEFAULT '[]',
  equipment_json TEXT NOT NULL DEFAULT '[]',
  weight_type TEXT NOT NULL DEFAULT 'total',
  is_unilateral INTEGER NOT NULL DEFAULT 0,
  instructions_json TEXT NOT NULL DEFAULT '[]',
  breathing_json TEXT,
  range_of_motion_json TEXT,
  common_mistakes_json TEXT NOT NULL DEFAULT '[]',
  alternatives_json TEXT NOT NULL DEFAULT '[]',
  video_id TEXT,
  image_uri TEXT,
  user_notes TEXT NOT NULL DEFAULT '',
  user_rest_seconds INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exercises_origin ON exercises (origin, archived);
`;

/** v5: plans can be archived (plan builder, P2.3). */
export const SCHEMA_V5 = `
ALTER TABLE plans ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
`;

/** v6: advanced set metadata and exercise grouping (P2.5). `sets.type` and its CHECK are untouched. */
export const SCHEMA_V6 = `
ALTER TABLE sets ADD COLUMN set_kind TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE sets ADD COLUMN rpe REAL;
ALTER TABLE sets ADD COLUMN rir INTEGER;
ALTER TABLE session_exercises ADD COLUMN group_id TEXT;
ALTER TABLE session_exercises ADD COLUMN group_kind TEXT;
`;

/** v7: progressive-overload decision per session exercise (Phase 3, ADR-010). */
export const SCHEMA_V7 = `
ALTER TABLE session_exercises ADD COLUMN recommendation_json TEXT;
`;

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

export const REQUIRED_TABLES = ['sessions', 'session_exercises', 'sets', 'kv'] as const;

/** Keys inside the `kv` table. */
export const KV = {
  settings: 'settings',
  restTimer: 'restTimer',
  importedAt: 'import.asyncStorage.importedAt',
  importError: 'import.asyncStorage.error',
} as const;

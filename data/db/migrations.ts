import type { Driver } from './driver';
import { REQUIRED_COLUMNS, REQUIRED_TABLES, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8 } from './schema';

export interface MigrationStep {
  version: number;
  up: (driver: Driver) => void;
}

const tableNames = (driver: Driver): Set<string> =>
  new Set(driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name));

const hasColumn = (driver: Driver, table: string, column: string): boolean =>
  driver.get<{ name: string }>('SELECT name FROM pragma_table_info(?) WHERE name = ?', [table, column]) !== null;

/**
 * Brings the parts of the schema that Phase 3 and Phase 4 added in parallel
 * into line with what the file actually contains (ADR-012). Both branches
 * claimed step 7, so `user_version` alone cannot say whether a database has
 * `session_exercises.recommendation_json` (Phase 3) or the `body_metrics` and
 * `goals` tables (Phase 4). Every repair is additive: a column with NULLs or
 * an empty table. Returns what it had to add; must run inside a transaction.
 */
export function reconcileSchema(driver: Driver): string[] {
  const repaired: string[] = [];
  if (!hasColumn(driver, 'session_exercises', 'recommendation_json')) {
    driver.exec(SCHEMA_V7);
    repaired.push('session_exercises.recommendation_json');
  }
  const tables = tableNames(driver);
  if (!tables.has('body_metrics') || !tables.has('goals')) {
    driver.exec(SCHEMA_V8); // CREATE TABLE IF NOT EXISTS: never touches an existing table
    for (const table of ['body_metrics', 'goals']) if (!tables.has(table)) repaired.push(table);
  }
  return repaired;
}

/**
 * Append-only. Each step runs inside one transaction with the user_version bump.
 * 7 = Phase 3 (recommendation decision), 8 = Phase 4 (body metrics, goals; was
 * that branch's step 7), 9 = reconcile, so a database upgraded by either branch
 * alone receives the other branch's change. Steps 7 and 8 check the file before
 * altering it for the same reason.
 */
export const MIGRATIONS: readonly MigrationStep[] = [
  { version: 1, up: (driver) => driver.exec(SCHEMA_V1) },
  { version: 2, up: (driver) => driver.exec(SCHEMA_V2) },
  { version: 3, up: (driver) => driver.exec(SCHEMA_V3) },
  { version: 4, up: (driver) => driver.exec(SCHEMA_V4) },
  { version: 5, up: (driver) => driver.exec(SCHEMA_V5) },
  { version: 6, up: (driver) => driver.exec(SCHEMA_V6) },
  {
    version: 7,
    up: (driver) => {
      if (!hasColumn(driver, 'session_exercises', 'recommendation_json')) driver.exec(SCHEMA_V7);
    },
  },
  { version: 8, up: (driver) => driver.exec(SCHEMA_V8) },
  { version: 9, up: (driver) => void reconcileSchema(driver) },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function getUserVersion(driver: Driver): number {
  return Number(driver.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0);
}

export interface MigrateOptions {
  /** Called before any step runs on a database that already has data. */
  backup?: (fromVersion: number) => void;
  /** Called when the post-migration reconcile had to add something a version number had promised. */
  onRepair?: (repaired: string[]) => void;
  /** Test seam: the step list to apply (defaults to MIGRATIONS). */
  steps?: readonly MigrationStep[];
}

export interface MigrateResult {
  from: number;
  to: number;
  applied: number[];
}

/**
 * Brings the database to SCHEMA_VERSION. Every step is applied inside a
 * transaction together with its `PRAGMA user_version` bump, so an interrupted
 * migration leaves the previous version fully intact. The reconcile pass then
 * checks the real schema whatever the version says. Verification runs after
 * commit; a failure there throws so the caller can restore the backup.
 */
export function migrate(driver: Driver, options: MigrateOptions = {}): MigrateResult {
  const steps = options.steps ?? MIGRATIONS;
  const target = steps[steps.length - 1].version;
  const from = getUserVersion(driver);
  const pending = steps.filter((step) => step.version > from);

  if (pending.length > 0 && from > 0) options.backup?.(from);

  // Table rebuilds (DROP + RENAME) would cascade-delete child rows with foreign
  // keys enforced; the pragma is a no-op inside a transaction, so toggle it here.
  driver.exec('PRAGMA foreign_keys = OFF');
  const applied: number[] = [];
  try {
    for (const step of pending) {
      driver.transaction(() => {
        step.up(driver);
        const violations = driver.all('PRAGMA foreign_key_check');
        if (violations.length > 0) throw new Error(`Migration ${step.version} left ${violations.length} foreign key violation(s)`);
        driver.exec(`PRAGMA user_version = ${step.version}`);
      });
      applied.push(step.version);
    }
  } finally {
    driver.exec('PRAGMA foreign_keys = ON');
  }

  if (steps === MIGRATIONS && from > 0) {
    const repaired = driver.transaction(() => reconcileSchema(driver));
    if (repaired.length > 0) options.onRepair?.(repaired);
  }

  if (steps === MIGRATIONS) verifySchema(driver);
  return { from, to: pending.length === 0 ? from : target, applied };
}

/** Throws when a required table or column is missing or the file fails SQLite's own check. */
export function verifySchema(driver: Driver): void {
  const check = driver.get<{ quick_check: string }>('PRAGMA quick_check');
  if (check?.quick_check !== 'ok') throw new Error(`Database integrity check failed: ${String(check?.quick_check)}`);
  const names = tableNames(driver);
  for (const table of REQUIRED_TABLES) {
    if (!names.has(table)) throw new Error(`Database is missing table "${table}"`);
  }
  for (const [table, column] of REQUIRED_COLUMNS) {
    if (!hasColumn(driver, table, column)) throw new Error(`Database is missing column "${table}.${column}"`);
  }
  if (getUserVersion(driver) !== SCHEMA_VERSION) {
    throw new Error(`Database version ${getUserVersion(driver)} does not match expected ${SCHEMA_VERSION}`);
  }
}

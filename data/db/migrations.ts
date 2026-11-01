import type { Driver } from './driver';
import { REQUIRED_TABLES, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6 } from './schema';

interface MigrationStep {
  version: number;
  up: (driver: Driver) => void;
}

/** Append-only. Each step runs inside one transaction with the user_version bump. */
export const MIGRATIONS: readonly MigrationStep[] = [
  { version: 1, up: (driver) => driver.exec(SCHEMA_V1) },
  { version: 2, up: (driver) => driver.exec(SCHEMA_V2) },
  { version: 3, up: (driver) => driver.exec(SCHEMA_V3) },
  { version: 4, up: (driver) => driver.exec(SCHEMA_V4) },
  { version: 5, up: (driver) => driver.exec(SCHEMA_V5) },
  { version: 6, up: (driver) => driver.exec(SCHEMA_V6) },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function getUserVersion(driver: Driver): number {
  return Number(driver.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0);
}

export interface MigrateOptions {
  /** Called before any step runs on a database that already has data. */
  backup?: (fromVersion: number) => void;
}

export interface MigrateResult {
  from: number;
  to: number;
  applied: number[];
}

/**
 * Brings the database to SCHEMA_VERSION. Every step is applied inside a
 * transaction together with its `PRAGMA user_version` bump, so an interrupted
 * migration leaves the previous version fully intact. Verification runs after
 * commit; a failure there throws so the caller can restore the backup.
 */
export function migrate(driver: Driver, options: MigrateOptions = {}): MigrateResult {
  const from = getUserVersion(driver);
  const pending = MIGRATIONS.filter((step) => step.version > from);
  if (pending.length === 0) return { from, to: from, applied: [] };

  if (from > 0) options.backup?.(from);

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

  verifySchema(driver);
  return { from, to: SCHEMA_VERSION, applied };
}

/** Throws when a required table is missing or the file fails SQLite's own check. */
export function verifySchema(driver: Driver): void {
  const check = driver.get<{ quick_check: string }>('PRAGMA quick_check');
  if (check?.quick_check !== 'ok') throw new Error(`Database integrity check failed: ${String(check?.quick_check)}`);
  const names = new Set(
    driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name),
  );
  for (const table of REQUIRED_TABLES) {
    if (!names.has(table)) throw new Error(`Database is missing table "${table}"`);
  }
  if (getUserVersion(driver) !== SCHEMA_VERSION) {
    throw new Error(`Database version ${getUserVersion(driver)} does not match expected ${SCHEMA_VERSION}`);
  }
}

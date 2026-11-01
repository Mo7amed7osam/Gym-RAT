import type { Driver } from './driver';
import { SCHEMA_V7 } from './schema';

const PROGRESS_TABLES = ['body_metrics', 'goals'] as const;

/**
 * Makes sure the Phase 4 tables exist whatever `user_version` says (ADR-010).
 * Phase 3 and Phase 4 were built in parallel and may both have claimed schema
 * step 7, so a development database can report the current version while
 * missing one branch's tables. The DDL is create-if-missing only: it never
 * rewrites or drops rows. Returns the tables it had to create.
 */
export function ensureProgressSchema(driver: Driver): string[] {
  const existing = new Set(driver.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name));
  const missing = PROGRESS_TABLES.filter((table) => !existing.has(table));
  if (missing.length === 0) return [];
  driver.transaction(() => driver.exec(SCHEMA_V7));
  return missing;
}

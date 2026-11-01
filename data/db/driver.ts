/**
 * Minimal synchronous SQL driver interface shared by the app (expo-sqlite)
 * and the tests (node:sqlite). Only positional `?` placeholders are used so
 * both engines bind identically.
 */

export type BindValue = string | number | null;
export type BindInput = string | number | boolean | null | undefined;
/** Any plain row object. */
export type Row = object;

export interface Driver {
  /** Run one or more statements without parameters (DDL, PRAGMA). */
  exec(sql: string): void;
  run(sql: string, params?: readonly BindInput[]): void;
  all<T extends Row = Row>(sql: string, params?: readonly BindInput[]): T[];
  get<T extends Row = Row>(sql: string, params?: readonly BindInput[]): T | null;
  /** Runs `task` inside BEGIN/COMMIT; rolls back and rethrows on error. Not re-entrant. */
  transaction<T>(task: () => T): T;
}

/** Booleans → 0/1 and undefined → null so every engine sees the same values. */
export function normalizeParams(params: readonly BindInput[] = []): BindValue[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

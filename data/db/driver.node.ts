import { DatabaseSync } from 'node:sqlite';

import { normalizeParams, type BindInput, type Driver, type Row } from './driver';

/**
 * node:sqlite adapter used by the Jest suite. Behaviour must match the expo
 * driver: positional params, foreign keys on, explicit transactions.
 */
export function createNodeDriver(path: string = ':memory:'): Driver & { db: DatabaseSync } {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return {
    db,
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...normalizeParams(params));
    },
    all: <T extends Row>(sql: string, params?: readonly BindInput[]) =>
      db.prepare(sql).all(...normalizeParams(params)) as unknown as T[],
    get: <T extends Row>(sql: string, params?: readonly BindInput[]) =>
      (db.prepare(sql).get(...normalizeParams(params)) as unknown as T | undefined) ?? null,
    transaction: (task) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = task();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // Already rolled back by SQLite; keep the original error.
        }
        throw error;
      }
    },
  };
}

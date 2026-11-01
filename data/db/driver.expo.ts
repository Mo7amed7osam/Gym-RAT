import type { SQLiteDatabase } from 'expo-sqlite';

import { normalizeParams, type BindInput, type Driver, type Row } from './driver';

/** expo-sqlite adapter. Only the boot module imports this file. */
export function createExpoDriver(db: SQLiteDatabase): Driver {
  return {
    exec: (sql) => db.execSync(sql),
    run: (sql, params) => {
      db.runSync(sql, normalizeParams(params));
    },
    all: <T extends Row>(sql: string, params?: readonly BindInput[]) => db.getAllSync<T>(sql, normalizeParams(params)),
    get: <T extends Row>(sql: string, params?: readonly BindInput[]) => db.getFirstSync<T>(sql, normalizeParams(params)),
    transaction: (task) => {
      let result: ReturnType<typeof task> | undefined;
      db.withTransactionSync(() => {
        result = task();
      });
      return result as ReturnType<typeof task>;
    },
  };
}

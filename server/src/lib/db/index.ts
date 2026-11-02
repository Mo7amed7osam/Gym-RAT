import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

/**
 * One Drizzle client per process. Production uses postgres-js against the
 * compose Postgres; tests inject an in-memory PGlite database with the same
 * schema through `setDbForTests`, so route handlers run unchanged.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let current: Db | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

export function getDb(): Db {
  if (current) return current;
  sqlClient = postgres(env().DATABASE_URL, { max: 10, idle_timeout: 30, connect_timeout: 10, prepare: false });
  current = drizzlePostgres(sqlClient, { schema });
  return current;
}

export function setDbForTests(db: Db | null): void {
  current = db;
}

export async function closeDb(): Promise<void> {
  if (sqlClient) await sqlClient.end({ timeout: 5 });
  sqlClient = null;
  current = null;
}

export { schema };

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";

import { setDbForTests } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { setEnvForTests } from "@/lib/env";

/**
 * Every test file gets a fresh in-memory PostgreSQL (PGlite) migrated with
 * the real ./drizzle migrations, so the SQL that ships is the SQL under test.
 */
let pglite: PGlite | null = null;

beforeAll(async () => {
  setEnvForTests({
    NODE_ENV: "test",
    DATABASE_URL: "postgres://unused",
    AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
    PUBLIC_ORIGIN: "https://admin.gymrat.test",
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 30,
    OFFLINE_LEASE_DAYS: 7,
    INVITE_TTL_HOURS: 72,
    RESET_TTL_MINUTES: 60,
    ADMIN_SESSION_HOURS: 12,
    ADMIN_IDLE_MINUTES: 60,
    TRUST_PROXY: "1",
    SMTP_URL: undefined,
    SMTP_FROM: undefined,
    APP_NAME: "Gym RAT",
  });
  pglite = new PGlite();
  const db = drizzle(pglite, { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  setDbForTests(db);
});

afterAll(async () => {
  setDbForTests(null);
  await pglite?.close();
});

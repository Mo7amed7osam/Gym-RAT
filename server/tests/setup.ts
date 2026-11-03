import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";

import { setDbForTests } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { setEnvForTests } from "@/lib/env";
import { setMailSenderForTests } from "@/lib/mail";

import { API_ORIGIN, DASHBOARD_ORIGIN, outbox } from "./helpers";

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
    PUBLIC_ORIGIN: API_ORIGIN,
    ADMIN_ORIGIN: DASHBOARD_ORIGIN,
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 30,
    OFFLINE_LEASE_DAYS: 7,
    INVITE_TTL_HOURS: 72,
    RESET_TTL_MINUTES: 60,
    ADMIN_SESSION_HOURS: 12,
    ADMIN_IDLE_MINUTES: 60,
    TRUST_PROXY: "1",
    // Outbound mail is configured but captured (see tests/helpers.ts `outbox`).
    SMTP_HOST: "smtp.gymrat.test",
    SMTP_PORT: 587,
    SMTP_SECURE: "0",
    SMTP_USER: undefined,
    SMTP_PASSWORD: undefined,
    SMTP_FROM: "Gym RAT <no-reply@gymrat.test>",
    MAIL_DEFAULT_LOCALE: "en",
    APP_NAME: "Gym RAT",
  });
  setMailSenderForTests(async (message) => {
    outbox.push(message);
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

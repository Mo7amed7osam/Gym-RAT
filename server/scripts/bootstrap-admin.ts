import { count, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { randomToken, sha256 } from "../src/lib/auth/crypto";
import { actionTokens, users } from "../src/lib/db/schema";

/**
 * First-admin bootstrap (ADR-015). Runs on the server, never over HTTP:
 *
 *   npm run bootstrap-admin -- --email you@example.com [--name "Your Name"]
 *
 * Creates the admin account (only when no admin exists yet, or when
 * --email names an existing admin) and prints a one-time setup link where
 * the admin chooses a password; TOTP enrolment follows at first login.
 * No password is read from the environment, a file or the terminal.
 */
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const origin = process.env.PUBLIC_ORIGIN;
  if (!url || !origin) throw new Error("DATABASE_URL and PUBLIC_ORIGIN must be set");
  const email = arg("email")?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("--email <address> is required");
  const name = arg("name")?.trim() || email.split("@")[0];
  const hours = Number(process.env.INVITE_TTL_HOURS ?? 72);

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  try {
    const existing = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    const admins = await db.select({ n: count() }).from(users).where(eq(users.role, "admin"));
    let adminId: string;
    if (existing[0]) {
      if (existing[0].role !== "admin") throw new Error(`${email} exists as a member; promotion is not supported here`);
      adminId = existing[0].id;
      console.log(`Existing admin ${email}: issuing a new setup link (previous password stays valid until the link is used).`);
    } else {
      if (Number(admins[0]?.n ?? 0) > 0 && process.env.ALLOW_ADDITIONAL_ADMIN !== "1") {
        throw new Error("An admin already exists. Set ALLOW_ADDITIONAL_ADMIN=1 to add another one deliberately.");
      }
      const inserted = await db.insert(users).values({ email, displayName: name, role: "admin", status: "invited" }).returning({ id: users.id });
      adminId = inserted[0].id;
      console.log(`Created admin ${email}.`);
    }
    const raw = randomToken();
    const expiresAt = new Date(Date.now() + hours * 3_600_000);
    await db.insert(actionTokens).values({ userId: adminId, kind: "admin_setup", tokenHash: sha256(raw), expiresAt, delivery: "manual" });
    console.log("\nOne-time setup link (valid once, expires " + expiresAt.toISOString() + "):\n");
    console.log(`  ${origin.replace(/\/+$/, "")}/setup/${raw}\n`);
    console.log("Open it in a browser, choose a password, then sign in and enrol an authenticator app.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

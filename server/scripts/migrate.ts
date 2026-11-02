import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import postgres from "postgres";

/** Applies ./drizzle/*.sql (relative to the working directory, or MIGRATIONS_DIR) to DATABASE_URL. Idempotent; the container entrypoint runs it before the server. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(sql), { migrationsFolder: process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle") });
    console.log("migrations applied");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

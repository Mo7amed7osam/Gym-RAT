import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

/** Applies ./drizzle/*.sql to DATABASE_URL. Idempotent; run before `next start` (the container entrypoint does). */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    console.log("migrations applied");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

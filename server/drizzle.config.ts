import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://gymrat:gymrat@127.0.0.1:5433/gymrat" },
  strict: true,
  verbose: true,
});

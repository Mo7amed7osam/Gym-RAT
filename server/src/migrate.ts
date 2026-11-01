import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from './db.js';

/** Applies db/migrations/*.sql in name order, skipping ones already recorded. */
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations');

async function main() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const { rows } = await pool.query<{ version: string }>('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.version));

  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const version = path.basename(file, '.sql');
    if (applied.has(version)) continue;
    // Each migration manages its own BEGIN/COMMIT and records itself.
    await pool.query(await readFile(path.join(dir, file), 'utf8'));
    console.log(`applied ${version}`);
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

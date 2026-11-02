// Bundles the server CLI scripts (migrate, bootstrap-admin) into plain ESM
// files for the Docker image, so the runtime needs neither tsx nor tsconfig
// path aliases. `postgres` stays external (it is shipped with the standalone build).
import { build } from "esbuild";

await build({
  entryPoints: { migrate: "scripts/migrate.ts", "bootstrap-admin": "scripts/bootstrap-admin.ts" },
  outdir: "dist/cli",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["postgres"],
  tsconfig: "tsconfig.json",
  outExtension: { ".js": ".mjs" },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});

#!/bin/sh
# Applies pending migrations, then starts whatever the command is (the Next server by default).
set -eu
echo "[entrypoint] applying database migrations"
node ./node_modules/tsx/dist/cli.mjs ./scripts/migrate.ts
exec "$@"

#!/usr/bin/env bash
# Restores a dump produced by backup.sh into the running Postgres container.
# Stops the app first so no writes race the restore. Usage:
#   ./deploy/scripts/restore.sh deploy/backups/gymrat-20260102T031500Z.sql.gz
set -euo pipefail
cd "$(dirname "$0")/../.."
file="${1:?path to a .sql.gz dump}"
[ -f "$file" ] || { echo "no such file: $file"; exit 1; }
read -r -p "This replaces the current database with $file. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "aborted"; exit 1; }
docker compose stop app
gunzip -c "$file" | docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose start app
echo "restored $file"

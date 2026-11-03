#!/usr/bin/env bash
# Restores a dump produced by backup.sh into the running Postgres container.
# Stops the app first so no writes race the restore. Usage:
#   ./deploy/scripts/restore.sh deploy/backups/gymrat-20260102T031500Z.sql.gz
# Under Coolify set DB_CONTAINER and APP_CONTAINER to the container names (docker ps).
set -euo pipefail
cd "$(dirname "$0")/../.."
file="${1:?path to a .sql.gz dump}"
[ -f "$file" ] || { echo "no such file: $file"; exit 1; }
read -r -p "This replaces the current database with $file. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "aborted"; exit 1; }
if [ -n "${APP_CONTAINER:-}" ]; then docker stop "$APP_CONTAINER"; else docker compose stop app; fi
if [ -n "${DB_CONTAINER:-}" ]; then db=(docker exec -i "$DB_CONTAINER"); else db=(docker compose exec -T db); fi
gunzip -c "$file" | "${db[@]}" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
if [ -n "${APP_CONTAINER:-}" ]; then docker start "$APP_CONTAINER"; else docker compose start app; fi
echo "restored $file"

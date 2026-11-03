#!/usr/bin/env bash
# Dumps the Postgres database to deploy/backups/gymrat-<UTC timestamp>.sql.gz
# and keeps the newest 14. Run from the server/ directory; cron example:
#   15 3 * * * cd /opt/gymrat/server && ./deploy/scripts/backup.sh >> /var/log/gymrat-backup.log 2>&1
# Under Coolify the containers are not this directory's compose project: set
# DB_CONTAINER to the Postgres container name (docker ps) and BACKUP_DIR, e.g.
#   DB_CONTAINER=db-<uuid> BACKUP_DIR=/root/gymrat-backups ./backup.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
backups="${BACKUP_DIR:-deploy/backups}"
mkdir -p "$backups"
db_exec() { if [ -n "${DB_CONTAINER:-}" ]; then docker exec -i "$DB_CONTAINER" "$@"; else docker compose exec -T db "$@"; fi; }
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="${backups}/gymrat-${stamp}.sql.gz"
db_exec sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' | gzip -9 > "$out"
echo "wrote $out ($(du -h "$out" | cut -f1))"
ls -1t "${backups}"/gymrat-*.sql.gz | tail -n +15 | xargs -r rm -f

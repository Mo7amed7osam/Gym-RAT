#!/usr/bin/env bash
# Dumps the Postgres database to deploy/backups/gymrat-<UTC timestamp>.sql.gz
# and keeps the newest 14. Run from the server/ directory; cron example:
#   15 3 * * * cd /opt/gymrat/server && ./deploy/scripts/backup.sh >> /var/log/gymrat-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p deploy/backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="deploy/backups/gymrat-${stamp}.sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' | gzip -9 > "$out"
echo "wrote $out ($(du -h "$out" | cut -f1))"
ls -1t deploy/backups/gymrat-*.sql.gz | tail -n +15 | xargs -r rm -f

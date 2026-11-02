# DevOps — phase7-private-auth
**Deploy:** `server/docker-compose.yml` = Postgres 17 (internal), app (standalone Next build, non-root, healthcheck, migrations in entrypoint), Caddy (80/443, auto-TLS, HSTS, JSON access log). `.env.example` lists every variable; secrets generated with `openssl rand`. Restart `unless-stopped`; JSON logs capped 10 MB × 5.
**Backup/restore:** `deploy/scripts/backup.sh` (pg_dump gz, keep 14) and `restore.sh` (confirmation, stops app). Owner copies backups off the VPS.
**Firewall:** 22/80/443 only; Postgres never published.
**Rollback:** `git checkout <previous> && docker compose up -d --build`; migrations are additive so an older app runs on a newer schema.
**App builds:** `EXPO_PUBLIC_AUTH_API_URL` baked at bundle time; Debug falls back to localhost. Local Xcode archive ladder documented in the Phase 7 report; no EAS used.

## 2026-11-02 — SMTP (ADR-017)
Server env (VPS `server/.env`, never the app): `SMTP_HOST` (required), `SMTP_PORT` (587), `SMTP_SECURE` (`0` STARTTLS required / `1` implicit TLS), `SMTP_USER` + `SMTP_PASSWORD` (both or neither), `SMTP_FROM` (required, e.g. `Gym RAT <no-reply@your-domain>`; SPF/DKIM for that domain), `INVITE_TTL_HOURS` (72). Passed through by `docker-compose.yml`; template in `server/.env.example` (now committed). Migration `0001_invitation_email_status.sql` runs at container start.

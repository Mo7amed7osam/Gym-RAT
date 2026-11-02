# Gym RAT auth server + admin dashboard

Self-hosted accounts for the Gym RAT iPhone app (Phase 7, ADR-015/016). One Next.js
application serves the JSON API the app talks to and the admin dashboard the owner uses.
PostgreSQL stores accounts, sessions, one-time links and the audit log. **No workout data
ever reaches this server**: workouts live in SQLite on each member's iPhone.

- Members are created only by the admin. There is no sign-up.
- Every active member gets every app feature. No tiers, no payments.
- Admin sign-in needs a password **and** a TOTP authenticator.
- The app keeps working offline for 7 days after its last successful check-in.

## Layout

```
server/
├── src/app/api/auth/*        member API: login, refresh, me, logout, forgot-password, links/[token]
├── src/app/api/admin/*       admin API (cookie + TOTP + Origin check on every mutation)
├── src/app/(public)          /login, /invite/[t], /reset/[t], /setup/[t]
├── src/app/(admin)           /, /members, /members/new, /members/[id], /security, /audit, /settings
├── src/lib/auth/*            password (Argon2id), jwt (jose), member + admin sessions, action tokens, rate limit
├── src/lib/db/schema.ts      Drizzle schema → drizzle/*.sql migrations
├── scripts/                  migrate.ts, bootstrap-admin.ts, dev/totp-code.mts
├── tests/                    Vitest integration suite (real migrations on PGlite)
├── Dockerfile, docker-compose.yml, deploy/caddy/Caddyfile, deploy/scripts/{backup,restore}.sh
└── .env.example              production configuration template
```

## Local development

```bash
cd server
npm install
docker compose -f docker-compose.dev.yml up -d      # Postgres on 127.0.0.1:5433
npm run db:migrate                                   # uses .env.development
npm run bootstrap-admin -- --email you@example.com   # prints a one-time setup link
npm run dev                                          # http://localhost:3100
```

Open the setup link, choose a password, sign in, scan the QR with an authenticator app
(for scripted testing `npx tsx scripts/dev/totp-code.mts` prints the current code from the
dev database). The iPhone app's Debug builds talk to `http://127.0.0.1:3100` by default
(`EXPO_PUBLIC_AUTH_API_URL` in the app's `.env` overrides it).

```bash
npm test          # 30 API integration tests on an in-memory PostgreSQL (PGlite)
npm run typecheck
npm run lint
npm run build     # production build (standalone output)
```

## Production on a VPS (Docker Compose)

Requirements: a Linux VPS with Docker Engine + Compose v2, a domain whose A/AAAA record
points at it, and ports 80/443 reachable. Nothing else is exposed: Postgres and the app
stay on the internal Docker network; Caddy terminates HTTPS with automatic Let's Encrypt.

```bash
# on the VPS
git clone <repo> /opt/gymrat && cd /opt/gymrat/server
cp .env.example .env
# edit .env: SITE_ADDRESS, PUBLIC_ORIGIN, ACME_EMAIL,
#   POSTGRES_PASSWORD=$(openssl rand -base64 24)
#   AUTH_SECRET=$(openssl rand -base64 48)
docker compose up -d --build
docker compose logs -f app          # "migrations applied" then "Ready"
curl -s https://$SITE_ADDRESS/api/health

# first admin (one-time link printed; no password in env or chat)
docker compose exec app node ./node_modules/tsx/dist/cli.mjs ./scripts/bootstrap-admin.ts --email you@example.com --name "Your Name"
```

Then build the iPhone app with `EXPO_PUBLIC_AUTH_API_URL=https://<SITE_ADDRESS>` in the app's
`.env` so it talks to this server.

### Operations

| Task | Command |
|---|---|
| Update | `git pull && docker compose up -d --build` (migrations run at container start) |
| Logs | `docker compose logs -f app` (one JSON line per audit event); Caddy access log in the `caddy_data` volume (`/data/access.log`, rotated 20 MiB × 5) |
| Backup | `./deploy/scripts/backup.sh` → `deploy/backups/gymrat-<UTC>.sql.gz`, keeps 14. Cron: `15 3 * * * cd /opt/gymrat/server && ./deploy/scripts/backup.sh >> /var/log/gymrat-backup.log 2>&1`. Copy the folder off-box. |
| Restore | `./deploy/scripts/restore.sh deploy/backups/<file>.sql.gz` (stops the app, replaces the database, starts it) |
| Rotate `AUTH_SECRET` | change `.env`, `docker compose up -d`: every member must sign in again (access tokens and TOTP seeds are bound to it; re-enrol admin TOTP via the bootstrap CLI) |
| Add another admin | `ALLOW_ADDITIONAL_ADMIN=1 … bootstrap-admin.ts --email …` (deliberate, never through the dashboard) |
| Lost authenticator | use a recovery code; if none left, run the bootstrap CLI for that email to get a fresh setup link, then re-enrol |

Container logs are capped at 10 MB × 5 files per service (`logging` in `docker-compose.yml`).
Restart policy is `unless-stopped` for all three services; the app has a Docker healthcheck on
`/api/health`, which also reports the database.

### Firewall

Allow inbound TCP 22 (SSH, ideally key-only and restricted by source), 80 and 443 (TCP and UDP
for HTTP/3). Deny everything else. Postgres (5432) is never published; do not add a `ports:`
entry to `db`. Example with ufw: `ufw default deny incoming; ufw allow 22; ufw allow 80; ufw allow 443; ufw enable`.

### Monitoring

- `GET /api/health` returns `{"status":"ok","database":"ok"}`; point any uptime monitor at it.
- Caddy's `health_uri` polls it every 30 s and stops proxying while it fails.
- Watch the audit log for `member.refresh.reuse_detected` (token replay), `admin.login.failed`
  and `*.rate_limited`; they are also in `docker compose logs app` as JSON lines.
- Disk: `docker system df` and the backups folder.

## Security model (summary)

- Passwords: Argon2id (64 MiB, t=3, p=1); policy ≥ 12 chars, deny-list, not the email.
- Member sessions: 15-minute HS256 access tokens + 30-day opaque refresh tokens (SHA-256 at
  rest) that rotate on every use; reuse of a spent token revokes the whole device family.
  `GET /api/auth/me` checks the database, so disablement and revocation apply at the next
  online contact. The app stores tokens in the iOS Keychain (`AfterFirstUnlockThisDeviceOnly`).
- Offline lease: the server stamps `expiresAt = now + OFFLINE_LEASE_DAYS` on every login /
  refresh / me; the app enforces it with a clock high-water mark, so turning the clock back
  cannot extend it. Revocation while a phone is offline takes effect when it reconnects or
  when the lease runs out, whichever comes first. The product copy says so.
- Admin: HttpOnly, Secure, SameSite=Strict cookie; 12 h absolute / 60 min idle; mandatory
  TOTP with ten hashed recovery codes; every non-GET request must carry a matching `Origin`
  (or same-origin Fetch Metadata); CSP, `X-Frame-Options: DENY`, HSTS at Caddy.
- Rate limits (Postgres fixed windows, keys hashed): login 20/15 min per IP and 5/15 min per
  IP+email; refresh 120/min per IP; forgot-password 5/h per IP and 3/h per email; link
  redemption 10/15 min per IP; admin login 10/15 min per IP; TOTP 8/15 min per session.
- Enumeration: login, forgot-password and link redemption answer identically whether or not
  the email exists.
- Authorization: `withAdmin` wraps every admin route; member bearer tokens are refused there.
  No endpoint writes `users.role`; admins exist only through the server CLI.
- Audit: `audit_events` (actor, action, target, IP, user agent, success, metadata) — never
  passwords, tokens or codes.

### Sharing links manually (no SMTP)

Without `SMTP_URL`, invitation and reset links are shown to the admin once, to share by hand.
Implications:

- Whoever opens a link first sets the password. Send it over a channel you trust (in person,
  an end-to-end encrypted message), not a shared group chat.
- Links are single-use and expire (invitations 72 h, resets 60 min); issuing a new one cancels
  the old one, which is the remedy if a link may have leaked.
- Only the SHA-256 of a link is stored; the dashboard cannot show an old link again.
- Set `SMTP_URL`/`SMTP_FROM` to have the server email links instead; the member page then
  says "emailed" and the link is still shown as a fallback.

## API contract used by the app

All JSON. Errors: `{ "error": "<code>" }` with `invalid_credentials` 401, `account_disabled` 403,
`session_revoked` 401, `invalid_token` 401, `token_expired` 401, `rate_limited` 429 (+ `Retry-After`),
`validation` 400, `weak_password` 400.

| Method | Path | Body → Response |
|---|---|---|
| POST | `/api/auth/login` | `{email,password,deviceName?}` → `{accessToken, accessExpiresIn, refreshToken, user, lease, serverTime}` |
| POST | `/api/auth/refresh` | `{refreshToken}` → same as login (rotated) |
| GET | `/api/auth/me` | `Authorization: Bearer` → `{user, lease, serverTime}` |
| POST | `/api/auth/logout` | `{refreshToken}` → 204 |
| POST | `/api/auth/forgot-password` | `{email}` → 202 always |
| GET/POST | `/api/auth/links/[token]` | preview / `{password}` → set password, activate, sign out all devices |

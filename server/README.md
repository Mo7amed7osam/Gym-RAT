# Gym RAT auth + admin API

Self-hosted accounts for the Gym RAT iPhone app (Phase 7, ADR-015/016). This Next.js
application serves the JSON API the app talks to, the admin API, and the member link pages
(invitation, password reset, admin setup). The admin dashboard is a separate app in
[`../admin`](../admin/README.md) (ADR-018), hosted on its own origin (`ADMIN_ORIGIN`), which
calls the admin API here directly from the browser.
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
├── src/app/api/admin/*       admin API (cookie + TOTP + exact ADMIN_ORIGIN check on every mutation)
├── src/app/(public)          /invite/[t], /reset/[t], /setup/[t] (member and admin-setup link pages)
├── src/proxy.ts, src/lib/cors.ts  exact-origin CORS for /api/admin/* (ADMIN_ORIGIN only)
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
cd ../admin && npm install && npm run dev            # the dashboard, http://localhost:3200
```

`.env.development` needs `ADMIN_ORIGIN=http://localhost:3200` (the dashboard) next to
`PUBLIC_ORIGIN`, and the dashboard's `.env.local` needs
`NEXT_PUBLIC_API_ORIGIN=http://localhost:3100`. For a test that keeps the two hosts apart
(as in production) see "Local cross-origin test" in `../admin/README.md`.

Open the setup link, choose a password, sign in to the dashboard, scan the QR with an authenticator app
(for scripted testing `npx tsx scripts/dev/totp-code.mts` prints the current code from the
dev database). The iPhone app's Debug builds talk to `http://127.0.0.1:3100` by default
(`EXPO_PUBLIC_AUTH_API_URL` in the app's `.env` overrides it).

```bash
npm test          # API integration + cross-origin security tests on an in-memory PostgreSQL (PGlite)
npm run typecheck # also checks tests/admin-contract.ts: the dashboard's response types match the server's
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
# edit .env: SITE_ADDRESS, PUBLIC_ORIGIN, ADMIN_ORIGIN, ACME_EMAIL,
#   POSTGRES_PASSWORD=$(openssl rand -base64 24)
#   AUTH_SECRET=$(openssl rand -base64 48)
docker compose up -d --build
docker compose logs -f app          # "migrations applied" then "Ready"
curl -s https://$SITE_ADDRESS/api/health

# first admin (one-time link printed; no password in env or chat)
docker compose exec app node dist/cli/bootstrap-admin.mjs --email you@example.com --name "Your Name"
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
| Add another admin | `docker compose exec -e ALLOW_ADDITIONAL_ADMIN=1 app node dist/cli/bootstrap-admin.mjs --email …` (deliberate, never through the dashboard) |
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
- Admin: HttpOnly, Secure, SameSite=Strict, host-only cookie (no `Domain`); 12 h absolute /
  60 min idle; mandatory TOTP with ten hashed recovery codes; every non-GET request must carry
  `Origin` exactly equal to `ADMIN_ORIGIN` (requests without `Origin` are refused); CSP,
  `X-Frame-Options: DENY`, HSTS at Caddy. See "Admin dashboard on another origin" below.
- Rate limits (Postgres fixed windows, keys hashed): login 20/15 min per IP and 5/15 min per
  IP+email; refresh 120/min per IP; forgot-password 5/h per IP and 3/h per email; link
  redemption 10/15 min per IP; admin login 10/15 min per IP; TOTP 8/15 min per session.
- Enumeration: login, forgot-password and link redemption answer identically whether or not
  the email exists.
- Authorization: `withAdmin` wraps every admin route; member bearer tokens are refused there.
  No endpoint writes `users.role`; admins exist only through the server CLI.
- Audit: `audit_events` (actor, action, target, IP, user agent, success, metadata) — never
  passwords, tokens or codes.

### Admin dashboard on another origin (ADR-018)

The dashboard (`../admin`, e.g. on Vercel at `https://admin.<domain>`) calls this API
(`https://api.<domain>`) straight from the browser with `credentials: "include"`. Nothing
goes through the dashboard's host: passwords, TOTP codes and the admin cookie travel only
between the browser and this server.

- **Same site, different origins.** Both hosts must sit under the same registrable domain.
  SameSite is decided per *site*, so the `SameSite=Strict` cookie set by `api.<domain>` is
  sent on the dashboard's requests; no `SameSite=None` is needed. The cookie has no `Domain`
  attribute, so it is never sent to `admin.<domain>` itself.
- **CORS** (`src/proxy.ts`, `src/lib/cors.ts`, `/api/admin/*` only): the response carries
  `Access-Control-Allow-Origin: <ADMIN_ORIGIN>` and `Allow-Credentials: true` only when the
  request's `Origin` is byte-for-byte `ADMIN_ORIGIN`. No wildcard, no reflection. Preflights
  allow `GET, POST, PUT, PATCH, DELETE` with `Accept, Content-Type`; anything else gets 403.
  `Retry-After` is exposed for the rate-limit message. The member API (`/api/auth/*`) has no
  CORS: the iPhone app does not need it.
- **CSRF**: every admin mutation needs `Origin == ADMIN_ORIGIN`. CORS only controls who can
  read responses; this check and the Strict cookie are what stop forged requests.
- **Previews**: Vercel preview URLs (`*.vercel.app`) are a different site and not
  `ADMIN_ORIGIN`, so they can neither send the cookie nor pass CORS/CSRF. Never put a
  preview origin in `ADMIN_ORIGIN`, and never give previews a custom domain under `<domain>`.
- The setup page (`/setup/[token]`) sends the new admin to `ADMIN_ORIGIN/login`. This server
  serves no dashboard pages; `/` is a 404.

### Email (SMTP) — invitations

Invitations are emailed automatically (owner decision, 2026-11-02). There is no manual
fallback: without email settings the dashboard refuses to create or re-invite members
(`503 email_not_configured`), and a send that fails is recorded on the invitation and shown
on the members list and the member page ("Invite email failed" + the mail server's reason),
with **Resend invitation** to try again once fixed. The link itself is never shown to the
admin.

The provider is **Resend**, used through its SMTP relay (owner decision 2026-11-03, ADR-019);
any other SMTP relay works with the same variables. Set these in `server/.env` on the VPS
only (never in the iPhone app, the Vercel dashboard or Git):

| Variable | Resend value | Meaning |
|---|---|---|
| `SMTP_HOST` | `smtp.resend.com` | relay host |
| `SMTP_PORT` | `465` | 465 = implicit TLS; 587 with `SMTP_SECURE=0` also works (STARTTLS, required) |
| `SMTP_SECURE` | `1` | `1` = implicit TLS (465); `0` = STARTTLS, which is then required |
| `SMTP_USER` | `resend` | literally the word `resend` |
| `SMTP_PASSWORD` | a Resend API key | create one in Resend with **Sending access** limited to the sending domain |
| `SMTP_FROM` | e.g. `GYM RAT <no-reply@…>` | must be an address on a domain verified in Resend (see below) |
| `MAIL_DEFAULT_LOCALE` | `en` | email language for members without a stored choice (`en` or `ar`) |
| `INVITE_TTL_HOURS` | `72` | invitation lifetime (`RESET_TTL_MINUTES` for reset links, default 60) |

Blank values count as unset. Then:

```bash
docker compose up -d                                   # picks up .env
docker compose exec app node dist/cli/mail-check.mjs   # TLS + login to the relay; sends nothing
docker compose exec app node dist/cli/mail-check.mjs --to you@your-domain   # one plain test message
```

`mail-check` prints host, port, TLS mode and sender, never the user or key. Failure reasons
stored, displayed and logged are stripped of the SMTP user and password, and no log line
contains a link or token. Nodemailer does not retry, so a request sends at most one message.

#### Sending domain (Resend)

Resend shows the exact records to create under **Domains** after you add the domain; copy
them from there. For a domain `D` they have this shape: `TXT resend._domainkey.D` (DKIM
public key), `MX send.D → feedback-smtp.<region>.amazonses.com` (priority 10) and
`TXT send.D "v=spf1 include:amazonses.com ~all"` (SPF for the bounce address). DMARC
(`TXT _dmarc.<root>`, e.g. `v=DMARC1; p=none;`) is recommended. Only send once Resend
shows the domain as **Verified**.

#### Templates

Five branded emails (`src/lib/email/`): invitation, resent invitation (earlier links no longer
work), welcome after activation, password reset, and a password-changed security notice. Each
has HTML (dark charcoal card, gold accent, button, expiry box, copy-paste fallback link) and a
plain-text part, in English or Egyptian Arabic (right to left, Western digits, addresses and
links kept left to right). The language is the member's **Email language** (chosen when the
admin creates the member; stored in `users.email_locale`), else `MAIL_DEFAULT_LOCALE`.
Expiry times are shown in Cairo time. `npm run email:preview -- <dir>` writes all ten
versions as HTML and text for review.

Invitation security: 32 random bytes (base64url) per link; only the SHA-256 is stored; single
use; expires after `INVITE_TTL_HOURS`; issuing a new one cancels the previous. The email
contains only the link and its expiry, never a password; the member chooses the password on
the link page (Argon2id). The welcome and password-changed emails are best effort: if they
fail, the account change still stands and the failure is logged without any link or token.

### Password-reset links

Reset links are emailed the same way when SMTP works. If it is not configured or the send
fails, the reset link is shown to the admin once to share over a channel you trust (this is
unchanged from Phase 7; only invitations are email-only).

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

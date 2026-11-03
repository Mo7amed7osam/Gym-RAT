# Admin dashboard split — verification

**Date:** 2026-11-03 · **Branch:** `feature/admin-dashboard-split` (worktree `../Gym RAT-admin-split`), based on `main @ 866dd27` (tag `backup/main-before-admin-split`) · ADR-018 · Not merged, not pushed, nothing deployed, no DNS change, no EAS.

Note: commit `7076b98` alone does not typecheck (`server/tests/admin-contract.ts` imports `admin/`, added in `5d687b7`). Bisect across the pair.

## Automated checks
| Check | Result |
|---|---|
| Server Vitest | 74/74 (4 files; new `tests/cross-origin.test.ts`: 39) |
| Server tsc (incl. `tests/admin-contract.ts`, exact type identity; proven to fail on drift) / ESLint / `next build` | 0 / clean / ok |
| Dashboard Vitest (`safeNextPath`, API origin, API client) | 27/27 |
| Dashboard tsc / ESLint / `next build` | 0 / clean / ok |
| Dashboard build-time guards | no origin → builds (Preview); `VERCEL_ENV=production` without origin → fails; trailing slash → fails; plain http (non-local) → fails |
| Dashboard output | no `AUTH_SECRET`, `DATABASE_URL`, `SMTP_PASSWORD`, argon2, drizzle or postgres in `.next`; no backend packages in its lockfile |
| App Jest / snapshots | 360/360 (41 suites) / 4/4 unchanged (app source untouched; root Jest/tsc/ESLint now ignore `admin/`) |
| App tsc / lint / expo-doctor | 0 / clean / 20/20 |

## Local cross-origin run
Dashboard `next start` on `http://admin.gymrat.localhost:3200` (built with `NEXT_PUBLIC_API_ORIGIN=http://api.gymrat.localhost:3100`); API = the standalone production server on `http://api.gymrat.localhost:3100` with `ADMIN_ORIGIN=http://admin.gymrat.localhost:3200`, `TRUST_PROXY=0`, real PostgreSQL 17 (embedded-postgres, 127.0.0.1:5434), SMTP to a local catcher (nodemailer `smtp-server`, STARTTLS with a self-signed cert trusted via `NODE_EXTRA_CA_CERTS`; Mailpit needed Docker, which was down). `gymrat.localhost` makes the two hosts same-site, different origins, as in production. Plain http, so the cookie is not `Secure` here (it is whenever `PUBLIC_ORIGIN` is https; pinned by a server test).

Old VPS dashboard routes on the API host: `/`, `/login`, `/members`, `/members/new`, `/security`, `/audit`, `/settings` → 404. `/api/health` → `{"status":"ok","database":"ok"}`. `/robots.txt` → 200.

curl:
- Preflight from the dashboard → 204, `Allow-Origin: http://admin.gymrat.localhost:3200`, `Allow-Credentials: true`, `Allow-Methods: GET, POST, PUT, PATCH, DELETE`, `Allow-Headers: Accept, Content-Type`, `Expose-Headers: Retry-After`, `Max-Age: 600`, `Vary: Origin`.
- Preflight from `http://evil.localhost:3300` → 403, only `Vary: Origin`. GET from it → no CORS headers.
- `/api/auth/*` preflight → no CORS headers (iPhone API unchanged).
- `POST /api/admin/session` with a foreign Origin → 403 `csrf`; with no Origin (+ `Sec-Fetch-Site: same-origin`) → 403 `csrf`.

Dashboard response headers: CSP `connect-src 'self' http://api.gymrat.localhost:3100`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, HSTS.

Headless Chromium (Playwright), 36/36:

| | Check | Evidence |
|---|---|---|
| PASS | admin setup page (API host) sends the admin to ADMIN_ORIGIN/login |  |
| PASS | login + TOTP enrolment through the cross-origin API reaches the Overview |  |
| PASS | admin cookie lives on the API host only (host-only, HttpOnly, SameSite=Strict) | domain=api.gymrat.localhost httpOnly=true sameSite=Strict secure=false (http locally) |
| PASS | dashboard host has no cookies at all |  |
| PASS | dashboard JavaScript cannot read the cookie |  |
| PASS | session persists across reload and navigation |  |
| PASS | open redirect refused for next="//evil.example" | landed on http://admin.gymrat.localhost:3200/ |
| PASS | open redirect refused for next="https://evil.example/" | landed on http://admin.gymrat.localhost:3200/ |
| PASS | open redirect refused for next="/\\evil.example" | landed on http://admin.gymrat.localhost:3200/ |
| PASS | open redirect refused for next="/%09/evil.example" | landed on http://admin.gymrat.localhost:3200/%09/evil.example |
| PASS | invitation emailed over STARTTLS to the local SMTP catcher | subject="Gym RAT: set up your account" |
| PASS | dashboard never shows the invitation link |  |
| PASS | resend emails a new invitation and cancels the old link | emails=2 old link → 404 |
| PASS | member activates via the emailed link; app login (bearer API) works |  |
| PASS | disable from the dashboard blocks app login | status 403 {"error":"account_disabled"} |
| PASS | enable from the dashboard restores app login |  |
| PASS | password reset is emailed |  |
| PASS | member resets the password via the link; old fails, new works |  |
| PASS | Security page lists live member devices |  |
| PASS | Audit log shows admin and member events |  |
| PASS | Settings shows outbound email configured and the API origin |  |
| PASS | cross-site page cannot read admin API responses (CORS) |  |
| PASS | cross-site page: JSON POST stopped by the browser at the refused preflight (no response from the server) | POST /api/admin/members (application/json): net::ERR_FAILED; POST /api/admin/members (text/plain): net::ERR_ABORTED |
| PASS | cross-site page: preflight-free POST reaches the server and is refused by the CSRF origin check | POST /api/admin/members (text/plain) → 403 |
| PASS | cross-site page: cookie is not sent at all (SameSite=Strict) | GET /api/admin/session (no body) → 401 |
| PASS | same-site sibling page cannot read admin API responses (CORS) |  |
| PASS | same-site sibling page: JSON POST stopped by the browser at the refused preflight (no response from the server) | POST /api/admin/members (application/json): net::ERR_FAILED; POST /api/admin/members (text/plain): net::ERR_ABORTED |
| PASS | same-site sibling page: preflight-free POST reaches the server and is refused by the CSRF origin check | POST /api/admin/members (text/plain) → 403 |
| PASS | same-site sibling page: cookie is sent (same site), so only the CSRF check stops writes | GET /api/admin/session (no body) → 200 |
| PASS | no member created by hostile pages; admin session not revoked |  |
| PASS | second browser signs in with TOTP and honours a safe ?next=/members |  |
| PASS | 'Sign out others' revokes the other browser's session |  |
| PASS | logout clears the cookie and the old session token is dead on the server | replay → 401 |
| PASS | dashboard pages bounce to /login after logout |  |
| PASS | dashboard host never received a cookie | 0 |
| PASS | dashboard host never received a POST/PUT/PATCH/DELETE or request body (passwords, TOTP) |  |

Screenshots (session scratchpad, not committed): `e2e/shots/01-totp-enrol … 08-after-logout.png`; the design is unchanged.

## Docker clean-clone build
**`docker build` was not run.** Docker Desktop's VM has been unresponsive since it crashed on a full disk (its log: 2026-11-02 15:59 UTC, "no space left on device"). Instead, the Dockerfile's steps were run by hand on a sparse clone of the committed branch: `server/` only, `.dockerignore` exclusions applied, dependencies from an APFS copy of the lockfile-identical `node_modules` (not a fresh `npm ci`), the Dockerfile's exact build `RUN`. Build succeeded, and all eight runtime `COPY` sources exist (`.next/standalone/server.js`, `.next/static`, `public/robots.txt`, `drizzle/`, `dist/cli/migrate.mjs`, `dist/cli/bootstrap-admin.mjs`, `node_modules/postgres`, `deploy/scripts/entrypoint.sh`). On `866dd27`, `server/public` is not in git (`git show 866dd27:server/public/robots.txt` fails), which is the defect fixed. A real `docker build` from a clean clone remains to be run.

## Residuals
- Admin session token is not rotated at the TOTP step (unchanged from ADR-015).
- The code does not check that `ADMIN_ORIGIN` and `PUBLIC_ORIGIN` share a registrable domain (docs do); a mismatch fails closed (cookie not sent).
- Local `server/.env.development` now needs `ADMIN_ORIGIN`.
- Vercel Hobby is personal/non-commercial only: owner decision.
- No real-domain HTTPS run and no physical-device run.

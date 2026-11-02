# Phase 7 report — Private members platform

**Date:** 2026-11-02 · **Branch:** `feature/phase7-private-auth` (worktree `../Gym RAT-phase7`) · **Base:** `main @ 4a65663` (Phase 6 merged) · **Tip:** `3fb949c` · **Not merged, not pushed, nothing deployed, nothing uploaded to Apple.**
**ADRs:** 015 (auth, sessions, offline lease, backend), 016 (per-account local data, legacy claim). **Spec:** `specs/2026-11-02-phase7-private-members-design.md`. **Security review:** `reviews/2026-11-02-phase7-security-review.md`. **QA:** `reviews/2026-11-02-phase7-qa-report.md`.

## Parallel-session safety
Inspected before touching anything: `main` already contained the Phase 6 merge (`4a65663`); `release/phase6-fixes` (`1b5db4a`, worktree `../Gym RAT-phase6`, dirty) belongs to the other session and was left alone, as were PID 30742 (`expo run:ios` on the main checkout), Metro on 8081 and the two booted simulators. This phase used a new worktree, branch, simulator `GymRAT-Phase7` (F0457793…), Next on port 3100, Postgres on 127.0.0.1:5433, and `release-artifacts/` for every build output.

## Commits
| Commit | What |
|---|---|
| `603d946` | App: sign-in / forgot / legacy-data screens, Keychain session manager, offline lease, per-account SQLite, Settings account section, 37 tests |
| `64f4b3c` | Server: Drizzle schema + migration, Argon2id/jose/otpauth auth libs, member + admin API, 30 integration tests |
| `7e7b215` | Server: vitest alias fix |
| `e39542a` | Server: admin dashboard, public link pages, Docker/Compose/Caddy, backup scripts |
| `e65a5c1` | Server: dev CSP, Turbopack root, audit labels; dashboard screenshots |
| `3fb949c` | App: Arabic eyebrow, brand glow; state files, README, screenshots |
259 files changed (+20 693 / −1 001), of which ~110 are the new `server/` application.

## What was delivered (brief §12)
1. **Premium iOS login** — `screens/auth/LoginScreen.tsx` (+ forgot password, legacy-data claim): Barlow Condensed wordmark with a radial accent glow, 52 pt fields with focus ring and inline errors, password toggle, loading spinner, keyboard-aware, remembered session, Arabic RTL, light / dark / true black, VoiceOver labels and live-region errors. No sign-up, no pricing.
2. **Self-hosted auth API** — Next.js 16 route handlers under `server/src/app/api/auth/*` (login, refresh, me, logout, forgot-password, links/[token]).
3. **PostgreSQL schema + migration** — `server/src/lib/db/schema.ts`, `server/drizzle/0000_init.sql` (8 tables), applied at container start.
4. **Admin dashboard** — overview, members (search / filter / pagination), new member, member detail, security, audit log, settings; three themes; skeletons, empty states, confirm dialogs, toasts.
5. **Provisioning + sessions** — create / rename / enable / disable / delete, invitation and reset links (one-time, hashed, emailed when SMTP is set, otherwise shown once), per-device and all-device revocation, forgot-password queue, admin TOTP with recovery codes, first-admin CLI.
6. **Offline session handling** — 7-day server-issued lease, high-water-mark clock defence, revalidation on launch/foreground, graceful expiry wall, no data loss (18 tests).
7. **Per-account local data** — `gymrat.u-<id>.db` per account, scoped photos, Health-safe teardown order, explicit legacy claim, "Remove my data" with confirmation (10 tests on real SQLite files).
8. **Docker deployment** — `server/Dockerfile`, `docker-compose.yml` (Postgres + app + Caddy), `deploy/caddy/Caddyfile`, backup/restore scripts, `.env.example`, README with firewall/monitoring guidance.
9. **Tests + screenshots** — see below and `reviews/phase7-screenshots/`.
10. **Local IPA** — not produced; precise blocker below. Simulator Release build and unsigned device archive succeeded.
11. **Security review** — `reviews/2026-11-02-phase7-security-review.md`.
12. **Instructions** — `server/README.md` (local dev, VPS deploy, operations, API contract, manual-link guidance).

## Test results
| Check | Result |
|---|---|
| App Jest | 37 suites, **345 / 345** (37 new); 4 protected snapshots unchanged |
| App `tsc` / `expo lint` / `expo-doctor` | 0 errors / clean / 20 / 20 |
| Server Vitest (PGlite + real migration) | **30 / 30** (member auth 15, admin API 15) |
| Server `tsc` / `eslint` / `next build` | 0 / clean / green (standalone output) |
| Release simulator build (arm64, Xcode 27) | **BUILD SUCCEEDED** ×2 (`release-artifacts/simulator-release-build*.log`) |
| Unsigned device archive | **ARCHIVE SUCCEEDED** → `release-artifacts/GymRAT-unsigned.xcarchive` (zip + `SHA256SUMS.txt`) |
| Signed archive / IPA | **Blocked** (below) |
| End-to-end | Dashboard: setup → TOTP enrol → create members → invite → activate. App (Release simulator): sign-in → onboarding → Today → Settings account → sign-out → relaunch restore; Arabic RTL in light + true black. Server audit shows every step. |

## Screenshots (`reviews/phase7-screenshots/`)
iOS: `ios-01-login-en`, `ios-02-login-filled`, `ios-04-today-after-login`, `ios-05-settings-account`, `ios-06-relaunch`, `ios-07-sign-out-confirm`, `ios-08-signed-out`, `ios-09-login-ar`, `ios-10-login-ar-true-black`. Admin: `admin-02-totp-enrol`, `admin-03-recovery-codes`, `admin-04-overview`, `admin-05-members`, `admin-06-member-detail` (with the simulator's device), `admin-07-security`, `admin-08-audit`, `admin-09-settings`, `admin-10-new-member`, `admin-11-members-light`, `admin-12-members-true-black`, `public-01-invitation`.

## Backend startup (local)
```bash
cd server && npm install
docker compose -f docker-compose.dev.yml up -d        # Postgres 127.0.0.1:5433 (already running, holds the demo data)
npm run db:migrate && npm run bootstrap-admin -- --email you@example.com
npm run dev                                           # http://localhost:3100
```
Demo data in the dev database: admin `owner@example.com` (TOTP enrolled; `npx tsx scripts/dev/totp-code.mts` prints the current code), member `nour@example.com` (active), five invited members. Test passwords are in the session scratchpad, not in the repo. Reset by `docker compose -f docker-compose.dev.yml down -v`.

## VPS deployment requirements (owner)
Linux VPS with Docker Engine + Compose v2; a domain with DNS A/AAAA at the VPS; ports 80/443 open; then `server/README.md` → "Production on a VPS". Secrets are generated on the server (`openssl rand`); nothing is to be pasted in chat. After deploy, bake `EXPO_PUBLIC_AUTH_API_URL=https://<domain>` into the app build.

## Local IPA — signing ladder
| Step | Result |
|---|---|
| Release simulator build | ✓ |
| Unsigned archive (`CODE_SIGNING_ALLOWED=NO`) | ✓ `release-artifacts/GymRAT-unsigned.xcarchive` (bundle `com.gymrat.app` 1.0.0 (1), binary SHA-256 `f0bd5632…`, zip `dd5bcf65…`) |
| Signed archive (team `8TBB6SU34J`, automatic, `-allowProvisioningUpdates`) | ✗ `release-artifacts/archive-signed.log`: **"PLA Update available: You currently don't have access to this membership resource. To resolve this issue, agree to the latest Program License Agreement in your developer account."** Consequently Xcode could not register `com.gymrat.app` / `com.gymrat.app.ExpoWidgetsTarget` with HealthKit, App Groups and Data Protection, and the wildcard team profile lacks those capabilities. |
| Exported IPA | ✗ not attempted (no signed archive). **No IPA exists.** |
| Physical device | ✗ none available |
Team verified: the only "Apple Development" identity in the keychain is OU `8TBB6SU34J` (Mohamed Hosam, valid to 2027-03-17) and Xcode is signed in to that team. The two "Apple Distribution" identities belong to team `MZ5H52AJ5T` (another person) and were **not** used. No distribution certificate exists for `8TBB6SU34J`, so even after the PLA step the export method will be *development* (installable on registered devices), not ad-hoc/App Store, unless the owner creates one.

**Owner action to unblock:** sign in at developer.apple.com → accept the updated Program License Agreement → re-run
```bash
cd "../Gym RAT-phase7" && xcodebuild -workspace ios/GymRAT.xcworkspace -scheme GymRAT -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -archivePath release-artifacts/GymRAT-signed.xcarchive -derivedDataPath release-artifacts/DerivedData-device -allowProvisioningUpdates DEVELOPMENT_TEAM=8TBB6SU34J CODE_SIGN_STYLE=Automatic archive
xcodebuild -exportArchive -archivePath release-artifacts/GymRAT-signed.xcarchive -exportPath release-artifacts/ipa -exportOptionsPlist release-artifacts/ExportOptions-development.plist -allowProvisioningUpdates
```
(`ExportOptions-development.plist` is provided: method `development`, team `8TBB6SU34J`.) Set `EXPO_PUBLIC_AUTH_API_URL` to the production origin in `.env` before archiving; the archive built here has no server baked in (Release falls back to "no server configured").

## Remaining owner-only actions
1. Accept the Apple PLA; register devices; optionally create an Apple Distribution certificate for `8TBB6SU34J`.
2. Provide the VPS, domain and DNS; run the README deployment; run `bootstrap-admin`; enrol TOTP; create members.
3. Decide SMTP (optional) and review the manual-link guidance.
4. Review Arabic copy (machine-written, as in earlier phases).
5. Approve merge of `feature/phase7-private-auth` into `main` (not done).

## Known limitations
- Revocation reaches an offline phone only when it reconnects or when its lease (≤ 7 days) ends; the UI says so.
- One admin password + TOTP; no WebAuthn. Admins are created only via CLI.
- Rate limits are per IP (behind NAT, shared) and per IP+account; tune `LIMITS` after real use.
- Dashboard responsiveness was built with breakpoints but not screenshot-verified at phone width.
- Legacy photos referenced by a claimed database stay in the legacy folder (still displayed; not moved).
- App Review: the app now requires an account with no in-app sign-up; Apple guideline 5.1.1 accepts this for private/enterprise-style apps when a demo account is supplied to the reviewer. Record this when a submission is planned (out of scope here).

## Environment left behind
- Worktree `../Gym RAT-phase7`, branch `feature/phase7-private-auth @ 3fb949c`; `main` untouched.
- Docker container `gymrat-auth-dev-db-1` (Postgres on 127.0.0.1:5433) running with the demo data; Next dev server stopped.
- Simulator `GymRAT-Phase7` (F0457793-D6F9-4BFA-B660-DF5BB8D8C8E1) booted, English, light, app signed out.
- `release-artifacts/` (gitignored): simulator build logs, unsigned archive + zip + checksums, device DerivedData, `archive-signed.log`.

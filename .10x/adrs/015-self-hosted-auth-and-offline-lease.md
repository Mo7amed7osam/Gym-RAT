# ADR-015: Self-hosted authentication, rotating sessions and a bounded offline lease

**Status:** Accepted
**Date:** 2026-11-02
**Feature:** phase7-private-auth
**Author:** 10x-Team (Architect + Security + Staff Engineer)

## Context
Phase 7 turns Gym RAT into a private members app: login is required, accounts are created only by the administrator, every active member gets every feature, and the owner self-hosts the backend on a VPS. Workout data stays on the iPhone (ADR-001 still holds for workout data); the server only knows accounts and sessions. The app must keep working offline after the first login, within a bounded, revalidated grace period, and a device clock change must not trivially extend that period. No Supabase, Firebase or managed auth; no payments or tiers.

## Decision
One Next.js (App Router) application in `server/` hosts both the admin dashboard and the JSON API as route handlers, backed by PostgreSQL through Drizzle ORM. Deployment is Docker Compose (app + Postgres + Caddy as the HTTPS reverse proxy). No separate services.

Authentication composes maintained libraries; no custom cryptography:
- **Passwords:** Argon2id via `@node-rs/argon2` (memory 64 MiB, 3 iterations, parallelism 1). Policy: 12+ characters, not in a small deny-list, checked server-side; the admin never sees or stores a member's password.
- **Member (mobile) sessions:** short-lived access tokens (JWT, HS256 via `jose`, 15 minutes, signed with `AUTH_JWT_SECRET`) plus opaque refresh tokens (256-bit random, SHA-256 hash stored, 30-day idle expiry) that rotate on every use. A refresh token is part of a *family*; presenting an already-rotated token revokes the whole family (reuse detection). Revocation is server-side by family or by user.
- **Admin (web) sessions:** opaque session id in an `HttpOnly; Secure; SameSite=Strict; Path=/` cookie, SHA-256 hash stored, 12-hour absolute / 1-hour idle. Every state-changing admin request must carry `Origin`/`Sec-Fetch-Site` matching the configured public origin (CSRF). Admin login requires TOTP (`otpauth`), enrolled on first login; recovery codes are hashed.
- **Provisioning and recovery:** the admin creates a member (email + display name) and the server issues a one-time, 72-hour invitation token (hash stored). Password reset uses the same token table with a 1-hour lifetime. If SMTP is configured the server emails the link; otherwise the admin copies the link and shares it manually (risk documented in `server/README.md`). "Forgot password" from the app always answers 202, is rate-limited, and records a request the admin sees in the dashboard.
- **Rate limiting:** Postgres-backed fixed windows keyed by `ip` and by `ip+email` for login, refresh, forgot-password and token redemption; limits exceed → 429 with `Retry-After`, no account-existence leak.
- **Audit:** `audit_events` rows (actor, action, target, ip, user agent, metadata without secrets) for every admin action and every member auth event.
- **Bootstrap:** `npm run bootstrap-admin -- --email <addr>` creates the first admin (only when no admin exists) and prints a one-time setup link; no password or secret is ever read from the environment or chat.

Offline access on the device:
- After every successful login/refresh/`me`, the server returns `lease: { userId, issuedAt, expiresAt }` with `expiresAt = serverNow + 7 days`. The app stores the lease and tokens in the iOS Keychain (`expo-secure-store`).
- Access is allowed offline while `effectiveNow < lease.expiresAt`, where `effectiveNow = max(Date.now(), highWaterMark)` and `highWaterMark` is the largest device time ever observed by the app (persisted). Turning the clock back therefore cannot extend the lease; turning it forward only shortens it. An expired lease shows a sign-in wall; local data is never touched.
- Whenever the app is online (launch, foreground, before a workout starts) it revalidates with `GET /api/auth/me` (refreshing if needed). `401 account_disabled` or `401 session_revoked` signs the user out of the app immediately but keeps their local database. Network errors leave the lease as it is. The product copy states that revocation reaches a device only when it is online.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Managed auth (Supabase/Firebase/Clerk) | Fast | Third-party dependency, data leaves the owner's VPS | Excluded by the brief |
| Auth.js / Better Auth | Maintained, batteries included | Built around self-sign-up and OAuth; admin-only provisioning, device refresh families and the offline lease would be fought, not supported | Composition of focused libraries is smaller and auditable |
| Long-lived JWT only, no refresh | Simplest client | No server-side revocation without a deny-list | Revocation is a requirement |
| `owner_user_id` column on every SQLite table | One file | Touches every repository query and the protected logging path; migration risk on real data | ADR-016 chooses per-user files |
| Public-key-signed lease verified on device | Lease unforgeable offline | Key rotation and bundling complexity; an attacker with a jailbroken phone can patch the check anyway | Keychain storage + high-water-mark clock gives the required "not trivial" bar |

## Consequences
### Positive
- Single deployable, single database, one `docker compose up` on any VPS.
- Every secret lives in the server environment; the app ships none.
- Revocation, disablement and password resets take effect on the next online contact.
### Negative
- The app needs the network for its first login and at least once every 7 days.
- Admin TOTP is mandatory: losing the authenticator needs a recovery code or the bootstrap CLI on the server.
### Risks
- Manual invitation sharing exposes the link to whatever channel the owner uses (mitigated: 72 h, one-time, hashed at rest, revocable).
- A single VPS is a single point of failure for *login*; workouts keep working offline up to 7 days.

## Dependencies
- ADR-016 (per-user local data), ADR-001 (local-only workout data), ADR-013 (Phase 5 integrations must be detached on account switch).

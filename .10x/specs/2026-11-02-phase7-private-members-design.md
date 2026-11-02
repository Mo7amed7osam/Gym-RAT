# Phase 7 — Private members platform (design)

**Date:** 2026-11-02 · **Slug:** `phase7-private-auth` · **Branch:** `feature/phase7-private-auth` (worktree `../Gym RAT-phase7`, base `main @ 4a65663`) · **ADRs:** 015, 016
**Source:** owner brief "GYM RAT — PHASE 7: PREMIUM PRIVATE MEMBERS PLATFORM" (decisions pre-approved; execution authorised without further confirmation).

## Goal
Login-only Gym RAT: accounts created by the administrator on a self-hosted backend; every active member gets every feature; workouts stay on the phone; offline use bounded to seven days; a premium admin dashboard.

## Scope
In: iOS sign-in, forgot-password, legacy-data claim and account settings; Keychain session with rotating refresh and offline lease; per-account SQLite files; Next.js API + admin dashboard; PostgreSQL schema/migrations; Docker Compose + Caddy; tests; local IPA attempt; docs.
Out: App Store / TestFlight; cloud sync of workouts; payments or tiers; managed auth providers; email templates beyond plain text.

## Architecture
See ADR-015 (auth, sessions, lease, backend composition) and ADR-016 (per-account local data, legacy claim, teardown ordering).

```
iPhone (Expo RN)                              VPS (Docker Compose)
┌─────────────────────────────┐   HTTPS   ┌──────────┐  ┌─────────────────┐  ┌──────────┐
│ auth session (Keychain)     │◄─────────►│  Caddy   │─►│ Next.js app      │─►│ Postgres │
│ lease policy (hwm clock)    │ /api/auth │ TLS/ACME │  │ /api/auth (JWT)  │  │ accounts │
│ per-user SQLite gymrat.u-*  │           │          │  │ /api/admin (cookie│  │ sessions │
│ workouts never uploaded     │           │          │  │  + TOTP + Origin)│  │ audit    │
└─────────────────────────────┘           └──────────┘  └─────────────────┘  └──────────┘
```

## Data flow
1. Sign-in → server verifies Argon2id hash → issues access JWT (15 min), refresh token (30 d, hashed, family), lease (7 d).
2. App stores all three in SecureStore; boots `gymrat.u-<id>.db`; offers legacy claim once if `gymrat.db` holds user data and the account has none.
3. Launch / foreground → `GET /api/auth/me` (refresh if needed) → lease renewed; 401/403 → sign-out wall, data kept; network error → lease governs.
4. Admin creates member → invitation link (emailed or shown once) → member sets password on the web page → app sign-in.

## Error handling
Generic 401 for any credential problem; 403 for disabled; 429 with Retry-After; app maps codes to translated copy; nothing destructive on any auth error.

## Testing
Jest (app): lease + session manager (18), per-account files + legacy (10), screens en/ar + a11y (9), plus the 308 existing. Vitest (server): 30 API integration tests on PGlite with the shipped migrations. Manual: dashboard walk-through in Chrome (screenshots), Release simulator build, archive ladder.

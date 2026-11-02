# Phase 7 security review — self-hosted auth, admin dashboard, device isolation

**Date:** 2026-11-02 · **Scope:** `services/auth/*`, `data/db/boot.ts`, `app/_layout.tsx`, `server/**` · **Reviewer:** 10x-Team (Security Engineer) · **Method:** code reading against the brief's §4–§7 requirements, threat model below, and the automated suites (Jest 345, Vitest 30) that encode the attacks.

## Threat model
| Actor | Goal | Controls |
|---|---|---|
| Stranger on the internet | Sign in without an account; enumerate members; brute-force | No registration endpoint; identical 401 for unknown/wrong/invited; Argon2id with constant-time fallback hash; Postgres rate limits per IP and IP+email; TLS via Caddy; CSP/HSTS |
| Thief with a stolen refresh token | Keep a session alive | Rotation on every use; reuse of a spent token revokes the whole family (`member.refresh.reuse_detected`); 30-day idle expiry; admin can revoke per device |
| Disabled or deleted member | Keep using the app | `me` and `refresh` check `users.status` in the database → 403 at the next online contact; local data kept but the app signs out; offline window bounded to 7 days |
| Member tampering with the phone clock | Extend offline use | Lease evaluated against `max(now, highWaterMark)` persisted in the Keychain; rollback flagged `clockSuspect`; forward moves only shorten the lease |
| Second member on the same phone | Read the first member's workouts | One SQLite file per account; media folder per account; store hydrated empty between accounts; Health ledger nulled before the empty hydrate; legacy data only attached on explicit consent |
| Attacker with a stolen admin password | Open the dashboard | Mandatory TOTP (window ±1), 8 attempts / 15 min per session, hashed recovery codes; cookie `HttpOnly; Secure; SameSite=Strict`; 12 h absolute / 60 min idle |
| Cross-site page in the admin's browser | Trigger admin actions | `SameSite=Strict` cookie plus `Origin` / `Sec-Fetch-Site` check on every non-GET (`csrf` 403 tested); CSP `frame-ancestors 'none'` |
| Member trying to become admin | Privilege escalation | No API path writes `users.role`; create/patch schemas drop/refuse `role` (tested); admins only via server CLI |
| Someone who finds a shared invitation link | Take over the account | Single use, 72 h (reset 60 min), hashed at rest, re-issue cancels; documented manual-sharing guidance |
| Database dump leak | Reuse credentials | Argon2id password hashes; SHA-256 of every token; TOTP seeds AES-256-GCM under an HKDF-derived key from `AUTH_SECRET`; recovery codes hashed |

## Requirement check (brief §4)
Email/password ✓ · no public registration ✓ · admin-only provisioning ✓ · unique ids (UUID) ✓ · Argon2id ✓ · strong password policy ✓ · rate limiting ✓ · generic errors ✓ · short-lived access tokens (15 min) ✓ · rotating refresh ✓ · server-side revocation ✓ · Keychain storage ✓ · HttpOnly/SameSite cookies ✓ · CSRF ✓ · authorization on every admin endpoint (`withAdmin`) ✓ · validation (zod) + parameterised queries (Drizzle) ✓ · structured security logging without secrets ✓ · admin TOTP ✓ · no hardcoded secrets (env validated at boot; `.env.development` is dev-only and says so) ✓ · bootstrap via one-time CLI link ✓ · no admin/DB secrets in the app (`EXPO_PUBLIC_AUTH_API_URL` only) ✓.

## Findings
| Sev | Finding | Status / mitigation |
|---|---|---|
| Medium | `TRUST_PROXY=1` trusts `X-Forwarded-For`. Safe behind the shipped Caddyfile (`header_up X-Forwarded-For {remote_host}` overwrites client input) but a different proxy must do the same, or rate limits can be bypassed by spoofing. | Documented in README; `TRUST_PROXY=0` when exposed directly. |
| Medium | Per-IP login limit (20/15 min) can lock a whole gym behind one NAT if several members mistype at once. | Per-account limit (5) is the real brake; per-IP is a backstop. Tunable in `LIMITS`. Owner to decide after real use. |
| Medium | Offline lease is enforced by app code; a jailbroken device can patch it. | Accepted (brief asks for "not trivially"); true enforcement needs online checks, which happen whenever the device is online. |
| Low | HS256 with one shared `AUTH_SECRET` for access tokens and TOTP-seed key derivation. | Single service, no verifier outside it; rotation signs everyone out (documented). Move to EdDSA if a second service ever needs to verify tokens. |
| Low | `proxy.ts` only checks cookie presence (full validation in every API call). | By design: it prevents rendering the shell, not access. |
| Low | Invitation / reset preview reveals display name + email to the link holder. | Inherent to the flow; link is secret, single-use and short-lived. |
| Low | Audit metadata contains emails (needed by the admin) and device names chosen by the client. | React escapes output; nothing executes. No tokens/passwords are ever logged (tests assert). |
| Low | No automatic pruning of `audit_events` / dead `refresh_tokens`. | DBA note; manual `DELETE` cron recommended after a year. |
| Info | Dependencies: `npm audit` for the server not run against a registry mirror; run before deploy. | Owner action at deploy time. |

## Device-side review
- Keychain items use `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: no migration to another device through backups; background refresh works after first unlock.
- Sign-out clears the Keychain before the (best-effort) server call, so a failed network call never leaves credentials behind.
- `removeAccountData` requires an explicit confirmation dialog and deletes only that account's files; `resetAllData` is scoped to the open account.
- Legacy claim never deletes: copy → verify counts → rename.
- User ids are validated (`^[A-Za-z0-9_-]{1,64}$`) before becoming file names.

## Verdict
No blocking findings. Ship to the owner's VPS once secrets are generated on the server; keep the manual-link guidance in the dashboard copy.

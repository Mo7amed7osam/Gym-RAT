# ADR-017: Invitations by email only; workout data stays in device backups

**Status:** Accepted (owner decisions, 2026-11-02). Supersedes the invitation part of ADR-015 §Provisioning ("otherwise the admin copies the link"); confirms D9 for the per-account files of ADR-016.
**Feature:** integration-phase7-l10n

## Context
Phase 7 emailed invitation links only when SMTP was configured and otherwise showed them to the admin to share by hand. The owner chose automatic email invitations with no manual fallback, and chose to keep the SQLite workout data in iCloud / computer device backups.

## Decision
1. **Invitations.** Creating or re-inviting a member requires outbound email. Without `SMTP_HOST` + `SMTP_FROM` the server answers `503 email_not_configured` and creates nothing. Each invitation records `email_status` (sending / sent / failed), a credential-free `email_error` and `email_attempted_at` (migration `0001`, additive). The dashboard shows failures on the list, the member page and the create result, and offers "Resend invitation" (new token; the old one is cancelled). The URL is never returned to the admin. Token, hashing, single use, `INVITE_TTL_HOURS` (default 72) and Argon2id password setting are unchanged. SMTP configuration lives only in server environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`).
2. **Reset links** keep the Phase 7 behaviour (email when it works, otherwise shown once). Not part of the owner decision.
3. **Device backup.** No backup-exclusion attribute is set on any file. Per-account databases (`gymrat.u-<id>.db`), their backups, the claimed legacy file and photos stay in device backups, protected at rest by `NSFileProtectionCompleteUnlessOpen`. Sign-out and account switching never delete another account's file; only "Remove my data" (confirmed) and Reset All Data delete the open account's data. No cloud sync of workout history.

## Alternatives considered
| Alternative | Why not |
|---|---|
| Keep the manual-link fallback when SMTP fails | Owner decision: never silently fall back |
| Create the member and show a warning when SMTP is unset | Leaves accounts nobody can activate; refusing up front is clearer |
| Exclude the database from iCloud backup | Owner decision; there is no export, so a lost phone would lose all history |

## Consequences
The server cannot onboard members until the owner configures SMTP on the VPS. A backup of the phone contains workout and body data, protected by the user's backup encryption choice.

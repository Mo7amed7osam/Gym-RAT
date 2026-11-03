# ADR-019: Resend over SMTP and branded bilingual transactional email

**Status:** Accepted (owner decision 2026-11-03: Resend as the transactional email provider). Builds on ADR-015 and ADR-017 (email-only invitations). ADR-018 is used twice (admin dashboard split, committed; Neila Rey poster, another session); this is 019.
**Feature:** resend-email

## Context
The server already sent plain-text English invitation and reset emails through nodemailer with SMTP settings from the environment. The owner chose Resend, asked for premium branded templates in English and Egyptian Arabic, and asked that nothing about token security, expiry, single use or resend invalidation change.

## Decision
1. **Resend through SMTP**, not its HTTP SDK: `smtp.resend.com:465`, implicit TLS, user `resend`, API key as `SMTP_PASSWORD`. No new runtime dependency; any SMTP relay still works. The key lives only in `server/.env` on the VPS. `dist/cli/mail-check.mjs` verifies TLS + login (optionally sends one test message) without printing credentials.
2. **Five templates** (`src/lib/email/`): invitation, resent invitation, welcome after activation, password reset, password-changed notice. One layout: table-based HTML with inline styles (dark charcoal card, gold accent, bulletproof button, expiry box, copy-paste fallback URL, "didn't ask for this" note, footer) plus a plain-text part. Links are absolute from `PUBLIC_ORIGIN`.
3. **Language**: new nullable `users.email_locale` (`en`/`ar`, migration `0002`, additive). Chosen by the admin when creating a member (dashboard "Email language"), editable through `PATCH /api/admin/members/:id`; null falls back to `MAIL_DEFAULT_LOCALE` (default `en`, owner to review). Arabic: `dir="rtl"`, Arabic font stack, Western digits, CLDR plural forms, addresses and URLs isolated LTR. Wording follows the app's auth strings (كلمة المرور، البريد الإلكتروني، رابط) and avoids the owner's undecided terms.
4. **When each email goes out**: invitation/resent invitation when a link is issued (resent when an earlier invite link existed); reset when a reset link is issued; welcome and password-changed after a successful redemption, best effort (a failure is logged and never undoes the password change). A retried redemption hits the burned token (404), so no second notice.
5. **Hardening found on the way**: blank environment values now count as unset (compose passes `${SMTP_HOST:-}` as an empty string, which used to fail validation and take the server down); the cached SMTP transport is keyed on the password too, so a changed key is never served by an old connection.

## Alternatives considered
| Alternative | Pros | Cons | Why not |
|---|---|---|---|
| Resend HTTP SDK (`resend` package) | Message ids, richer errors | New dependency, second code path, provider lock-in | SMTP is drop-in and was requested |
| React Email / MJML | Component authoring | Build dependency for 5 emails | Hand-written table HTML is small and testable |
| Language from the app on login | Automatic | Changes the iOS app and the auth API | Out of scope; admin choice + default instead |

## Consequences
- Positive: branded, bilingual, accessible emails with plain-text parts; Resend can be swapped for any SMTP relay by env only.
- Negative: welcome/password-changed emails are new messages members receive; the language must be chosen at member creation (no dashboard control to change it later yet, API only).
- Risks: sending before the domain is verified fails (recorded as "Invite email failed"); `SMTP_FROM` must be on the verified domain (see the review for which domain the current DNS verifies).

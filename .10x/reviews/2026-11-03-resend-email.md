# Resend email integration and templates — verification

**Date:** 2026-11-03 · **Branch:** `feature/resend-email` (worktree `../Gym RAT-email`), from `main @ 6e78b7b` · ADR-019 · Not merged, not deployed, no email sent to anyone, DNS untouched.

## Checks
| Check | Result |
|---|---|
| Server Vitest | 95/95 (new: `tests/email.test.ts` 20, `tests/mail.test.ts` +1) |
| Server tsc (incl. dashboard contract) / ESLint / `next build` + CLI bundle | pass; `dist/cli/mail-check.mjs` built |
| Dashboard Vitest / tsc / ESLint / build | 27/27 / pass |
| `mail-check` CLI | unconfigured → clear message, exit 1; unreachable relay → `ESOCKET · connect ECONNREFUSED`, exit 1; credentials never printed |

`tests/email.test.ts` covers: all 5 templates × en/ar (lang/dir, escaping of display names, Western digits, absolute button URL = fallback URL, expiry wording with Cairo time and Arabic plurals, "didn't ask for this" text, LTR isolation of addresses in Arabic, glossary terms only); the flows (English by default, Arabic when chosen, `MAIL_DEFAULT_LOCALE` fallback, resend wording + old link 404, expired link refused, one welcome on activation and none on a retried redemption, double-submitted create sends one invitation, reset email then password-changed notice without token or password, failed welcome never undoes activation and logs no token); and the real nodemailer path against a local Resend-shaped relay (implicit TLS, user `resend`, API-key password, self-signed test cert in `tests/fixtures`): verify without sending, one multipart text+HTML UTF-8 message from the configured sender, wrong key → clear `535` failure with neither key nor token in any output, temporary `451` reported once with exactly one DATA (no retry) then recovery, unreachable relay fails without hanging.

## Previews
`npm run email:preview -- <dir>` writes the ten emails. Screenshots: `email-previews/` next to this file (desktop 720 px per template and language; `mobile-en.png` / `mobile-ar.png` show invitation + reset at 375 px).

## DNS observed (read-only `dig`, 2026-11-03)
- Nameservers: Vercel (`ns1/ns2.vercel-dns.com`).
- Already present, the shape Resend creates for the domain **`quantara-eg.com`**: `TXT resend._domainkey.quantara-eg.com` (DKIM key), `MX send.quantara-eg.com 10 feedback-smtp.eu-west-1.amazonses.com`, `TXT send.quantara-eg.com "v=spf1 include:amazonses.com ~all"`. So a Resend domain `quantara-eg.com` (region eu-west-1) appears to be set up; its status must be read in the Resend dashboard.
- Nothing exists for a separate domain `send.quantara-eg.com` (`resend._domainkey.send.quantara-eg.com` is empty). Sending from `no-reply@send.quantara-eg.com` requires adding that domain in Resend and creating the records it shows (they would live under `…send.quantara-eg.com`, e.g. `send.send.quantara-eg.com`). Sending from `no-reply@quantara-eg.com` uses the records already present.
- Root SPF is Zoho (`include:zohomail.com`); Resend's SPF lives on the `send.` bounce subdomain, so they do not conflict. No DMARC record exists.

## Open for the owner
- Choose the sender: `no-reply@quantara-eg.com` (records present) or `no-reply@send.quantara-eg.com` (new domain in Resend + new records).
- Confirm "Verified" in Resend, create a sending-only API key, put it in `server/.env` on the VPS, run `mail-check`.
- `MAIL_DEFAULT_LOCALE` default `en`: confirm or switch to `ar`.
- Native-speaker read of the Arabic copy (`src/lib/email/strings.ts`).

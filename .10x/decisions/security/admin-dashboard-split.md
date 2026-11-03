# Security — admin-dashboard-split (ADR-018)

- Cookie unchanged: HttpOnly, Secure on https, SameSite=Strict, `Path=/`, no `Domain`. Test pins the exact Set-Cookie string.
- CORS: only `Origin === ADMIN_ORIGIN` (byte-for-byte) gets `Allow-Origin` + `Allow-Credentials`; no wildcard, no reflection; preflight limited to GET/POST/PUT/PATCH/DELETE with Accept/Content-Type; everything else 403 without CORS headers. Member API has no CORS.
- CSRF: every admin mutation requires `Origin === ADMIN_ORIGIN`; missing Origin is refused (Fetch-Metadata/Referer fallbacks removed). The API's own origin is refused too (no same-origin dashboard any more).
- `ADMIN_ORIGIN` validated: origin only; https in production except `localhost`/`*.localhost`. `NEXT_PUBLIC_API_ORIGIN` validated at build; a Vercel Production build without it fails.
- Open redirect fixed: `safeNextPath` (absolute URLs, `//host`, backslashes, control characters → `/`).
- Previews (`*.vercel.app`, PSL) are cross-site: no cookie, no CORS, CSRF-refused.
- Residual: admin session token not rotated at the TOTP step (unchanged, ADR-015); a compromised subdomain of `<d>` is same-site (mitigated by the exact-origin CSRF check); Vercel Hobby is non-commercial only (owner decision).
- Evidence: 39 server tests (`tests/cross-origin.test.ts`), 27 dashboard tests, 36/36 headless-Chromium cross-origin checks (scratchpad `e2e/e2e.mjs`).

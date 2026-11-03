# ADR-018: Admin dashboard as a separate app on its own origin

**Status:** Accepted (owner authorization, 2026-11-03: Vercel Hobby for the dashboard only; separate `admin/` app; cross-origin support in the VPS API; old VPS dashboard removed, not kept for rollback). Amends ADR-015 (one Next.js app for API + dashboard).
**Feature:** admin-dashboard-split

## Context
ADR-015 served the auth API, the admin API, the member link pages and the admin dashboard from one Next.js app on the VPS, same-origin: relative `fetch` with `credentials: "same-origin"`, a `proxy.ts` gate reading the admin cookie, and a CSRF check comparing `Origin` with `PUBLIC_ORIGIN`. The owner chose to host only the dashboard on Vercel Hobby and keep the API, PostgreSQL, SMTP and all security logic on the VPS, with no duplicated business logic and no secrets on Vercel.

## Decision
1. **Two apps.** `admin/` is a standalone Next.js app with the dashboard pages (Overview, Members, New member, Member detail, Security, Audit, Settings) and the admin sign-in, their components and a browser fetch client. It has no API routes, no database, no Argon2 and no secrets. `server/` keeps every API route, the member link pages (`/invite`, `/reset`, `/setup`), `/api/health`, migrations, SMTP and all authorization. The dashboard's response types live in `admin/src/lib/api-types.ts`; `server/tests/admin-contract.ts` makes the server typecheck fail if they differ from the server's types.
2. **Browser calls the API directly.** `NEXT_PUBLIC_API_ORIGIN` (the only dashboard setting, public by design) is prefixed to every call, with `mode: "cors"` and `credentials: "include"`. No Vercel rewrites: passwords, TOTP codes and cookies never cross Vercel, and the API keeps seeing the admin's real IP for rate limits and audit.
3. **Cookie unchanged.** HttpOnly, Secure (https), SameSite=Strict, `Path=/`, host-only (no `Domain`). The dashboard and the API must share a registrable domain (`admin.<d>` / `api.<d>`): same site, so the Strict cookie is sent on credentialed cross-origin requests; the dashboard's host never receives it.
4. **CORS, exact origin.** New `ADMIN_ORIGIN` (server env; origin only; https in production except `localhost`/`*.localhost`). `src/proxy.ts` (matcher `/api/admin/:path*`) answers preflights (204 for `ADMIN_ORIGIN` with `GET, POST, PUT, PATCH, DELETE` and `Accept, Content-Type`, Max-Age 600; 403 with no CORS header otherwise) and adds `Access-Control-Allow-Origin: <ADMIN_ORIGIN>`, `Allow-Credentials: true`, `Expose-Headers: Retry-After` and `Vary: Origin` only for that exact origin. Byte-for-byte comparison, no wildcard, no reflection. `/api/auth/*` has no CORS.
5. **CSRF.** `assertAdminOrigin` (was `assertSameOrigin`) requires `Origin === ADMIN_ORIGIN` on every admin state change. The Fetch-Metadata/Referer fallbacks for requests without `Origin` are removed: browsers send `Origin` on all cross-origin and all non-GET fetches, so a mutation without it did not come from the dashboard.
6. **Old dashboard removed from the VPS** (owner: no second active copy, no rollback copy). The `proxy.ts` cookie gate is gone (the cookie is not visible on the dashboard host); the dashboard's client checks (`GET /api/admin/session` in `AdminShell` and `LoginFlow`) plus the server check on every API call remain. `/setup` sends the new admin to `ADMIN_ORIGIN/login`. `/` on the VPS is a 404.
7. **Fixes in scope.** Post-login `?next=` accepts only a same-origin path (`safeNextPath`: rejects absolute, `//host`, backslash and control-character forms). `server/public/robots.txt` is tracked, so `COPY /app/public` works from a clean clone.
8. **Previews** (`*.vercel.app`, on the Public Suffix List) are another site: no cookie, no CORS, refused by CSRF. Preview builds get no `NEXT_PUBLIC_API_ORIGIN`; a Production build without it fails.

## Alternatives considered
| Alternative | Pros | Cons | Why not |
|---|---|---|---|
| Vercel rewrites `/api/*` to the VPS (same-origin for the browser) | No CORS | Passwords, TOTP and cookies transit Vercel; Caddy sees Vercel IPs, breaking per-IP rate limits and audit IPs | Exposes secrets to a third party; weakens rate limiting |
| Deploy `server/` as is to Vercel | No code split | Every API route becomes a Vercel function needing `DATABASE_URL`/`AUTH_SECRET` | Duplicates the backend and puts secrets on Vercel |
| Cookie with `Domain=.<d>` so both hosts see it | Keeps the `proxy.ts` gate | Cookie sent to Vercel on every page load and to every subdomain | Widens exposure for no security gain |
| `SameSite=None` cookie | Works across sites | Weaker CSRF posture; needed only if hosts are cross-site | Same-site hosts make it unnecessary |
| Dashboard as a second Caddy site on the VPS | No cross-origin changes, no Hobby limits | Not the owner's hosting choice | Owner chose Vercel Hobby |

## Consequences
### Positive
- Vercel holds only static page code and one public URL; all secrets and logic stay on the VPS.
- Preview deployments cannot authenticate against production by construction.
- Exact-origin CORS + exact-origin CSRF are covered by 39 server tests; the response types are compile-time checked.

### Negative
- Two deployables; an `ADMIN_ORIGIN` / `NEXT_PUBLIC_API_ORIGIN` mismatch breaks the dashboard (visible, fails closed).
- No same-origin fallback dashboard on the VPS (owner's choice); rollback means redeploying the previous commit (`backup/main-before-admin-split`).
- The admin session token is still not rotated at the TOTP step (unchanged from ADR-015).

### Risks
- **Vercel Hobby is personal/non-commercial only.** A gym's member administration may be commercial use; the owner must decide (Pro or self-hosting the `admin/` app, which has no Vercel-specific code).
- A compromised subdomain of `<d>` is same-site: mitigated by the exact-origin CSRF check; do not host untrusted content under `<d>`.

## Dependencies
- DNS: `admin.<d>` → Vercel; `api.<d>` → VPS (Caddy `SITE_ADDRESS`). Both under one registrable domain.
- Server env: `ADMIN_ORIGIN`. Dashboard env (Production only): `NEXT_PUBLIC_API_ORIGIN`.

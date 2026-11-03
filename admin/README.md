# Gym RAT admin dashboard

The owner's dashboard for Gym RAT accounts (ADR-018): Overview, Members, create member and
invitation, member detail (resend invitation, disable/enable, password reset, revoke
devices), Security (TOTP, recovery codes, admin sessions), Audit log and Settings.

This app is **presentation only**. It has no API routes, no database, no secrets and no
server-side logic. Every page is a client of the auth + admin API in [`../server`](../server/README.md),
which runs on the VPS with PostgreSQL and SMTP. The browser calls that API directly:

```
browser ── HTML/JS ──────────────▶ admin.<domain>   (this app, Vercel)
browser ── /api/admin/* + cookie ─▶ api.<domain>     (VPS: Caddy → Next API → PostgreSQL, SMTP)
iPhone  ── /api/auth/* + bearer ──▶ api.<domain>
```

Passwords, TOTP codes and the admin cookie (HttpOnly, Secure, SameSite=Strict, host-only on
`api.<domain>`) never pass through this app's host. Both hosts must share one registrable
domain (`admin.<domain>` and `api.<domain>`) so the browser sends the Strict cookie on the
dashboard's credentialed requests. The API allows exactly one origin, its `ADMIN_ORIGIN`, for
CORS and for every state change (CSRF). Details: `../server/README.md`, "Admin dashboard on
another origin".

## Configuration

One variable, compiled into the browser bundle (so it is public by design):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_ORIGIN` | The API's origin, e.g. `https://api.<your-domain>`: scheme + host (+ port), no path, no trailing slash, https (plain http only for `localhost` / `*.localhost`). The build fails on anything else. |

Nothing else belongs here: no database URL, no `AUTH_SECRET`, no SMTP settings. Those stay
in the VPS `server/.env`.

Without `NEXT_PUBLIC_API_ORIGIN` the dashboard builds but makes no requests and says "This
dashboard build has no API address". That is the intended state for Vercel Preview
deployments.

## Vercel (Hobby) setup

Not done yet; owner action. Settings for the Vercel project:

| Setting | Value |
|---|---|
| Root Directory | `admin` |
| Framework Preset | Next.js |
| Node.js Version | 22.x (`engines` in `package.json`) |
| Install Command | `npm ci` (also in `vercel.json`) |
| Build Command | `npm run build` (also in `vercel.json`) |
| Output | Vercel's default for Next.js (no `standalone`, no static export) |
| Production Branch | `main` |
| Environment Variables | `NEXT_PUBLIC_API_ORIGIN` = `https://api.<your-domain>`, scope **Production only** |
| Preview Environment | leave `NEXT_PUBLIC_API_ORIGIN` unset; keep Vercel's preview Deployment Protection on |
| Domains | `admin.<your-domain>` on Production only; no custom domain on Preview deployments |
| Ignored Build Step | enable "skip deployments when there are no changes to the root directory" |

A Production build without `NEXT_PUBLIC_API_ORIGIN` fails on purpose (`VERCEL_ENV=production`).

Why previews cannot touch production: a preview lives on `*.vercel.app`, which is on the Public
Suffix List, so it is a different site from `api.<domain>`. The browser never sends the
Strict cookie there, the API's CORS answers it with no headers, and its CSRF check refuses its
`Origin`. Never add a preview URL to the API's `ADMIN_ORIGIN`, and never map a preview to a
subdomain of `<domain>`.

**Hobby is for personal, non-commercial use only** (Vercel's fair-use terms). If the dashboard
serves a business (a gym's member administration may count), use a Pro plan or host this app
yourself instead. The app has no Vercel-specific code: `npm run build && npm start` runs it
anywhere.

The VPS side needs `ADMIN_ORIGIN=https://admin.<your-domain>` in `server/.env`, and DNS:
`admin` → the record Vercel shows when you add the domain; `api` → A/AAAA of the VPS.

## Development

```bash
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_ORIGIN=http://localhost:3100
npm run dev                   # http://localhost:3200; the API runs from ../server (npm run dev, port 3100)
npm test                      # redirect and API-client tests (Vitest)
npm run typecheck
npm run lint
npm run build
```

The response types the pages read are declared in `src/lib/api-types.ts`; the server's
typecheck (`server/tests/admin-contract.ts`) fails if they stop matching its own types.

### Local cross-origin test

To reproduce production's two hosts on one machine, use two names under one `.localhost`
domain (browsers resolve `*.localhost` to 127.0.0.1, and `gymrat.localhost` makes them the
same site but different origins):

- API: `PUBLIC_ORIGIN=http://api.gymrat.localhost:3100`, `ADMIN_ORIGIN=http://admin.gymrat.localhost:3200`
- Dashboard: `NEXT_PUBLIC_API_ORIGIN=http://api.gymrat.localhost:3100 npm run build && npm start`
- Open `http://admin.gymrat.localhost:3200`. The cookie is visible only on `api.gymrat.localhost`.

Over plain http the cookie is not `Secure` (the API sets `Secure` whenever `PUBLIC_ORIGIN` is
https). Use a local SMTP catcher such as Mailpit for the invitation emails.

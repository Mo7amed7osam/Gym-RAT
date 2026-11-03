# Architect — admin-dashboard-split (ADR-018)

- Two deployables: `admin/` (Next.js, presentation only, Vercel Hobby) and `server/` (auth + admin API, member link pages, PostgreSQL, SMTP; VPS behind Caddy).
- Browser → `api.<d>` directly (`NEXT_PUBLIC_API_ORIGIN`, `credentials: "include"`); no Vercel rewrites. iPhone → `api.<d>` unchanged.
- Same site, different origins: Strict host-only cookie on `api.<d>` rides along; `admin.<d>` never receives it.
- Exact-origin CORS (`server/src/proxy.ts`, `/api/admin/*`) and exact-origin CSRF (`assertAdminOrigin`) keyed on `ADMIN_ORIGIN`.
- Contract: `admin/src/lib/api-types.ts`, checked by `server/tests/admin-contract.ts` (exact type identity) in the server typecheck.
- Old VPS dashboard removed (owner: no rollback copy). `/setup` → `ADMIN_ORIGIN/login`.
- Failure modes: origin mismatch → dashboard shows "Could not reach the server" (fails closed); API down → `/api/health` 503; Preview has no API origin → explicit "no API address".

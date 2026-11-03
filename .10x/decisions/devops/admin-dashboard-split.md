# DevOps — admin-dashboard-split (ADR-018)

- Vercel project (owner action, not created): Root Directory `admin`, Next.js preset, Node 22.x, `npm ci`, `npm run build`, Production Branch `main`, `NEXT_PUBLIC_API_ORIGIN` Production only, Preview unset + Deployment Protection, no custom domain on previews. Hobby = personal/non-commercial.
- VPS: new required `ADMIN_ORIGIN` in `server/.env` (passed through by `docker-compose.yml`); `SITE_ADDRESS`/`PUBLIC_ORIGIN` = `api.<d>`.
- DNS: `admin.<d>` → record Vercel shows; `api.<d>` → A/AAAA of the VPS.
- Dockerfile: `server/public/robots.txt` tracked, so `COPY /app/public` works from a clean clone; build stage passes a placeholder `ADMIN_ORIGIN`.
- Rollback: redeploy the previous commit (tag `backup/main-before-admin-split` = `866dd27`) on the VPS; the old same-origin dashboard returns with it. No migrations were added.
- Root app tooling (Jest, tsc, ESLint) ignores `admin/` as it ignores `server/`.

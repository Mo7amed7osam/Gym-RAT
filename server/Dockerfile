# syntax=docker/dockerfile:1.7
# Gym RAT auth server + admin dashboard (ADR-015). Multi-stage: deps → build → slim runtime.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder values so `next build` can evaluate config; real values come from the runtime environment.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build AUTH_SECRET=build-time-placeholder-secret-0123456789abcdef PUBLIC_ORIGIN=https://localhost npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system app && useradd --system --gid app --home /app app
# Standalone server + static assets.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Migrations, the CLI scripts and the few packages they need at runtime (drizzle-kit is not needed).
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/src/lib/db/schema.ts ./src/lib/db/schema.ts
COPY --from=build --chown=app:app /app/src/lib/auth/crypto.ts ./src/lib/auth/crypto.ts
COPY --from=build --chown=app:app /app/src/lib/env.ts ./src/lib/env.ts
COPY --from=build --chown=app:app /app/node_modules/tsx ./node_modules/tsx
COPY --from=build --chown=app:app /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=build --chown=app:app /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=build --chown=app:app /app/node_modules/get-tsconfig ./node_modules/get-tsconfig
COPY --from=build --chown=app:app /app/node_modules/resolve-pkg-maps ./node_modules/resolve-pkg-maps
COPY --from=build --chown=app:app /app/node_modules/.bin/tsx ./node_modules/.bin/tsx
COPY --chown=app:app deploy/scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]

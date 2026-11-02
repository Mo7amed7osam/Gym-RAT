# SDE — phase7-private-auth (what was built)
## App (Expo / React Native)
- `services/auth/{types,lease,storage,api,session}.ts` — contract, lease policy (pure), SecureStore wrapper + memory fake, fetch client with typed errors, session manager (restore / signIn / signOut / revalidate / single-flight refresh).
- `store/useAuthStore.ts` — Zustand mirror of the session; `configureAuthSession` test seam. `config/auth.ts` — base URL from `EXPO_PUBLIC_AUTH_API_URL` (Debug default localhost:3100), device label.
- `data/db/boot.ts` — boot scopes (`{userId}`; null = legacy file), `closeDatabase`, `removeAccountData`, `probeLegacyData`, `claimLegacyData`; `resetAllData` scoped. `data/db/schema.ts` — `userDatabaseName`/`userBackupDatabaseName` with id validation. `lib/customMedia.ts` — per-account photo folder. `store/useStoreHydrated.ts` — keyed by scope.
- `app/_layout.tsx` — Keychain restore before splash hide; `Stack.Protected` for `auth/*`, onboarding, app; `AccountSession` (boots DB, attaches integrations, revalidates on foreground, offers legacy data once); `SignedOut` closes the file; `BootOverlay` fade.
- Screens: `screens/auth/{LoginScreen,ForgotPasswordScreen,LegacyDataScreen}.tsx`, `legacyPrompt.ts`; components `auth/{BrandMark,AuthField}`, `settings/AccountSection`; routes `app/auth/{login,forgot,legacy-data}.tsx`. Strings `i18n/auth.{en,ar}.ts`.
- `jest.setup.js` — SecureStore mock. `.env.example`. `expo-secure-store` added (native: prebuild done in the worktree).
## Server (`server/`, Next.js 16 App Router)
- `src/lib/{env,http,cookies,audit,mail,members,admin-guard}.ts`, `src/lib/auth/{crypto,password,jwt,rate-limit,member-sessions,admin-sessions,action-tokens}.ts`, `src/lib/db/{schema,index}.ts`, `drizzle/0000_init.sql`.
- Routes: `api/health`, `api/auth/{login,refresh,me,logout,forgot-password,links/[token]}`, `api/admin/{session,session/mfa,mfa/enrol,members,members/[id],members/[id]/sessions,members/[id]/links,stats,sessions,audit,reset-requests,reset-requests/[id],account}`.
- UI: `(public)` login flow (password → TOTP / enrolment with QR + recovery codes), `/invite|/reset|/setup/[token]`; `(admin)` shell with dark / true-black / light themes, overview, members (search, filter, pagination), new member (link panel), member detail (devices, activity, actions with confirm dialogs, toasts), security, audit, settings. Primitives in `src/components/ui/*`.
- Ops: `Dockerfile` (standalone, non-root, healthcheck, migrations in entrypoint), `docker-compose.yml` (+ `.dev.yml`), `deploy/caddy/Caddyfile`, `deploy/scripts/{backup,restore,entrypoint}.sh`, `scripts/{migrate,bootstrap-admin}.ts`, `scripts/dev/totp-code.mts`, `README.md`.
## Deviations from the brief
- shadcn/ui components were written by hand in the same style (the CLI is interactive); Lucide icons used throughout.
- Email delivery is plain-text nodemailer (optional); no HTML templates.
- Admin role assignment only via CLI (stronger than the brief's "no self-promotion").
## Tech debt
- `audit_events` / dead `refresh_tokens` pruning is manual. Mobile responsive layout of the dashboard is implemented with Tailwind breakpoints but was not screenshot-verified at phone width (window resize was refused by the browser session). Reduced-motion honoured; no further animation work.

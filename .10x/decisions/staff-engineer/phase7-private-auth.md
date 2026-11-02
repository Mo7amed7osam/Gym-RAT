# Staff Engineer — phase7-private-auth
**Patterns kept:** Zustand store + external session object (same shape as `services/integrations`); `createStyles` + theme tokens, no colour literals; i18n dictionaries `auth.en.ts`/`auth.ar.ts`; tests inject fakes through `configureAuthSession` / `createMemoryAuthStorage` / `setDbForTests`.
**Cross-cutting:** every auth error is a code, translated at the edge; every admin route goes through `withAdmin`; every token is hashed before storage; `requestContext()` is the only place IPs are read.
**Standards added:** server dir excluded from root tsc/eslint/jest; `server/` has its own toolchain. Route handlers stay plain functions of `Request` so the Vitest suite calls them directly. React 19 lint rules: no setState in effects (adjust-during-render or `useSyncExternalStore`).
**Protected:** `SetRow`, `ExerciseCard` grid untouched; 4 snapshots byte-identical.

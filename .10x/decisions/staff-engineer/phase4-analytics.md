# Staff Engineer — phase4-analytics

## Patterns followed
- Pure `domain/` modules, `now`/`weekStart` passed in; tests in `__tests__/` with the node SQLite driver.
- Write-through persistence: compute next state → `persist(prev, next)` in one transaction → apply; a throw discards the change.
- Theme via `createStyles`/`useTheme`; strings via `useT`; Arabic keeps Western digits (`intlLocale`).
- Routes are thin re-exports of `screens/*` (existing convention).

## Merge-surface rules (parallel with Phase 3)
- Do not edit: `lib/workoutMath.ts`, `store/useWorkoutStore.ts`, `screens/HistoryScreen.tsx`, `components/SetRow.tsx`, `components/ExerciseCard.tsx`, `data/db/repository.ts`.
- Additive-only edits: `data/db/schema.ts` (v7 block + `REQUIRED_TABLES`), `data/db/migrations.ts` (one step), `data/db/boot.ts` (hydrate/attach/reset progress store), `app/_layout.tsx` (Stack.Screen lines), `app/(tabs)/progress.tsx` (one-line re-export), `i18n/en.ts`/`ar.ts` (new top-level `progress` group).

## Cross-cutting
- Counted set = completed + working + weight and reps logged (same rule as volume/PRs).
- Dates bucketed in local time from `startedAt`.
- Charts: `react-native-svg` (already installed), single series, tap to read value, x-axis mirrored under RTL.
- Inputs parsed with `lib/parseNumber` (Arabic-Indic digits, `٫`).

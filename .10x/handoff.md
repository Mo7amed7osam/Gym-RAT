# Handoff

**From:** 10x orchestrator (discovery + strategy + design + Phase 1 planning)
**To:** SDE / Senior Engineer — Phase 1 authorized; M0 complete
**Date:** 2026-11-01

## Gates still open
- D5 (Apple credentials) before M3 device tests; D3 before M7; D4 before M4 completes.

## Next task: M5 — theme system (ADR-005)
1. Branch `phase1/m5-theme`. Before touching stylesheets: RNTL snapshot of `SetRow` and `ExerciseCard` (store mocked) in the current dark theme.
2. `theme/`: tokens seeded from `constants/theme.ts`; `ThemeProvider` (mode light/dark/system/trueBlack, accent, textScale, density) persisted in settings; `useTheme`, `useStyles(fn)` memoized per theme id.
3. Migrate every `StyleSheet.create` referencing `colors` (~15 files) to `useStyles`; `app.json` `userInterfaceStyle: "automatic"`; appearance section in Settings.
4. Lint rule: no colour literals in components/screens.
5. Gates: snapshots identical in dark; four modes switch at runtime.

## Done: M4, M3, M2, M1, M0
- M4: rotation model, reducer, Today rewrite. See `decisions/sde`, `decisions/dba`.
, M2, M1, M0
- M3: SQLite write-through persistence, importer, boot. See `decisions/sde`, `decisions/dba`.

1. Baseline already committed (`chore: baseline import`). Add Jest via `npx expo install jest-expo jest @types/jest`, config `jest.config.js` with preset `jest-expo`.
2. Tests for `lib/workoutMath.ts` (volume, e1RM, PR detection incl. first-time-no-PR, weekly buckets), `lib/parseNumber.ts` (Arabic-Indic digits, `٫`/`,` decimals), `lib/format.ts`, rest-timer helpers (`getRestRemainingMs`, `adjustRestTimer` never below zero).
3. Do not touch `components/SetRow.tsx` or the grid/tiles/footer of `components/ExerciseCard.tsx` in any Phase 1 milestone.
4. Commit per milestone on a branch `phase1/m0-test-harness`; merge after owner review.

## Read first
- `specs/2026-11-01-gym-rat-transformation-design.md` §2, §5, §6 (milestones), Appendix A.
- `adrs/001`–`005`.
- `decisions/senior-engineer/transformation.md` for per-milestone approach and traps.

## Protected
Sets Logging UI layout; rest timer model; `lib/workoutMath.ts`, `lib/parseNumber.ts`, `lib/feedback.ts`; theme tokens; Barlow Condensed; PDF program data as reference seed.

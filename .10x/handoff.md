# Handoff

**From:** 10x orchestrator (discovery + strategy + design + Phase 1 planning)
**To:** SDE / Senior Engineer — Phase 1 authorized; M0 complete
**Date:** 2026-11-01

## Gates still open
- D5 (Apple credentials) before M3 device tests; D3 before M7; D4 before M4 completes.

## Next task: M1 — remove sync/server (ADR-001)
1. Branch `phase1/m1-remove-sync` from `phase1/m0-test-harness` (or main after merge).
2. Delete `lib/sync.ts`, `server/`, `.env.example`; remove `useSyncQueue` from `app/_layout.tsx`; remove `syncQueue`/`SyncOp`/`enqueueSync`/`ackSyncOps` from the store; persist `version: 3` with `migrate` dropping `syncQueue`; remove `isSyncConfigured` usage + sync row from `screens/SettingsScreen.tsx`; update `eslint.config.js`/`tsconfig.json` ignores for `server`.
3. Update tests: drop sync assertions; add v2→v3 migration test.
4. tsc, lint, jest green; commit; update state.

## Done: M0
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

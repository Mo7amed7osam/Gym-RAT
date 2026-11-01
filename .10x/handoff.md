# Handoff

**From:** 10x orchestrator (discovery + strategy + design + Phase 1 planning)
**To:** SDE / Senior Engineer — Phase 1 authorized; M0 complete
**Date:** 2026-11-01

## Gates still open
- D5 (Apple credentials) before M3 device tests; D3 before M7; D4 before M4 completes.

## Next task: M4 — plan/rotation + session reducer (ADR-003)
1. Branch `phase1/m4-rotation`. Schema v2 adds `plans`, `plan_days`, `plan_exercises`; `sessions` gains `plan_id`, `plan_day_id`, `kind`, `paused_intervals_json`, `exercise_order_json`, `deferred_ids_json`, `ended_at_override`, `notes`. First real migration → the backup hook becomes testable (add the test).
2. `domain/session/reducer.ts` pure; keep every existing store action name/signature so `ExerciseCard`/`SetRow` stay diff-free; add `pauseWorkout`, `resumeWorkout`, `deferExercise`, `reorderExercises`, `finishAndAdvance`/`finishAndRepeat`.
3. Seed: PDF program as `kind='reference'` (stable day ids `pdf_v5:push_a` …), placeholder Starter clearly named `Full Body Starter (draft, pending D4)`.
4. Importer mapping: legacy `routineId` → `pdf_v5:<routineId>` day id.
5. Rewrite `TodayDashboardScreen` around `plans.next_day_index`; week strip → calendar of actual sessions; `HistoryScreen` badges keyed by day code; week-start setting (default Saturday).
6. Gates + state + merge.

## Done: M3, M2, M1, M0
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

# ADR-010: Phase 4 analytics as pure derivations, a separate progress store, and a strength-metrics seam for Phase 3

**Status:** Accepted (Phase 4, 2026-11-02, owner brief "Phase 4 parallel implementation")
**Date:** 2026-11-02
**Feature:** phase4-analytics
**Author:** 10x-Team (Architect + Staff Engineer + DBA)

## Context
Phase 4 (Progress & Analytics) is built in parallel with Phase 3 (Smart Training) on a separate branch from `6319c60`. Phase 3 owns PR calculation, e1RM, progressive overload and coaching, and will touch `lib/workoutMath.ts`, `store/useWorkoutStore.ts`, `data/db/schema.ts` (likely a `pr_cache` table, spec §72) and the i18n dictionaries. Phase 4 needs: history review and editing with recomputation, volume/frequency/muscle analytics, exercise progression, calendar, period comparisons, trends, goals and body measurements, all offline in SQLite, Arabic RTL and themed.

All finished sessions are already loaded into the workout store (`history`), and every store change is written through `WorkoutRepository.persistDiff` in one transaction.

## Decision
1. **Analytics are pure functions over `history`** in `domain/analytics/*` (no React Native imports, no clock reads except a `now` argument). No analytics tables or caches: 500 sessions is well inside in-memory budgets, and derivations can never drift from raw sets.
2. **Strength-metrics seam.** `domain/analytics/metrics.ts` defines `StrengthMetrics { estimateOneRepMax, detectPersonalRecords }`. The default adapter delegates to the existing (Phase 1, protected) `lib/workoutMath.ts`. Phase 3 replaces it with `registerStrengthMetrics(engine)`; Phase 4 never implements its own e1RM or PR rules.
3. **History edits = pure edit ops + chronological replay.** `domain/history/edit.ts` edits a copy of a finished session and validates it. `domain/history/recompute.ts` replays completed sessions in `startedAt` order from `min(old, new)` start of the touched session, recomputing each summary (volume, sets, duration, PRs via the seam against prior sessions only). Sessions whose summary is unchanged keep their object reference so `persistDiff` rewrites only what changed. `store/historyActions.ts` applies the result with `useWorkoutStore.setState({ history })`, which is the existing guarded write-through: one transaction, all or nothing. Deletes from Phase 4 UI go through the same replay.
4. **Body metrics and goals live in Phase 4–owned tables** (`body_metrics`, `goals`, schema step v7, `CREATE TABLE IF NOT EXISTS`) behind a separate `ProgressRepository` and `useProgressStore` with the same write-through contract. `PersistedWorkoutState` and the workout store are not extended.
5. **Routes under `app/analytics/*`** (the tab already owns `/progress`). New tab screen `screens/ProgressScreen.tsx`; `screens/HistoryScreen.tsx` is left untouched.
6. **Strings in a new top-level `progress` group** of both dictionaries.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Add `bodyEntries`/`goals` slices to `PersistedWorkoutState` | One store, one diff writer | Touches `pickPersisted`, `persistedChanged`, `hydrate`, `repository.ts`, `resetAllData`, every test fixture: maximum merge conflict with Phase 3 | Separate store, same contract |
| Materialised analytics tables (weekly rollups) | Faster queries at large history | Must be rebuilt on every edit; can drift; extra schema to coordinate | Pure derivation is fast enough at target scale (500 sessions) |
| Phase 4 implements its own e1RM / PR detection | No dependency on Phase 3 | Two competing engines, divergent numbers | Seam with default adapter |
| Recompute only the edited session | Cheap | Later sessions keep stale PRs (spec §9: "edits/deletes recompute") | Replay from the edit point |
| Edit history through `SetRow`/`ExerciseCard` | Reuse | Protected UI wired to active-session actions | Plain history edit rows |

## Consequences
### Positive
- Phase 3 integration is one call (`registerStrengthMetrics`) plus a renumbered migration step.
- Every analytic is unit-testable and always consistent with raw sets.
### Negative
- Replay after an early edit is O(sessions × prior sessions) with the baseline adapter; acceptable at 500 sessions, revisit if Phase 3 adds `pr_cache`.
- PRs stored in `summary.personalRecords` stay the source the UI shows; until Phase 3 lands they follow the baseline rules (top weight + e1RM, first time is not a PR).
### Risks
- **Migration number collision:** Phase 3 will likely also claim v7. Steps are idempotent (`IF NOT EXISTS`) and tests use `SCHEMA_VERSION`, so whichever merges second renumbers its step. Recorded in merge risks.
- Weight-type semantics (`per_hand`, `assisted`) are not applied to volume/e1RM; this matches current `workoutMath` and is Phase 3's decision.

## Dependencies
- ADR-002 (SQLite write-through), ADR-007 (exercise table; muscles for distribution), ADR-009 (set kinds stay analytics-neutral).
- Constrains Phase 3: PR engine must satisfy `StrengthMetrics`; a future `pr_cache` must be refreshed in the same transaction as `historyActions` writes.

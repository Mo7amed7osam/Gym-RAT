# DBA — phase4-analytics

## Schema v7 (Phase 4–owned)
- `body_metrics(id PK, kind, value REAL CHECK > 0, measured_at, note, created_at, updated_at)`, index `(kind, measured_at)`.
- `goals(id PK, kind, exercise_id, body_metric, target_value REAL CHECK > 0, baseline_value, deadline, achieved_at, archived, created_at, updated_at)`, index `(archived, created_at)`.
- `kind` columns have no CHECK on purpose (ADR-009 lesson: widening a CHECK needs a rebuild); validated in `types/progress.ts` + store.
- No foreign key from `goals.exercise_id` to `exercises`: exercises are archived, never deleted, and a dangling id degrades to showing the id.
- Both tables in `REQUIRED_TABLES`; `verifySchema` fails boot if missing.

## Migration safety
- Step 7 is `CREATE … IF NOT EXISTS` only: no data rewrite, runs inside the existing per-step transaction with backup/restore from `boot.ts`.
- **Merge note:** Phase 3 may also define step 7. Whichever merges second renumbers its step to 8; because both are idempotent creates, a dev database that already ran one branch's v7 must be reset or the other's tables created manually (simulator data only; no shipped builds).

## Write paths
- History edits: `useWorkoutStore.setState({ history })` → `WorkoutRepository.persistDiff` (one transaction; only sessions with new object references are rewritten).
- Body/goals: `ProgressRepository.persistDiff` (one transaction; by id + reference).
- Reset All Data: progress store detached and emptied before the file is deleted.

## Merge plan update (2026-11-02, QA)
Renumbering alone is unsafe (a Phase 4 v7 database would skip Phase 3's step 7). Prescribed: 7 = Phase 3, 8 = Phase 4, 9 = reconcile both create-only steps; guard any non-idempotent Phase 3 DDL with `PRAGMA table_info`. `ensureProgressSchema` (boot) repairs missing Phase 4 tables on any database. Proven in `__tests__/progress.migration-merge.test.ts`. Full sequence: `specs/2026-11-02-phase4-phase3-integration-handoff.md` §4.

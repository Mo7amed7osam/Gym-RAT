# ADR-012: Integrating Phase 3 and Phase 4 — one migration sequence, schema reconciliation on every launch, one strength engine

**Status:** Accepted (integration, 2026-11-02)
**Date:** 2026-11-02
**Feature:** transformation (Phase 3) + phase4-analytics
**Author:** 10x-Team (Architect + Staff Engineer + DBA)

## Context
Phase 3 (`main`, HEAD `cd19cc9`) and Phase 4 (`feature/phase4-analytics`, HEAD `74a75f3`) were built in parallel from `6319c60`. Each added a schema step 7: Phase 3 `ALTER TABLE session_exercises ADD COLUMN recommendation_json`, Phase 4 `CREATE TABLE body_metrics / goals`. Development databases exist in three shapes (v6, Phase 3 v7, Phase 4 v7) and the simulator holds a Phase 3 v7 file with real sessions. Phase 4 also shipped a `StrengthMetrics` seam whose default delegated to the Phase 1 `lib/workoutMath` PR detector, while Phase 3 made `domain/records` the PR engine; two engines would let records and charts disagree and make history replays rewrite untouched summaries.

## Decision
1. **Canonical sequence:** 7 = Phase 3 column (conditional on `pragma_table_info`), 8 = Phase 4 tables (`IF NOT EXISTS`), 9 = `reconcileSchema`. A database from either branch therefore runs 8 and 9 and ends with both halves; a v6 database runs 7, 8, 9; a fresh install runs 1–9.
2. **Detect, do not trust:** `migrate()` runs `reconcileSchema` on every launch of an existing database (after any steps, in its own transaction) and `verifySchema` checks `REQUIRED_COLUMNS` as well as `REQUIRED_TABLES`. Every repair is additive (a NULL column or an empty table); nothing is dropped or rewritten. Backup-before-steps and restore-on-failure are unchanged; a version that overstates the file is repaired without a backup because the repair cannot lose data.
3. **One strength engine:** `domain/analytics/metrics` defaults to `domain/records` (`createRecordsStrengthMetrics`). Boot registers a resolver backed by the exercise library so a live finish (`buildSessionSummary`) and a history replay (`replayHistory`) use the same weight types and produce identical summaries. `lib/workoutMath.detectPersonalRecords` is deleted. A set the engine has no estimate for (0 kg, or more than 12 reps) never becomes a chart point's best set.
4. **ADR numbering:** the Phase 4 ADR becomes 011; 010 stays Phase 3's.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Renumber only (7 = Phase 3, 8 = Phase 4) | Simplest | A Phase 4 v7 database would skip step 7 and never get the column | Fails the owner's "handle databases upgraded by either branch" requirement |
| Re-run both steps at 9 (Phase 4's placeholder test) | No detection code | Phase 3's step is an ALTER; running it twice throws `duplicate column` | Not idempotent |
| Keep the Phase 4 boot repair for its tables | Already written | A second repair path beside the migration; nothing repaired the Phase 3 column | One path, in `migrate()` |
| Keep `lib/workoutMath` as the analytics default | No test churn | Two PR definitions; charts and Records disagree; replays rewrite summaries | Phase 3 is authoritative |

## Consequences
- Positive: one place decides what the schema is; any mixed state converges on launch; records, charts, goals and summaries come from one function.
- Negative: `migrate()` costs two catalog reads per launch (microseconds); the Phase 4 "e1RM" chart shows no point for sets above 12 reps (consistent with Records).
- Risks: a future step that is not idempotent must stay conditional like step 7; the reconcile must stay additive. Covered by `__tests__/db.integration-migrations.test.ts` and `__tests__/integration.metrics.test.ts`.

## Dependencies
ADR-002 (SQLite persistence), ADR-010 (records derived on read), ADR-011 (Phase 4 boundaries).

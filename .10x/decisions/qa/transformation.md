# QA — transformation
## Strategy
- Unit: `domain/` (reducer, math, PR, rotation) table-driven; repositories/migrations on better-sqlite3.
- Snapshot: each screen × theme (M5), Arabic (M6); SetRow/ExerciseCard grid pinned.
- Device scripts (M3+): 100 rapid set completions; 10× force-quit after log; kill mid-migration restore.
- Manual checklists per milestone (spec §6 "owner verifies").
- Release: spec §9 checklist.
## Known defects (pre-transformation)
- Last logged set lost if killed inside 500 ms write window (by design of current storage).
- PRs not recomputed after history delete (stored at finish).
## M0 results (2026-11-01)
41 tests, 4 suites, 2 s. Coverage (stmts/lines): `format.ts` 100/100, `parseNumber.ts` 100/100, `workoutMath.ts` 95.7/98.6, `useWorkoutStore.ts` 95.7/99.3. Gate ≥90% met. Behaviour pinned: prefill, carry-forward, rest-after-last-set suppression, adjust never below zero, min 5 s rest, first-time-no-PR, Epley, Saturday weekly buckets, persist migrate v1→v2 and settings deep-merge.

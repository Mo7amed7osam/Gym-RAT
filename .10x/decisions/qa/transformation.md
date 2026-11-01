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

# SDE — transformation
**[DISCOVERED] Built so far (pre-transformation):** Today dashboard (week strip, hero, stats, warm-up list, exercise list), Active workout (warm-up/workout/cool-down stages, exercise navigator, ExerciseCard with SetRow grid, rest sheet + pill, finish confirm, summary modal), History (weekly volume chart, totals, volume records, sessions with expand/delete), Settings (toggles, warning seconds, delete history), Form guide modal (YouTube via in-app browser), Warm-up routine with hold timer, rest timer with pause/adjust/skip and chime, prefill from history, PR detection (top weight, e1RM), batched AsyncStorage persistence, optional Postgres sync.
**Quality:** tsc/lint/doctor clean; local iOS build succeeded; no tests; never run on device.

## Implementation log
- 2026-11-01: `.10x/` initialized; git baseline commit. No application code changed.

# DBA — transformation
**[DISCOVERED]** No on-device DB. JSON blob under AsyncStorage key `gym-rat/workout-store` (persist v2): `activeSession`, `history[]`, `syncQueue[]`, `restTimer`, `settings`. Obsolete Postgres schema in `server/db/migrations/001_init.sql` (sessions → session_exercises → exercise_sets) — useful as a shape reference only.

## Target schema v1 (M3) and v2 (M4)
v1: `sessions`, `session_exercises`, `sets`, `settings` (kv), `schema_meta`.
v2: `plans`, `plan_days`, `plan_exercises`, `exercises`, `exercise_media`, `exercise_videos`.
Later: `cardio_sessions`, `body_metrics`, `body_photos`, `goals`, `pr_cache`.

## Indexes
`sessions(started_at)`, `sessions(plan_day_id)`, `session_exercises(session_id, order)`, `session_exercises(exercise_id)`, `sets(session_exercise_id, set_number)`, `exercises(slug)`, `exercise_media(exercise_id)`.

## Migration safety
`backupDatabaseAsync` → transaction → `quick_check` + counts → `user_version` bump; failure restores. Importer verifies counts vs parsed blob; original key renamed.

## Pragmas
`journal_mode=WAL`, `synchronous=NORMAL` (D7), `foreign_keys=ON`.

## M3 implemented (2026-11-01)
Schema v1 as planned (`data/db/schema.ts`). `title_json`, `prescription_json`, `summary_json`, `warmup_completed_json` keep today's object shapes verbatim; M4 normalises plans. Whole-session replace per write (delete exercises/sets for the id, reinsert) inside one transaction. Pragmas set at boot outside transactions. Backup file `gymrat.backup.db` via `backupDatabaseAsync` before any migration of a non-empty DB; restored on failure. The backup hook is untestable until schema v2 exists (noted in tests).

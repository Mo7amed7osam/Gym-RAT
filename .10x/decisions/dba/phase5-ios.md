# DBA — phase5-ios
Schema v10: `health_exports(session_id PK, fingerprint, health_uuid, exported_at)`, create-only, no FK (row must outlive its session until Health copy is removed). `reconcileSchema` recreates it when `user_version ≥ 10` but the table is missing. Verified: Jest v9→v10 with data intact; simulator upgrade of the real Phase 4 database `7 → 10` (10 sessions, 6 body entries, 3 goals intact).
File protection: directory + db/wal/shm/backup set to completeUnlessOpen at boot (5 items on the upgraded simulator DB).

# ADR-002: expo-sqlite replaces single-blob AsyncStorage persistence

**Status:** Accepted (Phase 1 started 2026-11-01)
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + Staff Engineer + DBA)

## Context
Today the whole Zustand store is serialized to one AsyncStorage key with a 500 ms coalesced write (`store/batchedStorage.ts:13,46`). A process kill inside that window loses the last logged set. History, body photos, custom exercises, analytics and PR recomputation require relational queries and per-row atomic writes. Spec §7 requires that a logged set is never lost.

## Decision
Use `expo-sqlite` (official, SDK 58; verified sync API `runSync`, `withTransactionSync`, WAL, `backupDatabaseAsync`). Every reducer event = one transaction via a single repository module on the JS thread; UI acknowledges only after commit. `PRAGMA journal_mode=WAL`, `synchronous=NORMAL` (D7). Integrity check on open; backup before every migration with row-count verification and rollback. One-time importer from AsyncStorage key `gym-rat/workout-store` v3, verified by counts, original key renamed (never deleted). Zustand retains runtime state and the public store API so screens are unchanged in M3.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Keep AsyncStorage, write immediately | Minimal change | Whole-blob rewrite per set; grows with history; no queries; no transactions | Does not scale to analytics/body data |
| react-native-mmkv | Fast KV, sync | Still KV; Nitro native dep; no relational queries | Wrong shape for history analytics |
| expo-sqlite + Drizzle ORM | Typed queries | Extra dependency and codegen; migration tooling overlap | Revisit in Phase 2 if raw SQL repositories become unwieldy |

## Consequences
### Positive
- Durable per-set writes; transactional PR recompute; bounded memory; FTS available for library search.
### Negative
- Migration code + importer to maintain; tests need `better-sqlite3` in Jest.
### Risks
- Importer bugs → original blob preserved; backup restore path tested by kill-mid-migration test.
- Sync writes on a very large history → measured in M3; indexes on `sessions.started_at`, `sets.session_exercise_id`, `session_exercises.exercise_id`.

## Dependencies
- ADR-001. Constrains ADR-003 (schema for plans) and all analytics work.

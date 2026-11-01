# ADR-001: Local-only persistence, remove sync server

**Status:** Proposed (accepted on "start Phase 1")
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
The codebase ships an optional Postgres sync path (`lib/sync.ts`, `server/`, `syncQueue` in `store/useWorkoutStore.ts`, Settings "Server sync" row). The owner's spec §21 mandates: no accounts, no cloud sync, no iCloud feature, no in-app backup/export. Keeping dead sync code adds a persist-state field, a root-layout hook, and a server to maintain.

## Decision
Remove all sync code and the server in Phase 1 milestone M1. Persist version bumps 2→3 and drops `syncQueue`. Data lives only in the app sandbox. iOS system backups (Finder/iCloud device backup) are left at OS defaults; this is not an in-app feature (decision D9).

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Keep sync behind env flag | Future-proof | Violates spec; dead code; server to maintain | Owner decision is explicit |
| Keep server, disable client | Preserves work | Same as above | Same |

## Consequences
### Positive
- Smaller store, no network code, no secrets, simpler threat model.
### Negative
- No off-device recovery except OS backup; data lost if device lost and no OS backup.
### Risks
- Persist migration bug on v2→v3 → mitigated by migration test with sample blob.

## Dependencies
- Precedes ADR-002 (SQLite) so the importer never sees `syncQueue`.

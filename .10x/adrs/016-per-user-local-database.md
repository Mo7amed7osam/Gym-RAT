# ADR-016: One SQLite file per account; explicit claim of pre-account data

**Status:** Accepted
**Date:** 2026-11-02
**Feature:** phase7-private-auth
**Author:** 10x-Team (Architect + DBA + Security)

## Context
Until Phase 7 the phone held one database, `gymrat.db`, with no notion of a user. Phase 7 adds accounts; two members may sign in on the same phone, and account A must never see account B's workouts, caches, notifications, Health exports or Live Activity. Existing installs hold valuable history that must survive and must not be silently attributed to whoever logs in first. Logout and session expiry must never delete data.

## Decision
- **One database file per account:** `gymrat.u-<userId>.db` (backup `gymrat.u-<userId>.backup.db`), opened by `data/db/boot.ts` for the signed-in user. The schema, migrations, repositories and the protected logging path are unchanged; isolation is at the file level. Custom exercise photos move to `exercise-media/<userId>/`.
- **Legacy file stays legacy:** `gymrat.db` is never opened as a user's database. At first sign-in on a phone whose `gymrat.db` holds user data (any session, custom exercise, user plan, body entry or goal) the app shows a claim screen: *attach these workouts to this account* (copies the file into the user's file, then renames the legacy file to `gymrat.legacy-claimed.db`) or *not now* (nothing changes; offered again from Settings). The AsyncStorage importer runs only against the legacy file during a claim; per-user files never import.
- **Account switch ordering** mirrors `resetAllData`: detach workout and progress persistence → `setHealthLedger(null)` → hydrate empty state (this ends the Live Activity and cancels the rest alert through the existing subscribers) → close the file → open the next user's file. The Health ledger is nulled *before* the empty hydrate so the Health reconciler never deletes the previous user's workouts from Apple Health.
- **Logout keeps everything.** The only destructive path is Settings → *Remove my data from this phone*, which asks for confirmation and deletes just the current account's files and photo folder. *Reset All Data* keeps its meaning for the current account only.
- **No cloud sync.** Signing in on a second phone starts an empty database; the product copy says so.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| `owner_user_id` column on every table | Single file, cross-user queries possible | Every query in three repositories changes; migration on real data; protected UI path touched | More risk, no benefit without sync |
| Auto-claim legacy data for the first login | No extra screen | Attributes history to possibly the wrong person on a shared phone | Brief forbids silent claiming |
| Delete data on logout | Clean | Destroys history; brief forbids it | — |

## Consequences
### Positive
- Zero schema change; migration tests and snapshots stay valid.
- Backup/restore semantics are unchanged per file.
### Negative
- Two members on one phone use twice the storage (bundled seed is small).
- Reset All Data now means "this account on this phone".
### Risks
- A failed copy during claim: the legacy file is only renamed after the copy is verified (row counts match), so the worst case is a retry.

## Dependencies
- ADR-002 (SQLite persistence), ADR-013 (integrations), ADR-015.

# Phase 4 security review — Progress & Analytics

**Date:** 2026-11-02 · **Scope:** everything on `feature/phase4-analytics` since `6319c60`.

## Threat model
Offline, single-user iOS app (ADR-001): no accounts, no network, no server. Assets: workout history, body measurements (health-adjacent personal data), goals. Actors: the device owner; other apps on the device (via URL scheme); someone holding the unlocked phone.

## Findings
| Area | Assessment | Status |
|---|---|---|
| SQL injection | Every Phase 4 query uses positional `?` bindings (`progressRepository.ts`); DDL is static. No string-built SQL from input. | OK |
| Input validation | Weights 0–1000 kg, reps integer 0–1000, session ≤ 24 h, not in the future, end > start (`domain/history/edit.ts`); body values bounded per unit; goal targets bounded per kind; DB `CHECK (value > 0)` on body/goal values. Arabic-Indic digits normalised before parsing. | OK |
| Data integrity | History edits/deletes and body/goal writes are single transactions; a failed write leaves state and DB unchanged (tested). Replay cannot touch the in-progress session (tested). | OK |
| Deep links | `com.gymrat.app://analytics/...` lets any app or web page open Progress screens. Effects are read-only navigation; unknown ids show "not found"; no mutation without on-screen taps and confirmation dialogs for deletes. Routes sit inside the onboarding `Stack.Protected` guard. | OK (accepted) |
| Destructive actions | Delete workout, delete body entry, delete goal all use confirmation dialogs; Reset All Data clears the Phase 4 store and tables (file deletion). | OK |
| Data at rest | SQLite in the app sandbox with default iOS data protection; included in the OS backup (decision D9). Body measurements are now part of that file. | Owner decision: consider `NSFileProtectionComplete` for the database and excluding it from iCloud backup before TestFlight |
| Logging | New logs print table names only (`ensureProgressSchema`); no measurements or history in logs. | OK |
| Dependencies | No new runtime dependency. AXe (dev-only CLI on this Mac) used for simulator testing; not in the project. | OK |
| Migration safety | Create-only DDL; boot backs up before migrating and restores on failure; repair step never drops or rewrites rows. | OK |

## Residual risk
Low. The only data-sensitivity change is storing body measurements; protection-class and backup choices are tracked for the owner.

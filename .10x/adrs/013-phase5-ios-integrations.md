# ADR-013: Phase 5 iOS integrations as store-following side effects

**Status:** Accepted (implemented on `feature/phase5-ios`)
**Date:** 2026-11-02
**Feature:** phase5-ios
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
Phase 5 adds Apple Health, a Live Activity, rest notifications, keep-awake and in-app YouTube to an offline, local-only app (ADR-001) whose workout store writes through to SQLite in one transaction per change (ADR-002). None of the native systems can join that transaction, and none may block or fail a workout. HealthKit wrapper libraries were unverified on RN 0.88 (risk #12).

## Decision
1. **One pattern for every side effect:** a pure planner over store state, an injectable adapter, and a controller subscribed to `useWorkoutStore` (`services/restAlerts.ts`, `services/workoutActivity.ts`, `services/healthExport.ts`, wired in `services/integrations.ts`). Native calls are serialised per controller and every failure degrades to "no effect".
2. **Health is a reconciler, not a write hook:** a ledger table `health_exports` (schema v10, create-only) records what was written; after any history change the ledger is diffed against history. New/edited sessions are (re)written, deleted ones removed. Native save deletes by `HKMetadataKeyExternalUUID = session id` before saving, so retries never duplicate.
3. **Local Expo module `modules/gym-native`** (Swift, ~150 lines) instead of `@kingstinct/react-native-healthkit`: write-only workout access, plus a file-protection helper. No Nitro, no read permissions.
4. **Live Activity via `expo-widgets`** with SwiftUI timer texts: updates only on state change; adopt-or-end leftovers at launch.
5. **Local notifications only:** `expo-notifications` with `enableRemoteNotifications: false`; one request id, cancel-then-schedule.
6. **Data protection:** `NSFileProtectionCompleteUnlessOpen` via the `default-data-protection` entitlement, plus a boot step that upgrades existing database files. iCloud/device backup is left unchanged pending owner decision.
7. **YouTube:** `react-native-youtube-iframe` with a locally generated page whose origin is `https://com.gymrat.app`; ids only from `scripts/media/check-youtube.mjs` (oEmbed-verified + reviewed).

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| `@kingstinct/react-native-healthkit` | Full HealthKit surface | Adds Nitro modules; RN 0.88 support unstated; far larger permission surface | Risk without benefit for write-only export |
| Write to Health inside `finishWorkout` | Simple | Edits/deletes/imports/failed writes drift; cannot be transactional | Reconciler covers every path |
| `NSFileProtectionComplete` | Strongest at rest | WAL checkpoint on backgrounding and any locked-phone write would fail | Unless-open protects closed files and keeps the open DB usable |
| Push-driven Live Activity | Updates while app is suspended | Needs a server and APNs; violates local-only | SwiftUI timers tick without updates |
| Library's default GitHub-Pages player page | No config | Third-party host sees every play; origin not the app | Local HTML + app origin |

## Consequences
**Positive:** every integration is testable with fakes; the real store lifecycle is covered in Jest; the app works identically with all permissions denied.
**Negative:** the Live Activity renders in the system locale's direction, not the app's language override; HealthKit writes only start/end/pauses (no energy).
**Risks:** Live Activity and keep-awake/Low Power behaviour unverified on hardware; YouTube embed policy can change (fallback card handles it).

## Dependencies
Schema v10 (append-only migrations, reconcile repairs `health_exports`). Phase 6 must verify on a physical iPhone and register the App ID capabilities (HealthKit, App Groups `group.com.gymrat.app`, extension `com.gymrat.app.ExpoWidgetsTarget`).

# Phase 3 + Phase 4 integration report

**Date:** 2026-11-02 · **Branch:** `integration/phase3-phase4` (from `main` @ `54240f2`, Phase 3 code HEAD `cd19cc9`) · **Merged in:** `feature/phase4-analytics` @ `74a75f3` · **Both feature branches and the Phase 4 worktree `../Gym RAT-phase4` are untouched.**

**Gates on the integration HEAD:** Jest 255 tests / 30 suites, 4 protected Sets-grid snapshots byte-identical, `tsc --noEmit` 0 errors, `expo lint` exit 0, Release simulator build `** BUILD SUCCEEDED **` (`ios/build/Build/Products/Release-iphonesimulator/GymRAT.app`). Physical iPhone: not tested.

## 1. Commits on the integration branch
| Commit | What |
|---|---|
| `710f82f` | Merge of Phase 4. One textual conflict (`data/db/schema.ts`): Phase 3 keeps `SCHEMA_V7`, Phase 4's tables become `SCHEMA_V8`, `REQUIRED_TABLES` is the union. No Phase 3 file was replaced by an older version; nothing from Phase 4 was dropped. |
| `f532fa5` | Canonical migration sequence + schema reconciliation (ADR-012). |
| `f15c43a` | One strength engine: Phase 3 `domain/records` behind Phase 4's `registerStrengthMetrics`; Phase 4 ADR renumbered to 011. |
| `c1b8c63` | Integration tests + captured simulator database fixture. |
| `9ba22b2`, `19a4be0` | ADR-012, decision logs, status, handoff. |

## 2. SQLite schema integration
Both branches had defined step 7: Phase 3 `ALTER TABLE session_exercises ADD COLUMN recommendation_json`, Phase 4 `CREATE TABLE body_metrics / goals`.

**Canonical sequence (`data/db/migrations.ts`, `SCHEMA_VERSION = 9`):**
- 7 — Phase 3 column, applied only if `pragma_table_info` shows it missing.
- 8 — Phase 4 tables (`CREATE TABLE IF NOT EXISTS`).
- 9 — `reconcileSchema()`: adds whichever of the two halves the file lacks.
- `migrate()` additionally runs `reconcileSchema()` on every launch of an existing database and `verifySchema()` now checks `REQUIRED_COLUMNS` (`sets.set_kind`, `session_exercises.group_id`, `session_exercises.recommendation_json`) as well as tables. Repairs are additive only (NULL column, empty table). Backup before steps / restore on failure unchanged. The Phase 4 boot-time table repair (`progressSchema.ts`) is removed; one path remains.

**Tests (`__tests__/db.integration-migrations.test.ts`, 11; `__tests__/integration.metrics.test.ts` "real simulator database", 1):**
| # | Scenario | Result |
|---|---|---|
| 1 | Fresh install | steps 1–9, no backup, relaunch ×3 applies nothing |
| 2 | Phase 2 v6 → combined | applied [7, 8, 9], backup(6), history + summaries + set rows identical, decisions NULL, progress empty |
| 3 | Phase 3 v7 → combined | applied [8, 9], backup(7), accepted decision preserved, column not added twice |
| 4 | Phase 4 v7 → combined | applied [8, 9], column added by step 9, body entry + goal preserved |
| 5 | Repeated launches | three launches after upgrade: applied [], no backup, rows byte-identical |
| 6 | Failure and recovery | step 9 replaced by a throwing step: version stays 8, `half` table absent, FK pragma back on, all rows intact; the fixed build then applies [9] |
| 6b | Overstated version | v9 claimed with only one half present → repaired on launch (`onRepair` lists `body_metrics, goals` or `session_exercises.recommendation_json`) |
| 7 | Populated databases | 12 sessions × 2 exercises with records over 11 weeks, a warm-up and a 15-rep set, a stored decision, a body entry and a goal; every record in every summary still points at a stored set |
| real | Captured simulator file `test/fixtures/sim-phase3-v7.db` (Phase 3 build, 3 sessions, 54 sets, 1 accepted decision) | applied [8, 9], backup(7), counts and decision identical, active session reloads with its recommendation |

**On the simulator itself:** the Phase 3 build's database (`user_version 7`, no Phase 4 tables) was backed up (`scratchpad/fixtures/sim-before-install.db`), the integrated Release build was installed over it with `simctl install` (container preserved) and launched. Result read from the file: `user_version 9`, tables `body_metrics`, `goals` present, `recommendation_json` present, 3 sessions / 54 sets / 1 decision unchanged, `gymrat.backup.db` written (180 KB). Screenshots: `integration-screenshots/today-after-upgrade.png`; after a simulator reboot + relaunch the data was still intact (`today-after-sim-reboot.png`).

## 3. Strength metrics
- `domain/analytics/metrics.ts` now defaults to `domain/records` through `domain/records/strengthMetrics.ts` (`estimateOneRepMax = estimateOneRepMaxOrNull ?? 0`, `detectPersonalRecords = detectSessionRecords`). `lib/workoutMath.detectPersonalRecords` is deleted (no callers). Boot registers a resolver backed by the exercise library, so the live finish (`buildSessionSummary`) and Phase 4's `replayHistory` use the same weight types.
- Exercise chart: a set the engine has no estimate for (0 kg, or > 12 reps) never becomes the point's best set; `bestE1rmKg` stays 0 for that session, matching Records (which show no e1RM for it).
- Tests (`__tests__/integration.metrics.test.ts`, 8): live finish then `replayHistory` returns the same session objects (no rewrite); Records, chart maxima, `trainedExercises` and an e1RM goal agree; the 12-rep cap reaches chart and goal; bodyweight/assisted rule reaches a replay through the resolver; editing an earlier session moves the top-weight record to the later session and leaves untouched sessions as the same objects; deleting a session leaves no record pointing at its sets; a failing write rolls the edit back and keeps records unchanged.
- Not changed: the "Best" tile on the card and in exercise detail still uses Phase 1 `getExerciseBests` (uncapped Epley, display only). Noted, not a data concern.

## 4. UI
- Phase 3 kept: coach card, recommendation chip, PR toast, Records in exercise detail, Suggested substitutes, Settings → Smart training.
- Phase 4 kept: Progress tab (`app/(tabs)/progress.tsx` → `ProgressScreen`), `analytics/history`, `analytics/session/[id]`, `analytics/calendar`, `analytics/exercises`, `analytics/exercise/[id]`, `analytics/body`, `analytics/goals` registered in `app/_layout.tsx`; progress store hydrated and persisted at boot; `progress.*` dictionaries merged into EN/AR (parity test green).
- The PDF-derived program remains an ordinary template (`kind: 'template'`); no PDF is bundled.
- `screens/HistoryScreen.tsx` is no longer routed (Progress tab points at `ProgressScreen`); kept for now, flagged as dead code.

## 5. Simulator scenarios
| # | Scenario | Status |
|---|---|---|
| 8 | Force-quit and relaunch with all data intact | **Done**: terminate + launch, and a full simulator reboot; `user_version 9`, 3 sessions / 54 sets / decision intact; Today shows "Resume workout" 11 % |
| 9 | Arabic RTL and Western digits | **Done (Today)**: `today-ar-dark.png`, `today-ar-light.png` — mirrored layout, "9,600 kg", "50 min", Western day numbers |
| 10 | Dark, light, True Black | **Done (Today)**: `today-en-light.png`, `today-en-trueblack.png`, dark in every other capture |
| 1–7 | Log a PR; PR in detail and chart; edit history → recalculation; delete → derived records; accept Smart Target and finish; calendar/analytics/goals; body measurements | **Not performed on the simulator.** From 01:35 the Device Hub window was covered by the owner's WhatsApp window and from 01:41 by VS Code (the pointer moved at 01:41); the tap driver refuses to click when Device Hub is not the top-most window at the target, so no synthetic input was sent in this run. Each flow is covered by Jest (`integration.metrics`, `history.edit`, `progress.screens`, `recommendations.store`, `phase3.ui`). |

Also: deep-link driving (`simctl openurl gymrat://…`) was tried as a mouse-free way to open Progress screens; iOS shows an "Open in Gym RAT?" prompt that needs a tap, so it stacked eight prompts. Cleared by rebooting the simulator (data intact). Not usable for Release builds.

Scenarios 9 and 10 were driven by editing `kv.settings` in the database between launches (language, appearance mode) and restoring `system/system` afterwards.

## 6. Outstanding technical debt (carried, none dropped)
| Item | Impact | Status |
|---|---|---|
| RPE / RIR entry UI | rule 5a unreachable from UI | Phase 3 debt |
| Giant-set multi-select, drag reorder | usability | Phase 2 debt |
| Arabic copy review (Phase 2–4 strings machine-authored) | release readiness | owner review |
| Neila Rey stretch posters (`assets/exercises`) rights | **legal** — must be resolved or removed before TestFlight | open |
| Missing exact illustrations (10 of 38 exercises show the labelled fallback) | release readiness | open |
| Physical iPhone testing | Developer Mode off on the phone | open |
| EAS CLI logged in as another person | must not be used for any EAS step | open |
| `screens/HistoryScreen.tsx` unrouted | dead code | new, cosmetic |
| "Best" tile uses uncapped Epley | display only | new, cosmetic |

No item threatens data integrity. The poster rights item is the only legal blocker for release.

## 7. Merge decision
**Not merged into `main`.** The brief makes the ten simulator scenarios a gate ("fix regressions before proceeding"); seven were not performed because the Mac was in use. The narrower conditions all hold: the integration is clean, every automated gate passes, the real database upgraded in place, and no data-loss risk is open. Tags `phase3-complete` (`54240f2`) and `phase4-complete` (`74a75f3`) mark both originals. To merge once the owner is satisfied (or after running scenarios 1–7):

```
git checkout main && git merge --no-ff integration/phase3-phase4
```

**Simulator container note:** the app container on the iPhone 18 Pro simulator is now at schema v9. The Phase 3 build (`cd19cc9`) cannot open it any more (its `verifySchema` rejects version 9), so do not reinstall that build over this container. Pre-upgrade copies: `test/fixtures/sim-phase3-v7.db` (committed) and `gymrat.backup.db` inside the container.

**Driver guard for the next run:** add `ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1e9}'` (seconds since the last keyboard or mouse event) next to the top-most-window check before any tap.

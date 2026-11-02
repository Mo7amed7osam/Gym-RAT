# Phase 3 + Phase 4 integration report

**Date:** 2026-11-02 · **Branch:** `integration/phase3-phase4` (from `main` @ `54240f2`, Phase 3 code HEAD `cd19cc9`) · **Merged in:** `feature/phase4-analytics` @ `74a75f3`, then its later commits up to `ed268bb` (QA fixes, goal editing, handoff) · **Both feature branches and the Phase 4 worktree `../Gym RAT-phase4` are untouched** (tags `phase3-complete` = `54240f2`, `phase4-complete` = `74a75f3`).

**Gates on the integration HEAD:** Jest 265 tests / 30 suites, 4 protected Sets-grid snapshots byte-identical, `tsc --noEmit` 0 errors, `expo lint` exit 0, `scripts/test-timezones.sh` 65 × 6 zones green, Release simulator build `** BUILD SUCCEEDED **` three times (last one installed on the simulator). Physical iPhone: not tested.

## 1. Commits on the integration branch
| Commit | What |
|---|---|
| `710f82f` | Merge of Phase 4. One textual conflict (`data/db/schema.ts`): Phase 3 keeps `SCHEMA_V7`, Phase 4's tables become `SCHEMA_V8`, `REQUIRED_TABLES` is the union. No Phase 3 file was replaced by an older version; nothing from Phase 4 was dropped. |
| `f532fa5` | Canonical migration sequence + schema reconciliation (ADR-012). |
| `f15c43a` | One strength engine: Phase 3 `domain/records` behind Phase 4's `registerStrengthMetrics`; Phase 4 ADR renumbered to 011. |
| `c1b8c63` | Integration tests + captured simulator database fixture. |
| `9ba22b2`, `19a4be0`, `bc612d6`, `cd15b17` | ADR-012, decision logs, status, handoff, report, tags. |
| `52255ea` | Second merge of `feature/phase4-analytics` (`fb458b2`, `474157e`, `ed268bb`: QA fixes from the Phase 4 simulator pass, goal target editing and bounds, Unicode isolates for Latin runs in Arabic, the Phase 4 → Phase 3 handoff document). One conflict in `.10x/status.md`, kept both. |
| `45e412f` | Handoff §2 closed: `buildSessionSummary` asks the registered engine and `summarize` delegates to it (one summary builder); the store's `deleteSession` / `clearHistory` (deletes that skipped PR recomputation) and the unrouted Phase 1 History screen removed; deletes go through `historyActions`. |
| `a944b29` | `formatKg` keeps half-kilo loads (a 102.5 kg record showed as "103 kg" in the Phase 4 PR list and chart tiles while Records showed 102.5 kg). |

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
- `screens/HistoryScreen.tsx` (unrouted since the Progress tab points at `ProgressScreen`) and the store's non-recomputing deletes are removed (`45e412f`).

## 5. Simulator scenarios (iPhone 18 Pro simulator, Release build, upgraded container)
Driven with AXe 1.8.0 (`axe tap / type / swipe / describe-ui --udid …`): simulator-scoped HID input and accessibility reads, no desktop mouse, no window focus needed. Every step was checked against the accessibility tree and, where data changes, the SQLite file. Screenshots in `integration-screenshots/`.

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Log a workout and create a new PR | Resumed the fixture session (leg press 102.5 × 8 accepted from the Smart Target), logged set 3 → toast "New PR · Top weight 102.5 kg"; Finish → review → "Finish and advance" → summary "New PRs 1 · Leg Press 102.5 kg · Top weight · was 100 kg"; DB `summary_json.personalRecords = [top_weight 102.5 prev 100]`, rotation moved to day 2 | `s1-pr-toast-set3.png`, `s5-review-before-finish.png`, `s1-summary-pr-list.png` |
| 2 | PR in exercise detail and Progress charts | Library → Leg Press → Records: Heaviest set 102.5 kg · 2 Nov, Est. 1RM 140 kg · 24 Oct, Best set volume 1200 kg, Most reps 8 × 102.5 / 12 × 100, PR history line. Progress → Exercise progress → Leg Press: e1RM best 140 / latest 130 (102.5 × 8 → 129.8), Top weight best 102.5 (+2.5) — same numbers as Records | `s2-exercise-detail-records.png`, `s2-chart-e1rm.png`, `s2-chart-topweight.png` |
| 3 | Edit the historical workout → PR / chart recalculation | Session detail → Edit → set 1 102.5 → 120 → Save changes: detail shows Top weight 120 (was 100) and Estimated 1RM 152 (was 140); DB `summary_json` recomputed (volume 2,600, two records); chart "best e1RM 152 kg" | `s3-session-detail.png`, `s3-edit-mode.png`, `s3-after-edit-prs.png` |
| 4 | Delete a historical workout → derived records | Deleted "Full Body A, Sat 24 Oct" through the confirmation dialog; 2 sessions remain; the 28 Oct session (now first exposure) has `personalRecords: []`, the 2 Nov session keeps its records against 28 Oct (previous 100 / 140); Progress lists "Leg Press, 2 sessions" | `s4-delete-dialog.png`, `s4-after-delete.png` |
| 5 | Accept a Smart Target and complete the workout | The fixture session had the recommendation accepted (`recommendation_json.decision = accepted`); set 3 was logged with the prefilled 102.5 × 8 and the workout finished (see 1) | as 1 |
| 6 | New workout in calendar, analytics, goals | Progress: Workouts 1 / Volume 2,460 → 2,600 kg after the edit, weekly volume bar "Week of 31 Oct", Frequency "1 workout", calendar November with the 2 Nov day, Recent workouts row; Goals → New goal → Lift weight → Leg Press ("Now: 120 kg") → target 130, 8 weeks → "Leg Press: lift 130 kg · 120 kg of 130 kg · 10 kg to go · by 28 Dec 2026"; DB `goals` row (`exercise_weight`, baseline 120, target 130) | `s6-progress-dashboard.png`, `s6-calendar.png`, `s6-goal-form.png`, `s6-goal-created.png` |
| 7 | Body measurements persist | Body → 80 kg (first attempt; the ".5" typed by the driver was dropped by its key timing, not by the app) and 81.2 kg saved; tiles "Latest 81.2 kg · 30 days +1.2 kg · Entries 2"; DB `body_metrics` rows 80.0 and 81.2 | `s7-body-entries.png` |
| 8 | Force-quit and relaunch with all data intact | Terminate → reinstall of the final build over the same container → launch: `user_version 9`, 2 sessions / 36 sets / 1 goal / 2 body entries unchanged; Today and Progress render the same numbers. Earlier in the run: a full simulator reboot with the same result | `s8-relaunch-today.png`, `s8-relaunch-progress.png`, `today-after-upgrade.png`, `today-after-sim-reboot.png` |
| 9 | Arabic RTL and Western digits | Today, Progress and the session detail in Arabic: mirrored layout, "2,600 kg", "120 kg (كان 100 kg)" with the Latin runs isolated, Western day numbers | `today-ar-dark.png`, `today-ar-light.png`, `s9-ar-progress.png`, `s9-ar-session-detail.png` |
| 10 | Dark, light, True Black | Today and Progress in all three | `today-en-light.png`, `today-en-trueblack.png`, `s10-light-progress.png`, `s10-trueblack-progress.png`, dark in every other capture |

Language and theme were switched by editing `kv.settings` in the database between launches and restored to `system / system` afterwards.

**Regression found and fixed during the run:** `formatKg` rounded loads to whole kilograms, so the Phase 4 PR list and chart tiles showed "103 kg" for a 102.5 kg record while Records showed "102.5 kg" (`a944b29`, test added).

**Earlier in the run (before AXe):** deep-link driving (`simctl openurl gymrat://…`) stacked eight "Open in Gym RAT?" prompts; cleared by rebooting the simulator with the data intact. Synthetic desktop mouse input was not used at all in this run.

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
| "Best" tile uses uncapped Epley | display only | new, cosmetic |
| Database file protection class / iCloud backup exclusion for body measurements (Phase 4 security review) | privacy, owner decision before TestFlight | open |

No item threatens data integrity. The poster rights item is the only legal blocker for release.

## 7. Merge decision
All required gates pass on the integration branch: typecheck, lint, the full Jest suite, the protected snapshots, the migration tests, the Release simulator build, and the ten simulator scenarios. No data-loss risk is open: every upgrade path is tested, the real simulator database upgraded in place with its backup written, and every history change replays records in one transaction. The branch is merged into `main` with `--no-ff`; `feature/phase4-analytics`, `main`'s pre-merge state (`phase3-complete`) and the Phase 4 worktree are preserved.

**Simulator container note:** the app container on the iPhone 18 Pro simulator is at schema v9. The Phase 3 build (`cd19cc9`) cannot open it (its `verifySchema` rejects version 9); do not reinstall that build over this container. Pre-upgrade copies: `test/fixtures/sim-phase3-v7.db` (committed) and `gymrat.backup.db` inside the container.

**Driver for the next run:** AXe (`/opt/homebrew/bin/axe`, installed by the Phase 4 track) replaces the desktop-mouse driver; helpers `ui` / `ax` in the session scratchpad wrap `describe-ui`, `tap`, `type`, `swipe`. Frames it reports are already mirrored in RTL.

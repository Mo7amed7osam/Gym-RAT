# Phase 2 — Workout Engine & Exercise Library: completion report

**Date:** 2026-11-01 · **Baseline:** `e2466f7` (Phase 1 + owner clarifications) · **HEAD:** see "Commits" · **Gates on HEAD:** 135 Jest tests in 16 suites / 4 protected snapshots, `tsc --noEmit` clean, `expo lint` clean.
**Physical iPhone:** not tested (owner chose the simulator; Developer Mode still off on the phone). Everything below marked "simulator" was performed on the iPhone 18 Pro simulator (iOS 27.0) with the Release build.

## 1. Implementation checklist

| Workstream | Status | Notes |
|---|---|---|
| P2.1 Exercise data & library | Done | `exercises` table (schema v4), built-in seed refresh, custom exercises (create / edit / archive, never delete), search + scope/equipment/muscle filters, detail screen (illustration, muscles, instructions, breathing, range of motion, mistakes, alternatives, notes, rest preference, history, video placeholder), editor with photo. History keeps resolving archived ids (test + simulator). |
| P2.2 Static media | Done | RepDB free tier investigated (licence, attribution, no premium samples). Exact-match mapping reviewed against the artwork: **28 / 38**. Import script, manifest (sha256, dimensions, licence), generated require index, labelled fallback card for the 10 unmatched, attribution in Settings → About. Images bundled (offline by construction). PDF-derived photos removed. |
| P2.3 Plan builder | Done | Create, rename, duplicate (bundled templates too), edit, archive, activate; add/remove/reorder days (stable ids); add/remove/reorder/substitute exercises; sets, reps, rest per exercise. Exactly one active plan; rotation pointer follows reorders; history untouched by edits and switches. |
| P2.4 Session engine | Done | Pause/resume + active time (Phase 1), reorder, do later / return, add / remove / substitute exercise during a session, session-only target edits with explicit save-to-plan, undo toast, session notes, end-time correction, review step before finishing, resume after force-quit, inactivity prompt (Finish and review / Keep open; dismissing keeps the session running), save-failure banner. |
| P2.5 Sets, rest, warm-up | Done | Normal / warm-up sets unchanged; drop, rest-pause, AMRAP kinds; RPE / RIR columns (store + schema, no entry UI yet); superset / giant-set grouping; rest derived from set kind, warm-up rest setting, group position and per-exercise override; ramp-up warm-up set suggestion; atomic SQLite writes; save-failure feedback; rest timer behaviour kept; protected sets grid unchanged for normal sets. |
| P2.6 Templates | Done | Starter remains the default; PPL/UL program is an ordinary bundled template (ADR-006); no PDF bundled; no personal data in templates; "Start a workout" from a template picks a day and creates a `template` session that never moves the rotation; history badges template / extra sessions; Starter still labelled "(draft)". |
| P2.7 YouTube preparation | Done (minimal) | `Exercise.videoId` nullable column; detail screen shows the video section as pending; no external YouTube redirect anywhere (old `VideoModal` deleted). No curated ids shipped because embeddability could not be verified offline. |

## 2. Commits (after `e2466f7`)

| Commit | Scope |
|---|---|
| `778ff61` | feat(library): runtime exercise library, custom exercises, RepDB illustrations (P2.1, P2.2) |
| `b6a4264` | feat(plan): plan builder, activation, duplication, archiving, template sessions (P2.3, P2.6) |
| `9e92a3d` | feat(session): engine additions, advanced sets, rest rules, review step (P2.4, P2.5, P2.7) |
| `8bf599e` | state: ADR-008, ADR-009, Phase 2 status |
| `87379ee` | fix(store): persist the exercises slice (found on simulator) |
| `ebbefad` | fix(picker): exercise picker re-render loop (found on simulator) |
| `ceb7500` | test: picker regression |
| `2e32843` | fix(picker): reset search on open (found on simulator) |
| `25140f9` | state: Phase 2 report, screenshots |
| (this commit) | fix(session): substitution keeps the plan slot so save-to-plan replaces instead of appending; report corrections |

173 files changed, +6 634 / −1 072 before this report.

## 3. Screenshots (simulator, Release build)

`.10x/reviews/phase2-screenshots/`: `library.png`, `exercise-detail-repdb.png` (start/end toggle, attribution), `custom-exercise-detail.png`, `library-archived-filter.png`, `plan-editor-duplicate.png`, `plan-day-editor.png`, `today-custom-plan.png`, `active-workout-card.png`, `exercise-options-sheet.png`, `rest-timer.png`, `undo-toast.png`, `review-before-finish.png`, `summary.png`, `rtl-library.png`, `rtl-plan.png`, `light-library.png`, `light-plan.png`, `settings-about-attribution.png`.

## 4. Illustration coverage

`assets/exercise-media/COVERAGE.md` (generated): **28 of 38 built-in exercises (74 %)** have exact RepDB start/end stills, 512×512 WebP, 56 files, 1.1 MB, each with sha256, dimensions and licence in `manifest.json`. Source: RepDB free tier at commit `66c4298a…` (2026-10-29). Images copied unmodified; no upscaling, background removal or generative derivation.

## 5. Unmatched media (fallback card)

| Exercise | Nearest RepDB | Rejected because |
|---|---|---|
| high_low_cable_fly | cable-fly | mid-height fly, program is high-to-low |
| triceps_rope_pushdown | tricep-pushdown | bar attachment, not rope |
| lying_leg_raise | lying-leg-raise | floor-based, program uses a bench |
| hammer_strength_lat_pulldown | lat-pulldown | plate-loaded machine vs cable |
| hammer_strength_incline_press | chest-press-machine | incline machine not in RepDB |
| leaning_lateral_raise | lateral-raise | leaning single-arm variant missing |
| barbell_skull_crusher | skull-crusher | EZ bar vs straight bar |
| overhead_cable_curl | cable-curl | one-arm overhead curl missing |
| straight_barbell_curl | barbell-curl | wide grip vs shoulder width |
| leg_press_calf_raise | machine-calf-raise | calf press on the sled missing |

Custom exercises use the user's own photo or the same fallback. Also still bundled: the warm-up poster `assets/exercises/stretches/pre_workout_stretches.jpg` ("© Neila Rey", third-party; owner decision pending).

## 6. SQLite migrations and persistence

- Schema v4 (`exercises`), v5 (`plans.archived`), v6 (`sets.set_kind/rpe/rir`, `session_exercises.group_id/group_kind`), all `CREATE`/`ALTER` only; `sets.type` CHECK untouched. Legacy AsyncStorage blob version 6 adds the new defaults.
- Jest: migrations v3→4, v4→5, v5→6 with real rows; repository round-trips for exercises, plans (archived), sets (kind, RPE/RIR), groups; boot-level write-through test (custom exercise, archive, plan day → read back from the file); Reset All Data test.
- Simulator: fresh install at v6; an existing v3 database migrated to v6 (`quick_check ok`, backup left at the previous version); every UI action verified by reading the database file (custom exercise row, archive flag, plan prescriptions, session order after reorder / defer / substitute, completed set after undo and force-quit, finished session with notes and end-time override, plan switch with history count unchanged, reset → new file with 38 built-ins, 3 plans, 0 sessions).

## 7. Jest, lint, TypeScript

- Jest: 135 passed (16 suites), 4 snapshots passed. New suites: `exercises.library`, `plan.editor`, `session.engine`; extended: `db.boot`, `db.migrations`, `screens.hardening`, `i18n`.
- `npx tsc --noEmit`: clean. `npx expo lint`: clean.
- Protected sets grid: the `SetRow` snapshots are byte-identical; the `ExerciseCard` snapshot changed only in the header (illustration row, options button).

## 8. Simulator results (critical scenarios)

| Scenario | Result | Evidence |
|---|---|---|
| Create a plan and activate it | pass | "Upper Lower" with day "Upper" (bench 4 × 8–12 @ 120 s, row 3 × 8–12 @ 90 s); `plans` shows it `active`, Starter copy demoted to `template` |
| Duplicate a built-in template | pass | PPL copy: `locked=0`, `source_plan_id=pdf_ppl_ul_v5`, 5 days, editor opens on it |
| Edit an active plan without corrupting history | pass | rest/sets edits persisted to `plan_exercises`; sessions untouched |
| Switch plans and preserve history | pass | switched back to the Starter copy: 1 completed session still present, Upper Lower kept as template |
| Start a workout and reorder exercises | pass | "Move later" → `session_exercises` positions swapped, pointer followed |
| Defer and restore an exercise | pass | "Do later" → row moved to the end, `deferred_ids_json` set; navigated back, logged 40 × 12 on it |
| Substitute an exercise | pass | lateral raise replaced bench in the session; plan day unchanged |
| Log, edit, undo sets | pass | 12 × 15 logged (`completed=1`), Undo toast → `completed=0`, values kept |
| Force-quit and resume | pass | `simctl terminate` after undo; relaunch → Resume → same state in DB and UI |
| Complete a workout and advance rotation | pass | review step → notes "Good session", end time −5 min → `ended_at_override`, `durationSeconds=788` from the override; 1-day plan pointer stays 0 (advance/repeat on multi-day plans covered in Phase 1 simulator run + Jest) |
| Repeat a workout without advancing | pass (Phase 1 simulator run + Jest) | repeat path unchanged |
| Create and archive a custom exercise | pass | row persisted (after fix `87379ee`), archived=1, visible only under the Archived filter |
| View exercise images offline | pass by construction | stills are bundled `require()` assets; no network path exists in the app |
| Reset All Data and verify fresh initialization | pass | new `gymrat.db` inode, 38 built-ins, 0 custom, 3 plans, 0 sessions, onboarding shown |
| Arabic RTL | pass | Today, Library, Plan mirrored with Arabic strings (new strings machine-authored, owner review pending) |
| Light theme | pass | Library, Plan, Settings |

Not exercised on the simulator: supersets, drop / rest-pause / AMRAP set kinds, warm-up set suggestion, inactivity prompt (20-minute wait), save-failure banner, custom photo picking (camera/photos permission flow), the picker search reset after `2e32843` (no test; final build smoke-tested on Library search only), save-to-plan after a substitution (Jest only, fixed in the last commit).

## 9. Physical-device tests

Still pending. Nothing in this report was run on a physical iPhone. The device-signed `Release-iphoneos` build on disk is Phase 1 code and predates `expo-image-picker`; a Phase 2 device build needs `npx expo prebuild --platform ios` and a rebuild once Developer Mode is enabled (stale checkouts need the prebuild for the new native module too).

## 10. Known defects and Phase 3 dependencies

Defects found and fixed during verification: exercises slice not persisted (`87379ee`), exercise picker render loop crashing any screen that mounted it (`ebbefad`), stale picker search (`2e32843`), save-to-plan after a substitution appended the new exercise instead of replacing the slot (found in review, fixed with a Jest case, not simulator-verified).

Open / tech debt:
- RPE / RIR: stored (schema, store, tests) but no entry UI.
- Superset grouping is "with the next exercise" only; no multi-select UI for giant sets.
- Reorder in the plan builder uses up/down buttons, no drag.
- Custom exercises and plans are English-only (Arabic copies English).
- Arabic strings for every new screen are machine-authored (D8 review pending); Arabic date line still uses Arabic-Indic digits.
- `README.md` still describes the Phase 1 app.
- Warm-up poster rights (© Neila Rey) need an owner decision.
- Simulator driving: the first run typed stray characters because reading the iOS accessibility tree via System Events presses elements in DeviceHub; the driver now reads only the window frame and every tap is bounds-guarded, but one unexplained tap sequence still reordered the Starter copy's days (Full Body B first). That is user-visible state on the simulator only.

Phase 3 depends on: `Exercise.weightType` and `isUnilateral` (PR conventions), `SessionExercise.groupId`, `ExerciseSet.kind/rpe/rir` (coach logic), `alternatives` (substitution suggestions), `userRestSeconds` (rest suggestions), and the review step (summary comparisons). **Phase 3 is not started.**

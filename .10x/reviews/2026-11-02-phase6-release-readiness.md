# Phase 6 release-readiness report

**Date:** 2026-11-02 · **Branch:** `release/phase6` (worktree `../Gym RAT-phase6`), base `main @ a51141c` · **ADR:** 014 · Not merged, not pushed, nothing sent to EAS.

## Recommendation: **NO-GO for TestFlight**
The build is in good shape on the simulator. It is not release-ready because these gates are still open:
- It has never run on a physical iPhone.
- The owner has not yet completed the account and App ID setup.
- The poster exclusion has not been checked on a real EAS artifact.
- Several high-severity owner decisions are pending (see Open defects).

Phase 6 has not declared Gym RAT production-ready.

## Baseline (verified first)
- `main` was at `a51141c`, and the tree was clean.
- The handoff `specs/2026-11-02-phase6-handoff.md` was read.
- Carried debt was collected from every phase report (25 items, deduplicated). Each item is either fixed below or listed as open.

## Commits (`a51141c..release/phase6`)
| Commit | What |
|---|---|
| `823bfb8` | Fixed the expo-doctor `splash` schema failure (20/20). Pinned the Live Activity extension id and App Group. Installed `expo-dev-client` (the eas.json dev profiles needed it). Fail-safe poster exclusion (ADR-014). |
| `b15b457` | D8: Western digits in every shared date/time formatter. Arabic units (كجم/طن/د/س). |
| `a2228b0` | One e1RM engine on every screen. Assisted exercises get no e1RM. One record formatter (fixes session-detail records). Superset/giant-set grouping fix. RIR shown. |
| `d2790d8` | File protection upgraded on custom exercise photos at boot. |
| `1f86723` | Rest alert no longer dismissed right after delivery when rest ends in the background. 500-session perf seed script. |
| `895dd5b` | Arabic muscle summaries for the starter plan. First-strong isolates so Arabic units read correctly. |
| state commit | ADR-014, this report, decisions, screenshots |

## Tests
| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx expo lint` | clean |
| Jest | 34 suites, **308 passed, 0 failed** (11 new). Run with the machine idle. Under heavy `xcodebuild` load two screen tests timed out once and passed on rerun: observed flake, not a code failure. |
| Protected snapshots | 4/4 unchanged. `SetRow` and the `ExerciseCard` grid were not touched. |
| SQLite migrations / data integrity | Migration, merge-repair, persistence, rollback and history-recompute suites all pass. An upgrade-in-place install with an active session restored the session. A 500-session database migrated and loaded. |
| `npx expo-doctor` | **20/20** |
| iOS Release simulator build | BUILD SUCCEEDED ×4, the last at final code HEAD `895dd5b` (arm64 simulator, Xcode 26). No warnings from `gym-native`. |
| Store-mode asset inspection | See Licensing. The `.app` contains no poster: by hash and by name, and the Release build phase passed. |
| Accessibility / localization | See below. |
| Performance / memory | See below. |
| Physical iPhone | **Not run.** No device was available or authorized. |

## Native configuration, signing and entitlements
- **Regeneration before cleaning.** I inspected `ios/` in the main checkout and diffed it against a fresh `expo prebuild`. The only differences were Phase 5 additions (expected) and `.xcode.env.local` (machine-local node path). There were no hand customizations, so everything is reproducible from `app.json` plus config plugins.
- **Where `ios/` was regenerated.** It was regenerated with `prebuild --clean` in the Phase 6 worktree.
- **Deviation:** the main checkout's `ios/` was *not* regenerated.
  - The branch is not merged, so a prebuild from `a51141c` would produce Phase 5 config that is stale right away.
  - PID 30742, another session's `expo run:ios`, is still attached to that checkout.
  - Regenerate it after the merge.
- **Built entitlements (simulator `.xcent`):**
  - App `8TBB6SU34J.com.gymrat.app`: `healthkit`, `default-data-protection = NSFileProtectionCompleteUnlessOpen`, `application-groups = [group.com.gymrat.app]`.
  - Extension `8TBB6SU34J.com.gymrat.app.ExpoWidgetsTarget`: `application-groups = [group.com.gymrat.app]`.
  - No `aps-environment` (no push).
- **Info.plist:** `NSSupportsLiveActivities = true`, `NSSupportsLiveActivitiesFrequentUpdates = false`, `NSHealthUpdateUsageDescription` set (en/ar), `ExpoWidgetsAppGroupIdentifier = group.com.gymrat.app`. Extension point `com.apple.widgetkit-extension`.
- **Team verification (local evidence only; no EAS or Apple command was run):**
  - The keychain "Apple Development" certificate has OU = `8TBB6SU34J` and O = "Mohamed Hosam", valid to 2027-03-17.
  - Team Store provisioning profiles exist under `8TBB6SU34J` for other apps, which implies a paid program.
  - There is no profile yet for `com.gymrat.app` or its extension.
  - An **Apple Distribution identity for a different team (MZ5H52AJ5T, another person)** is also in the keychain. It must not be used.
  - Git history has two author emails. The owner must confirm which Expo account and Apple team publish this app.
- **Expo account:** not checked. The CLI is logged into another person's account and was not used. `app.json` has no `owner` / `extra.eas.projectId`.

## Workout experience and lifecycle (Release build, GymRAT-Phase6 simulator, iPhone 16 Pro, iOS 26.3)
| Scenario | Result |
|---|---|
| Fresh install → onboarding → Starter → Today | Pass |
| Notification permission from the Rest alerts switch | Prompt shown and allowed |
| Rest alert, app backgrounded | **Defect found and fixed** (`1f86723`): the banner was deleted 0.57 s after delivery. After the fix it is saved and nothing deletes it (`phase6-screenshots/simulator-logs.md`). |
| Rest ends while app in foreground | No alert; the pending one was cancelled (correct) |
| Live Activity start / update / single activity after kill + relaunch / end and dismiss on finish | Pass by chronod/SpringBoard logs. **Rendering not visually verified**: simulator screenshots show the island outline only. |
| Force-quit mid-workout → relaunch | Session restored (sets, timer) |
| App upgrade (reinstall) with an active session | Session restored |
| Pause → clock stops → resume | Pass (Arabic, Release) |
| Finish | Summary correct; Live Activity dismissed |
| HealthKit sheet | Write-only "Workouts". Don't Allow leaves the switch off and the app keeps working. |
| Keep Awake / Low Power Mode | Code and Jest only (`shouldKeepAwake`). The simulator has no Low Power Mode, so this needs a device. |

## Correctness fixes
- **e1RM**
  - The card "Best" tile, Library and Today used their own uncapped Epley. They now use the records engine (no estimate above 12 reps), so they agree with Records and the progress charts.
  - When no set has an estimate, "Best" falls back to the heaviest set. **Visible change:** bodyweight exercises now show "BW × n" instead of "—".
  - Assisted exercises get no e1RM in charts, goals or coach insights.
- **Session-detail records:** `set_volume` and `reps_at_weight` records showed missing-translation text, and reps showed as "12 kg". Both fixed, and the duplicate React key is fixed.
- **Grouping:** "Superset with next" on an exercise already in a group left a superset of one. Groups now merge into a giant set, and the group kind always matches the group size.
- **D8:** Arabic dates showed Arabic-Indic digits on Today, the workout summary and the review modal. Fixed centrally. Units are now Arabic.

## Localization and accessibility
- **Arabic RTL (Release):** Today, Progress, session detail and the active workout were mirrored and showed Western digits.
- **Themes:** Light, Dark and True Black were verified (poster in Phase 5 for all three; Dark/Light here).
- **VoiceOver label scan** of Today, Plan, Progress, Library, Settings and the workout/rest screen: every interactive element has a label.
  - Several targets are smaller than 44 pt in their frames (chart bars, Close, Options). Most of these have `hitSlop`.
- **Dynamic Type:** layouts hold up to XXXL (`05-…`). At accessibility sizes the workout header overflows (`06-…`): **open, high**.
  - React 19 dropped the `Text.defaultProps` cap, so a fix needs a shared Text wrapper. Not done in this phase.
- **Reduced motion:** the app has no custom animations.
- **Known language inconsistency (design question):**
  - Session detail and the finish summary now show the exercise name in the UI language.
  - Cards keep English as the main name with Arabic underneath.
- **System-language surfaces:** the Live Activity and HealthKit sheet follow the system language, not the in-app setting.

## Performance (simulator on an M-series Mac; tool overhead about 0.3 s per sample)
- **Cold start to an interactive Today with 500 sessions (9,000 sets):** 1.30–1.33 s across 4 runs, and 1.85 s on the first launch after the database swap.
- **History list (500 sessions):** content rendered within about 1 s of the tap. It uses a `SectionList`.
- **Memory footprint:** 83 MB at launch, 96 MB on Progress, 151 MB after repeated history pushes, peak 169 MB.
- **Not measured:** 60 fps scrolling (no frame-timing tool for this simulator), and device performance.

## Privacy, security and licensing
- **Local-only**
  - The app makes no `fetch`, XHR or WebSocket calls, uses no analytics or crash SDK, does not use `expo-updates`, has no push entitlement, and never asks for a push token.
  - User-initiated network use: YouTube loads only after a tap on Play, in a WebView (local HTML); "Open repdb.co" opens Safari.
  - Strings in the compiled bundle that a reviewer may notice are unreachable library code. They are `exp.host/--/api/v2/push/updateDeviceToken` and `react-native-youtube-iframe`'s remote HTML URL; the app uses `useLocalHTML`.
- **File protection**
  - The database folder and now `exercise-media/` are upgraded at boot to `completeUnlessOpen`. New files inherit it through the entitlement.
  - Enforcement after locking still needs a device.
- **Device backup (provisional; owner to confirm):** the database stays included in iCloud and computer backups, so history survives losing or replacing the phone.
  - Tradeoff: a backup copy holds workouts and body measurements, protected by the user's backup encryption.
  - Excluding it would make history unrecoverable, because the app has no export.
- **HealthKit:** write-only Workouts; nothing is read; the app keeps working when denied.
- **Dependencies:** `npm audit --omit=dev` reports 29 moderate/low findings, all in Jest/glob tooling and not shipped.
- **Neila Rey poster (ADR-014)**
  - It is included only in Debug/dev-client bundles served by Metro.
  - **No Release build of any profile (preview included) contains it.** The local Release `.app` was built with no environment variables, so its clean result proves the `__DEV__` layer on its own.
  - I copied the poster into an otherwise clean app copy, and the guard script then exited 1. That Xcode fails the build on a non-zero exit is standard behaviour but was not demonstrated separately.
  - **Still to do:** run `scripts/release/check-unlicensed-assets.sh` on the first EAS artifact. Do not distribute if it fails.
  - Attribution: "© Neila Rey" / neilarey.com is printed on the artwork; the source keeps the credit.
- **RepDB attribution:** kept in Settings › About.

### App Store privacy disclosure draft (owner to confirm)
- **Data collected by the developer:** none. There is no account and no server.
- **Health:** the app writes workouts to HealthKit on the device and does not read them. They are not transmitted to the developer.
- **Tracking:** none.
- **Owner decision:** YouTube playback inside the app lets Google collect data under its own policy. Decide whether the label should mention it; I recommend disclosing it in the privacy policy.
- **Required and missing:** a privacy policy URL, which HealthKit apps must have.

## Store screenshots and metadata
- **Candidate screenshots:** 1320×2868 (6.9") from the Release build in `phase6-store-screenshots/`: Today, Workout, Progress, Library.
  - They are **not final**. They show "Full Body Starter (draft)" and seeded data, and the status bar is overridden.
- **Missing metadata:** description, keywords, category, age rating, support URL, privacy policy URL.

## Open defects by severity
| Severity | Item |
|---|---|
| Critical (gate) | Physical iPhone never run: Live Activity look, locked-phone alert with sound and silent switch, keep-awake and Low Power, file-protection enforcement, real Health store, haptics, YouTube on cellular/offline, signing, device kill test 10/10. |
| Critical (gate) | Owner EAS login with their own account, project link, App IDs with HealthKit and App Groups (app and extension), confirmation of team `8TBB6SU34J`. |
| Critical (gate) | Poster check on the first EAS artifact. |
| High | Arabic copy is machine-written and unreviewed. |
| High | D4: the Starter plan is a "(draft)" in the app and in the screenshots. |
| High | 10 of 38 exercises use the illustration fallback; needs a waiver or new media. |
| High | Dynamic Type at accessibility sizes overflows the workout header. |
| High | Privacy policy URL and App Store labels. |
| Medium | RPE/RIR entry UI missing (`setSetFeedback` has no caller). |
| Medium | Giant sets only reachable through a merge; there is no multi-select. |
| Medium | Drag reorder missing; up/down buttons exist. |
| Medium | D11 video list approval. |
| Medium | Inconsistent exercise-name language. |
| Medium | Live Activity and HealthKit sheet follow the system language. |
| Medium | Spec items with no code: cardio logging, per-category notification toggles, per-event haptics, screen dimming (`expo-brightness`). |
| Low | README is stale. |
| Low | The 30-day body window uses calendar days across DST. |
| Low | Duplicate accessibility label on the session-detail edit control. |
| Low | Tooling-only npm audit findings. |
| Low | `web` dependencies are still present. |
| Low | Existing installs keep the English starter muscle summary. |

## Environment left behind
- **Worktree:** `../Gym RAT-phase6` on `release/phase6`. `main` is untouched at `a51141c`.
- **New simulators** (both run the final Release build with the 500-session performance database; neither holds real user data):
  - `GymRAT-Phase6` (ED1945A4…): in Arabic, Dark theme, light-blue accent (changed by a stray tap), one active workout. Notifications allowed, Health denied.
  - `GymRAT-Store-6.9` (62FDA732…): in English, one active workout, status bar overridden.
- **Untouched:** the `GymRAT-Phase4` simulator, and PID 30742 (still running).

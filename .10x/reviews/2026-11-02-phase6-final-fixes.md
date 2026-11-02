# Phase 6 merge and final release fixes

**Date:** 2026-11-02 · **main:** `4a65663` (`--no-ff` merge of `release/phase6 @ 9cd2afe`, branch kept) · **Fixes branch:** `release/phase6-fixes` (worktree `../Gym RAT-phase6`), based on `4a65663`, **not merged** · TestFlight: **NO-GO** · No EAS build, no submission.

## Step 1: merge into main
| Check (merged HEAD `4a65663`, main checkout) | Result |
|---|---|
| Both trees clean before merge; main is an ancestor of `release/phase6` | Yes |
| Tree identity after merge | `git diff release/phase6 main` is empty |
| Dependencies | `npm install`, not `npm ci`, so the Metro process (PID 30742) running from this checkout kept its `node_modules`; it only added `expo-dev-client`; PID 30742 still running |
| Jest / snapshots | 34 suites, 308/308; 4/4 protected snapshots unchanged (includes migration and data-integrity suites) |
| `tsc` / `expo lint` / `expo-doctor` | 0 errors / clean / 20/20 |
| Native regeneration | Hand-editable files of the old `ios/` (Phase 4 config, no customisations; 640 KB without `build/`/`Pods/`) copied to the session scratchpad first; then `npx expo prebuild --platform ios --clean` from the merged config; CocoaPods installed |
| Verified in the regenerated project | App entitlements: HealthKit, `default-data-protection = NSFileProtectionCompleteUnlessOpen`, App Group `group.com.gymrat.app`; no `aps-environment` (local notifications only, no push). Extension `ExpoWidgetsTarget` with the same App Group. Info.plist: `NSSupportsLiveActivities`, `ExpoWidgetsAppGroupIdentifier`, `NSHealthUpdateUsageDescription`. `ExpoModulesProvider.swift` registers `GymHealthModule` and `GymFileProtectionModule`. The unlicensed-asset build phase is present. |
| Release simulator build from the main checkout | BUILD SUCCEEDED; simulated entitlements `8TBB6SU34J.com.gymrat.app` + HealthKit + data protection + App Group; `ExpoWidgetsTarget.appex` embedded; poster check passed (no poster in product) |

No simulator, user data or unrelated process was touched by the merge.

## Step 2: fixes on `release/phase6-fixes`
| Commit | Item | What changed | Verified |
|---|---|---|---|
| `1e0d762` | YouTube policy | Player links (logo, title, "Watch on YouTube") were blocked, which YouTube's Developer Policies prohibit ("must not remove, obscure, alter, or disable any links that appear in YouTube players"). They now open in the YouTube app or Safari; nothing else may navigate the WebView. Only `videoId` + `checkedAt` ship: titles and channels (API data with a 30-day storage limit) are no longer stored, and the player shows its own attribution. Deprecated `modestbranding` dropped. Kept: 200 pt minimum, no overlays, no autoplay, Referer = `https://com.gymrat.app` (bundle id, RMF "Set the Referer" for local HTML). | Jest; simulator: "Watch on YouTube" opened Safari at youtube.com and the in-app player stayed (`20-`, `21-…png`) |
| `d975bb2` | "(draft)" label | Starter is "Full Body Starter" / "برنامج الجسم الكامل للمبتدئين". Existing installs: the template and the user's active clone are renamed at boot only while they still carry the old draft name; exercises, sets, rest, rotation pointer and active/template status untouched; user-renamed plans left alone; idempotent. | Jest; simulator: existing install renamed (`24-…png`) |
| `0f0b390` | 38-exercise media audit | Every mapped image was viewed. No wrong-exercise images. Three showed a different **variant** and now use the labelled placeholder: `dumbbell_kickback` (art: two-arm, unsupported; program: single-arm on a bench), `dumbbell_skull_crusher` (art: bench; program: floor), `seated_dumbbell_press` (art start: neutral grip in front of the face; program: lower to ear level). `dumbbell_deadlift` kept: same exercise, start frame closer to an RDL hinge (minor). Coverage **25/38**; mapping, manifest, index and COVERAGE.md agree; remaining files' SHA-256 match. No runtime path can borrow another exercise's art. | Jest (counts, manifest hashes) |
| `c72e2d3` | RPE / RIR entry | One-tap rating on the rest sheet after each working set: RPE 6, 7, 8, 8.5, 9, 9.5, 10 or RIR 4+–0; tap again to clear. Feeds progression rule 5a (RPE ≥ 9.5 or 0 RIR holds the weight). Settings › "Rate effort after each set": RPE (default), RIR, Off. Set grid untouched. | Jest; simulator Arabic (`22-…png`) |
| `d8970a6` | Dynamic Type overflow | Workout top bar, Warm-up/Workout segments and button labels capped at 1.5× (as iOS caps its own bars) and shrink to one line; body text scales fully. Duplicate "Edit workout" VoiceOver control in session detail removed. | Simulator AX-XXXL (`23-…png`) |
| `1b5db4a`, `c9e06cd` | Giant-set multi-select | "Group exercises…" in exercise options: checklist; a selection always covers the whole range between first and last pick (groups stay contiguous, which the engine's rest rule assumes); 2 = superset, 3+ = giant set; overlapping an existing group merges. No reducer changes beyond Phase 6's merge fix. | Jest (range, kinds, rest only after last member); simulator Arabic (`25-…png`) |
| `795f355`, `a9e9a18` | Mixed Arabic/English names | One rule: the name in the UI language first; cards, headers, library and the Today hero show the other language underneath; custom exercises without Arabic fall back to English. Library sorts by the shown name in the UI language and searches Arabic muscle names. English output unchanged (protected snapshots identical). | Jest; simulator Arabic |
| `ab1b6a7`, `a9e9a18` | Arabic translations | CLDR Arabic plural rules registered (zero/one/two/few/many/other) with full forms for counted strings; other count sentences use label-first wording. Fixed: "estimated 1RM" mistranslated as "estimated max rep"; "routine" → "exercise" meaning error; gender agreement; "Finish and advance" clashing with the Progress tab; Arabic example in the English-name field; Live Activity description. Terminology: rotation always "الدورة التدريبية" (bare "دورتك" is ambiguous); سيت; ريست-بوز; single "‏1RM المقدّر" term with RLM; Western `%` everywhere (D8). | Jest (plural table, no Arabic-Indic digits or ٪, key/placeholder parity) |
| `f3c6d0e` | VoiceOver duplicates | Scan of every tab found identical announcements for different targets ("Make next", "Duplicate", "Start a workout", "Adopt", "Open", "See all", "Dismiss"). Each now speaks its target; visible text unchanged. | Re-scan on the Release build: no duplicate or unlabelled buttons (Today, Plan, Progress, Library, session detail, workout) |

### Reviewed, no code change
- **Best tile vs PR / analytics:** one engine since Phase 6 (`a2228b0`); the tests that pin Best = Records = chart (no estimate above 12 reps, assisted excluded) pass on the fixes branch.
- **Drag reordering:** not implemented. It would need a gesture/animation list dependency and a new interaction inside the active workout for little gain over the existing controls; drag is also not VoiceOver-operable. Kept: "Move earlier / later" in the workout options and up/down buttons in the plan and day editors (all labelled buttons). Recommend revisiting after TestFlight feedback.
- **Thumbnails without media** show a dumbbell glyph without text (hidden from VoiceOver inside a labelled row); the full detail card carries the "No illustration yet" label.

## Quality gates on the fixes branch (`f3c6d0e`)
tsc 0 · lint clean · Jest 36 suites, **318 passed, 0 failed** · 4/4 protected snapshots unchanged · expo-doctor 20/20 · Release simulator build succeeded (three rebuilds, last at `f3c6d0e`), unlicensed-asset check passed in the build phase and by hand.

## Still open (owner or device)
| Severity | Item |
|---|---|
| Gate | Physical iPhone never run (Live Activity look, locked-phone alert, keep-awake/Low Power, file-protection enforcement, real Health store, haptics, YouTube on cellular, device kill test) |
| Gate | Owner Expo login, project link, App IDs with HealthKit + App Groups, team confirmation; first EAS artifact poster check |
| High | Native-speaker review of the Arabic, especially the terms that are product choices: الخطة vs البرنامج (tab vs screen title), تمرين for both "workout" and "exercise" (agent proposed جلسة for workouts), and the register of PDF-derived instruction text (Egyptian colloquial in warm-up text, MSA elsewhere). Exercise names from the owner's PDF were not changed. |
| High | Illustration coverage 25/38: 13 placeholders need new media or a written waiver |
| High | Privacy policy URL and App Store labels |
| Medium | Live Activity / HealthKit sheet follow the system language; the Made-for-Kids lookup in YouTube's policies (III.E.4) is satisfied only by manual curation of adult tutorial videos, no API lookup |
| Low | README; 30-day DST body window; tooling-only npm audit findings |

Recommendation remains **NO-GO for TestFlight** until the gates are cleared. The fixes branch is ready to merge on owner authorization.

## Environment
- `main` at `4a65663`; main checkout's `ios/` regenerated from the merged config (old hand-editable files saved in the scratchpad); PID 30742 still running, untouched.
- `release/phase6` preserved at `9cd2afe`; `release/phase6-fixes` at the state commit after `f3c6d0e`.
- Simulator `GymRAT-Phase6` (Arabic, Dark): rebooted once to recover touch input; runs the fixes build with the 500-session test database and a giant set in the open workout. `GymRAT-Store-6.9` and `GymRAT-Phase4` untouched in this step.

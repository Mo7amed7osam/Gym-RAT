# Physical-device verification — iPhone 16 Pro Max ("Mohamed's iphone")

**Date:** 2026-11-01 · **Device UDID:** 00008140-000874990AE1801C · **Build:** Release configuration, signed with Apple Development certificate, team 8TBB6SU34J (wildcard team provisioning profile `8TBB6SU34J.*`, which already lists this device) · **Bundle id:** `com.gymrat.app` (unchanged; see Decisions)

Nothing below counts as passed until it was performed on the phone. Status column: `pending` → `passed` / `failed` with evidence.

## Signing configuration found on this Mac

| Item | Finding |
|---|---|
| Xcode account | Team **8TBB6SU34J "Mohammed Hosam"**, Individual, paid (`isFreeProvisioningTeam = 0`) |
| Development certificate | "Apple Development: mohamed7osamm@icloud.com", OU 8TBB6SU34J, valid to 2027-03-17, private key in login keychain |
| Provisioning | "iOS Team Provisioning Profile: *" for 8TBB6SU34J, expires 2027-07-13, includes this iPhone's UDID |
| Other identities | "Apple Distribution: youssef ahmed (MZ5H52AJ5T)" — a different team, not used |
| EAS CLI | Logged in as **`ahmed3zzeldeen`** (ahmed.mohamed.ezzeldeen@gmail.com) — not the owner. Not used; no `eas build` was run. Owner must run `! npx eas-cli login` with their own account before any EAS/TestFlight step |
| app.json | `ios.appleTeamId: "8TBB6SU34J"` added; `expo prebuild` wrote `DEVELOPMENT_TEAM = 8TBB6SU34J` into both build configurations |
| Device | Paired, iOS reported by `devicectl`; **Developer Mode: Disabled** at the time of the first check |

## Owner-driven checklist

Prerequisite (owner, once): on the iPhone open **Settings → Privacy & Security → Developer Mode**, turn it on, let the phone restart, confirm the prompt. Keep the phone unlocked and connected over USB while installing.

For every step the owner taps; Claude Code terminates/relaunches the app with `devicectl` and pulls `Documents/SQLite/gymrat.db` (+ `-wal`, `-shm`) from the app container as evidence.

| # | Area | Owner does | Evidence pulled | Status |
|---|---|---|---|---|
| 1 | Install + onboarding | Launch; onboarding appears on a fresh install. Walk all steps (goal, experience, body, rest, plan, finish) | kv.settings: `onboardingComplete=true`, profile saved; 3 plans; Starter active | pending |
| 2 | Persistence kill test ×10 | Today → Start → enter weight + reps → tap ✓ on one set → say "logged" | App terminated immediately via `devicectl process terminate`, relaunched; `sets.completed=1` for that set; session resumes with the ✓ intact. Repeat 10× | pending |
| 3 | Rotation advance | Finish → "Finish and advance" → Today shows Day 2 | `plans.next_day_index=1`; session row `kind='plan'` | pending |
| 4 | Rotation repeat | Start Day 2 → Finish → "Finish and repeat" → Today still shows Day 2 | `next_day_index` unchanged | pending |
| 5 | Pause / active time | Start → Pause → wait ≥30 s → Resume → Finish; summary active time excludes the pause | `paused_intervals_json` non-empty; `activeSeconds` < wall time | pending |
| 6 | RTL / Arabic | Settings → Language → العربية; relaunch (Claude terminates + relaunches); UI mirrored, strings Arabic, Western digits | kv.settings `language='ar'`; owner screenshot | pending |
| 7 | Theme | Settings → Appearance: System / Light / Dark / True black, accent change | kv.settings `appearance` | pending |
| 8 | Reset All Data | Settings → Reset All Data → Erase everything → onboarding appears | New `gymrat.db` (inode changes), `sessions=0`, `onboardingComplete=false`, AsyncStorage empty | pending |
| 9 | Cold start after reboot | Reboot phone, open app: data from step 1–7 (before reset) or fresh state (after reset) intact | DB counts match | pending |

## Decisions / assumptions
- **Bundle id kept as `com.gymrat.app`** for this dev-signed build. The wildcard development profile covers any id. Before TestFlight the id must be registered to team 8TBB6SU34J in App Store Connect; if `com.gymrat.app` is taken, changing it is one line in app.json plus `expo prebuild` and a reinstall (device test data is lost, nothing else).
- **Build type:** Release configuration (JS bundle embedded, no Metro over Wi-Fi), signed with the development certificate. The project has no `expo-dev-client`, so an Expo "development build" would need a new dependency; the Release build is the more faithful kill-test target and was chosen for that reason.

## Build log
See the "Build status" section below (filled after each build).

## Build status

| Field | Value |
|---|---|
| Time | 2026-11-01 20:17 local |
| Command | `xcodebuild -workspace ios/GymRAT.xcworkspace -scheme GymRAT -configuration Release -destination "generic/platform=iOS" -derivedDataPath ios/build -allowProvisioningUpdates build` |
| Result | **BUILD SUCCEEDED** (log: scratchpad `device-build.log`, 41 699 lines) |
| Product | `ios/build/Build/Products/Release-iphoneos/GymRAT.app`, version 1.0.0 (1), `main.jsbundle` embedded (6.7 MB), `CFBundleLocalizations` en + ar |
| Signature | `codesign -dvv`: Identifier `com.gymrat.app`, Authority "Apple Development: mohamed7osamm@icloud.com (PVCT3785MA)", TeamIdentifier `8TBB6SU34J`; embedded profile "iOS Team Provisioning Profile: *" includes device 00008140-000874990AE1801C |
| Install | **Not installed.** `devicectl device install app` → "Installing cryptex com.apple.MobileAsset.DDI is disallowed because developer mode is not enabled." Owner must enable Developer Mode on the iPhone, then rerun: `xcrun devicectl device install app --device 00008140-000874990AE1801C ios/build/Build/Products/Release-iphoneos/GymRAT.app` |
| Device tests | **None performed.** Every checklist row above is `pending`. |


## Simulator run (owner instruction: "run using emulator, no test iPhone")

**Date:** 2026-11-01 20:38–21:20 · **Device:** iPhone 18 Pro simulator (iOS 27.0, UDID 0A2F480F-269A-40D3-B8EB-950AD144AD17) · **Build:** Release configuration for the simulator (`ios/build/Build/Products/Release-iphonesimulator/GymRAT.app`, embedded `main.jsbundle` 6.7 MB, no Metro) · **Driver:** CGEvent mouse clicks and hardware-keyboard keystrokes into Xcode 27's DeviceHub window (scratchpad `tap`, `swipe`, `click.swift`), evidence read from `Documents/SQLite/gymrat.db` in the app container after each step and from `simctl` screenshots.

This is simulator evidence, not physical-device evidence. The physical-iPhone rows above stay `pending`.

| # | Area | Performed | Evidence | Status |
|---|---|---|---|---|
| 1 | Fresh install → onboarding | Uninstall + install, launch | Screenshot: onboarding welcome; DB `user_version=2`, `journal_mode=wal`, 3 plans, Starter active, `onboardingComplete=false` | passed |
| 1b | Onboarding walked to the end (after Reset) | Get started → Get stronger → 1–3 years → 82.5 kg / 180 cm → rest → plan (Starter) → Start training | DB profile `{goal: strength, experience: intermediate, bodyweightKg: 82.5, heightCm: 180}`, `onboardingComplete=true`; Today shows Full Body A, Day 1 of 3 | passed |
| 2 | Kill test ×10 | Tap ✓ on a set, `simctl terminate` 150 ms later, relaunch, Resume | 10 of 10 writes present after kill and identical after relaunch (`killtest2.sh`: writes=10 survived=10, one tap missed the row and was repeated); first set logged 60 kg × 12 with `completed=1` and carry-forward to set 2 | passed |
| 3 | Rotation advance | Finish → Finish → Done | Summary "Up next: Full Body B"; Today "Full Body B · Day 2 of 3"; DB `next_day_index=1`; session `status=completed`, summary volume 720 kg | passed |
| 4 | Rotation repeat | Start Full Body B → Finish → "Repeat Full Body B next time instead" → Done | Summary "Up next: Full Body B"; Today still Day 2 of 3; DB `next_day_index=1` | passed |
| 5 | Pause / active time | Pause at 0:06, wait 67 s, resume, finish | DB `paused_intervals_json=[{from 19:08:31, to 19:09:38}]`, summary `durationSeconds=88, activeSeconds=20`; summary card "1 min · 0 min active" | passed |
| 6 | Arabic / RTL | Settings → العربية → terminate + relaunch → Today, Settings | Screenshots: full RTL mirroring, Arabic strings, Western digits in stats; DB `language='ar'`; switched back to System and relaunched, LTR restored | passed (known D8 gap: the date line "الأحد، ١ نوفمبر" uses Arabic-Indic digits) |
| 7 | Theme | Light, True Black + green accent, back to System/orange/Comfortable | Screenshots of each; DB appearance matches each state | passed |
| 8 | Reset All Data | Settings → Reset All Data → Erase everything | New `gymrat.db` (inode 266293123 → 266437535, 4 KB), `sessions=0`, 3 plans reseeded, AsyncStorage directory empty, onboarding shown | passed |
| 9 | Cold start after reboot | `simctl shutdown` + `boot`, launch | `PRAGMA quick_check=ok`, plans 3, onboarding complete, Today intact | passed |
| 10 | Plan tab | Opened | Rotation list with "Next up" / "Make next", template "Use this plan" rendered | rendered only (Make next / Use this plan taps covered by Jest) |
| 11 | Library search | Typed "curl" | **Defect found** (see below) | failed → fixed |

### Defects found and fixed
1. **Library search lost focus after every keystroke** (only "c" of "curl" landed; re-tapping the field appended one more character each time). Cause: the `TextInput` lived inside the FlatList `ListHeaderComponent`, which re-renders on every data change. Fix: the header now renders above the list (`screens/LibraryScreen.tsx`). Jest screen test still green; re-verified on the simulator after rebuild: "Curl" typed in one go, 7 matches.
2. **"Erase everything" truncated to "Erase everyt…"** in the Reset All Data dialog beside Cancel. Fix: `ConfirmDialog` stacks the buttons vertically when the two labels are long (`components/ui/ConfirmDialog.tsx`). Re-verified on the simulator after rebuild: full "Erase everything" button above Cancel.

### Notes
- Reading the iOS accessibility tree through macOS System Events (`entire contents`, even `subrole` of the iOS content group) **presses elements in DeviceHub**; the first attempts typed stray digits into onboarding and opened a YouTube page. The driver was rewritten to read only the DeviceHub window frame. Nothing from those stray presses survives: the database was reset in step 8 and the walk in 1b was done afterwards.
- The onboarding "Choose a plan" step lists the PDF reference program as a selectable template. It is never the default (Starter is pre-selected); confirm this is the intended D3 reading.

### Final state
- Rebuilt simulator Release app (both fixes) installed over the existing data; Today, Library and Settings verified again. Simulator left on Today with the Starter plan active, no session in progress.
- Commits: `94d7bc3` hardening tests, `a22fe8e` Apple team + checklist, `0353b23` devops decisions, then the two fixes and this report.

## Owner clarification applied: extracted program is an ordinary template (ADR-006, commit `cceff93`)
- Source document found at `~/Downloads/Push Pull Leg Upper Lower  5.0.pdf` (not in the repo, not bundled). All 42 prescription rows (sets, reps, rest) in `data/seeds/pdfProgram.ts` compared with the day tables on pages 7, 13, 18, 22, 28: **all match**. Day focus (A days strength, B days hypertrophy) and the Arabic description match page 5. Schedule page 6 (Tuesday cardio, Friday rest) is intentionally not part of the rotation.
- `reference` plan kind retired; schema v3 rewrites existing rows; "Reference program" label removed; program is a locked bundled template selectable in onboarding and Plan; Starter stays the default.
- Simulator (same data as before, schema v2 with a `reference` row): rebuilt app installed → `user_version=3`, `pdf_ppl_ul_v5` kind `template`, `quick_check=ok`, `gymrat.backup.db` left at v2 with the old row. Plan tab shows "5 days per rotation" with no reference label. "Use this plan" → Switch → active plan cloned from `pdf_ppl_ul_v5` with days Push A, Pull A, Leg A, Upper B, Lower B; Today shows Push A, Day 1 of 5.

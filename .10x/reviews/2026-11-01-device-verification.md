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

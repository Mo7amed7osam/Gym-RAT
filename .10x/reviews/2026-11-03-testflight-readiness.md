# TestFlight readiness audit and local IPA attempt — 2026-11-03

**HEAD:** `main @ 866dd27` (verified; tree clean at 02:14). At 02:19 `components/ExerciseDetail.tsx` was modified in this checkout by someone else (video section moved above instructions, 5 lines); not touched or reverted here. The unsigned archive built at 02:30 therefore bundles HEAD **plus that uncommitted change**. **Recommendation: NO-GO for TestFlight upload today.** No IPA exists. Two owner-only blockers stop a *usable* build; one Apple-side identifier collision stops *signing*.

Parallel-session safety: the admin-dashboard split worktree (`../Gym RAT-admin-split`, branch `feature/admin-dashboard-split @ 866dd27`) was only inspected with read-only git commands and never touched. No VPS deploy, no DNS change, no EAS, no upload, no commit, no prebuild.

## 1. Blockers

| Sev | Blocker | Owner action |
|---|---|---|
| CRITICAL | **No production auth server.** No `.env` exists, `EXPO_PUBLIC_AUTH_API_URL` is unset everywhere, no domain appears in any document, `server/` has never been deployed. A Release build inlines `null`, so the sign-in screen shows "server not configured" and nobody can log in. A TestFlight build today would not provide a working login. | Deploy `server/` on the VPS per `server/README.md` → "Production on a VPS" (Docker Compose + Caddy + SMTP). Then create `.env` in the app root with `EXPO_PUBLIC_AUTH_API_URL=https://<your-domain>` and rebuild. Note `.env` is **not** gitignored (only `.env*.local`); add it to `.gitignore` or accept that the URL is committed. |
| CRITICAL | **App Group identifier taken.** Signed archive fails: `Communication with Apple failed. An Application Group with Identifier 'group.com.gymrat.app' is not available. Please enter a different string.` Apple App Groups are globally unique; another team owns this one. Without it Xcode cannot build a profile with App Groups, HealthKit and Data Protection for either target. | The collision is strong evidence the `com.gymrat.app` namespace is someone else's. **Recommended:** move bundle id, widget id and App Group together to a reverse-DNS namespace you own (e.g. `<tld>.<yourdomain>.gymrat`, `…gymrat.ExpoWidgetsTarget`, `group.<tld>.<yourdomain>.gymrat`) in `app.json` (`ios.bundleIdentifier`, expo-widgets `bundleIdentifier` + `groupIdentifier`), so a second collision cannot cost another cycle. **Minimal:** change only `groupIdentifier`. Either way run `npx expo prebuild --platform ios --clean`, then §6. Side effect to know: today's probe ran with `-allowProvisioningUpdates`, so Xcode may already have registered the App ID `com.gymrat.app` on team 8TBB6SU34J (not confirmable without the portal; harmless). |
| HIGH | **No Apple Distribution certificate for team 8TBB6SU34J.** Keychain holds one `Apple Development` identity (OU 8TBB6SU34J) and two `Apple Distribution: youssef ahmed (MZ5H52AJ5T)` identities, which belong to someone else and were not used. An App Store export is impossible without a Distribution identity. | After the App Group fix, the export step with `-allowProvisioningUpdates` lets Xcode create the Distribution certificate if your account role is Account Holder or Admin. Otherwise: Xcode → Settings → Accounts → 8TBB6SU34J → Manage Certificates → + → Apple Distribution. |
| HIGH | **Never run on a physical iPhone.** iPhone 16 Pro Max is paired but was offline/unplugged during this session. | Run `.10x/reviews/2026-11-03-iphone-device-checklist.md` once an installable build exists. |
| HIGH | **No tester account possible yet.** The dashboard refuses to create members until SMTP is configured on the deployed server. | Comes with the VPS deploy. |

Resolved since yesterday: the **Program License Agreement is accepted**. Yesterday's log (`../Gym RAT-phase7/release-artifacts/archive-signed.log`) failed with "PLA Update available"; today's attempt got past that and failed one step later on the App Group. Xcode is signed in to team 8TBB6SU34J.

## 2. Release audit (evidence at HEAD 866dd27)

No simulator functional pass was performed in this session. Evidence is the Jest suite run today, configuration inspection today, and the Release simulator verification recorded in `status.md` for this HEAD.

| Area | Evidence | Verdict |
|---|---|---|
| Authentication, session persistence | `auth.session.test.ts`, `auth.screens.test.tsx`; Keychain via `expo-secure-store`; root layout gates every route behind `signedIn` | OK in code; unusable without server |
| Login, password recovery | `app/auth/login.tsx`, `app/auth/forgot.tsx`; forgot always 202 server-side | OK |
| Offline lease | `services/auth/lease.ts` (7-day lease, high-water-mark clock); tests | OK |
| SQLite persistence, account isolation | `auth.isolation.test.ts`, `db.*.test.ts`, per-account `gymrat.u-<id>.db` (ADR-016) | OK |
| Workout engine | `session.engine/reducer`, `workoutStore` tests; force-quit recovery proven in Phase 1 kill tests (simulator) | OK |
| Exercise library, images | `exercises.library.test.ts`; 25/38 media verified (Phase 6) | OK; 13 placeholders remain (owner waiver) |
| Smart Coach, PR engine | `coach`, `records`, `recommendations.store` tests | OK |
| Progress, analytics | `analytics*`, `progress.*` tests, 6 time zones (Phase 4) | OK |
| Apple Health | `modules/gym-native/ios/GymHealthModule.swift`, `phase5.integrations.test.ts`; entitlement + usage string present | Code OK; device unverified |
| Live Activities, Dynamic Island | `ExpoWidgetsTarget` extension, `NSSupportsLiveActivities` true, `widgets/WorkoutActivity.tsx` | Code OK; visuals never seen on hardware |
| Notifications, haptics | `services/restAlerts.ts`, custom sound bundled, `expo-haptics` | Code OK; device unverified |
| Egyptian Arabic, RTL | `i18n.test.ts`, `progress.i18n.test.ts`; `CFBundleLocalizations` en+ar; native usage strings localised | OK (simulator-verified in Phase 6/7) |
| Light, Dark, True Black | `theme.test.ts`; `theme/index.ts` | OK |
| Accessibility, VoiceOver | 49 files carry accessibility props; Phase 6 VoiceOver context labels | OK in code; VoiceOver never run on device |
| Lifecycle, force-quit | kill tests 10/10 (Phase 1 simulator); session restore test | OK |
| Production configuration | see §1 | **FAIL** (no server URL) |

### Quality gates today
| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx expo lint` | clean |
| `npx expo-doctor` | 20/20 |
| Jest (full run, machine under load avg ≈ 6 from the other session) | 41 suites, 358/360; two 5 s timeouts in `auth.screens` and `screens.hardening` |
| Jest rerun of those two suites alone | 18/18 passed. Same load flake the Phase 6 report recorded; not a code failure |
| Protected snapshots | 4/4 |

### Non-blocking findings
- `NSFaceIDUsageDescription` is the expo-secure-store boilerplate ("Allow $(PRODUCT_NAME) to access your Face ID biometric data"). App Review may ask for a purpose. Fix: `ios.infoPlist` entry in app.json. Low.
- Dev-client residue (`NSBonjourServices _expo._tcp`, dev-launcher local-network string, `exp+gym-rat` scheme) is in the source Info.plist and, as verified on today's Release product, the "[Expo Dev Launcher] Strip Local Network Keys for Release" phase did not remove the first two. Harmless at runtime; visible to App Review. Low.
- Widget target `TARGETED_DEVICE_FAMILY = "1,2"` while the app is iPhone-only (`1`). Check App Store Connect validation; expected harmless. Low.
- `MARKETING_VERSION = 1.0` on the app target vs `1.0.0` in Info.plist (hardcoded, so the product says 1.0.0). Cosmetic.
- `PrivacyInfo.xcprivacy` present with UserDefaults, FileTimestamp, SystemBootTime reasons. OK.
- `ios/` is newer than `app.json`/`package.json` (regenerated 2026-11-03 00:33) and contains the unlicensed-asset guard phase, ExpoSecureStore and ExpoWidgets pods. No prebuild needed; none run.

## 3. Apple signing status (verified today)
| Item | State |
|---|---|
| PLA | Accepted (no PLA error from Apple today) |
| Team access | Xcode signed in to 8TBB6SU34J; automatic signing reached Apple |
| Bundle id `com.gymrat.app` | Not reported as unavailable; the probe may have registered it on 8TBB6SU34J as a side effect; not confirmable without the portal |
| App Store Connect app record | Unknown; needs owner login |
| Apple Distribution certificate | **Missing** for 8TBB6SU34J |
| App Store provisioning profile | **Missing** (only the wildcard team profile, no capabilities) |
| HealthKit, App Groups, Data Protection | Cannot be added: App Group id collision (§1) |
| Live Activity extension signing | Same failure as the app target |
| Identity to use | `Apple Development: mohamed7osamm@icloud.com (PVCT3785MA)` for device installs; Distribution to be created. MZ5H52AJ5T identities excluded |

## 4. Backend connectivity
Not deployed. No domain, no DNS, no `.env`. The authentication API stays on the owner's VPS by design (ADR-015); the admin dashboard split for Vercel is a separate worktree and does not change this. No API URL was invented.

## 5. Build artifacts at HEAD 866dd27
| Artifact | State | Path |
|---|---|---|
| Simulator build | Previously recorded in status.md for this HEAD; not rebuilt today | — |
| Unsigned archive | **Built and verified** (§5a) | `release-artifacts/2026-11-03-testflight-candidate/GymRAT-unsigned.xcarchive` |
| Signed archive | **Failed** (App Group) | `release-artifacts/2026-11-03-testflight-candidate/archive.log` |
| Exported IPA | **None** | — |
| Installed device build | **None** | — |

Export option plists prepared: `scripts/release/ExportOptions-appstore.plist` (method `app-store-connect`, destination `export`, team 8TBB6SU34J, automatic signing, no certificate name so the MZ5H52AJ5T identities can never be picked) and the existing `ExportOptions-development.plist`.

## 5a. Unsigned archive verification
**ARCHIVE SUCCEEDED** at HEAD 866dd27 (`archive-unsigned.log`, 13 MB; `CODE_SIGNING_ALLOWED=NO`, `GYMRAT_STORE_BUILD=1`). The first attempt failed with `Build input file cannot be found: .../ios/build/generated/ios/ReactCodegen/*-generated.mm` (codegen output missing from the checkout); `pod install` in `ios/` regenerated it (`pod-install.log`; `Podfile.lock` unchanged at 00:33, `project.pbxproj` rewritten by CocoaPods at 02:25 as usual) and the second attempt succeeded. No prebuild was run.

| Check on `Products/Applications/GymRAT.app` | Result |
|---|---|
| Bundle id / version | `com.gymrat.app` 1.0.0 (1); `PlugIns/ExpoWidgetsTarget.appex` present |
| `scripts/release/check-unlicensed-assets.sh` (in-build phase and by hand on the archive product) | **passed**: poster absent by hash and by name |
| `main.jsbundle` (7.6 MB) | 0 occurrences of `127.0.0.1` and of port `3100`: no dev server URL shipped; the only `pre_workout_stretches` string is the size-table key, not the image |
| Signature | `code object is not signed at all` (unsigned by design) |
| expo-dev-client in Release | No dev-launcher/dev-menu framework in `Frameworks/`; the binary carries only the `EXDevMenuInterface` / `EXUpdatesDevLauncherInterface` protocol symbols (interface pods, normal for an Expo Release build). Dev tooling excluded |
| Dev-client residue | `NSBonjourServices` (`_expo._tcp`) and the dev-launcher `NSLocalNetworkUsageDescription` are still in the product Info.plist: the strip phase did not remove them in this archive. Low; App Review visible only |

SHA-256 (`SHA256SUMS.txt`):
```
d433d70735eff3dd44c35811dd4401275335a4e3236d1fdec9dcbe4da1e9c1de  GymRAT.app/GymRAT
19899950fb77d95747302b0827ceda8edec2bc84bdfc6262bcae895455d4584a  GymRAT.app/main.jsbundle
ec643eedafa87ef8be9d76631bf78cfe8ece3ca3fa2366dd67f295368f57061c  ExpoWidgetsTarget.appex/ExpoWidgetsTarget
```
This archive has **no auth server baked in** (login shows "not configured") and cannot be exported or installed. It proves the Release pipeline and the poster gate at HEAD; it is not the release artifact.

## 6. Exact rerun once the blockers are cleared
```bash
cd "/Users/mohamedhosam/Untitled/Gym RAT"
# 1. app.json: expo-widgets groupIdentifier → new group id; create .env with EXPO_PUBLIC_AUTH_API_URL=https://<domain>
npx expo prebuild --platform ios --clean
D="$PWD/release-artifacts/$(date +%F)-testflight"; mkdir -p "$D"
GYMRAT_STORE_BUILD=1 xcodebuild -workspace ios/GymRAT.xcworkspace -scheme GymRAT -configuration Release -sdk iphoneos \
  -destination 'generic/platform=iOS' -archivePath "$D/GymRAT.xcarchive" -derivedDataPath "$D/DerivedData" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=8TBB6SU34J CODE_SIGN_STYLE=Automatic archive 2>&1 | tee "$D/archive.log"
xcodebuild -exportArchive -archivePath "$D/GymRAT.xcarchive" -exportPath "$D/ipa" \
  -exportOptionsPlist scripts/release/ExportOptions-appstore.plist -allowProvisioningUpdates 2>&1 | tee "$D/export.log"
scripts/release/check-unlicensed-assets.sh "$D/ipa/GymRAT.ipa"
(cd "$D" && shasum -a 256 ipa/*.ipa > SHA256SUMS.txt && cat SHA256SUMS.txt)
```
Then verify: `codesign -dvvv` on `Payload/GymRAT.app` and the `.appex` shows `TeamIdentifier=8TBB6SU34J` and an `Apple Distribution` authority; `embedded.mobileprovision` has no `ProvisionedDevices` and `get-task-allow` false.

## 7. Physical iPhone
Not run. Checklist: `.10x/reviews/2026-11-03-iphone-device-checklist.md`.

## 8. TestFlight preparation
`.10x/reviews/2026-11-03-testflight-notes.md` (version, icon, description, What to Test, tester instructions, permissions; domain and test account marked TBD).

## 9. Remaining owner actions, in order
1. Move the identifiers to a namespace you own (recommended: bundle id + widget id + App Group together; minimum: the App Group) in `app.json`, then `npx expo prebuild --platform ios --clean`.
2. Deploy the auth server on the VPS with a domain, HTTPS and SMTP; bootstrap the admin; create a dedicated tester member.
3. Create `.env` with the production `EXPO_PUBLIC_AUTH_API_URL`; decide whether it is committed.
4. Run §6. Let Xcode create the Apple Distribution certificate, or create it in Xcode → Accounts.
5. Create the App Store Connect app record (privacy policy URL required for HealthKit).
6. Install on the iPhone 16 Pro Max and run the device checklist.
7. Only then decide on the TestFlight upload. Nothing is uploaded by this session.

---
## Update 2026-11-03 03:20 — signing unblocked, poster kept, IPA exported

**Identifiers (owner-chosen in Xcode, mirrored to app.json):** app `com.mohamedhosam.gymrat`, widget `com.mohamedhosam.gymrat.ExpoWidgetsTarget`, App Group `group.com.mohamedhosam.gymrat`. App ID Data Protection set to *Protected Unless Open* in the developer portal to match the entitlement. `ios/` regenerated with `npx expo prebuild --platform ios --clean`. A stray App ID `com.gymrat.appp` exists on the team from an earlier Xcode edit; harmless.

**Owner decision (ADR-020):** the Neila Rey poster ships in every build. `__DEV__` gate, Metro stub, `index.store.ts`, `GYMRAT_STORE_BUILD` and the poster's `UNLICENSED.sha1` entry removed; guard mechanism kept for other assets. **Redistribution rights remain unverified; no licence is on file.**

| Artifact (HEAD 866dd27 + uncommitted changes) | State | Path |
|---|---|---|
| Signed archive (no poster, pre-decision) | succeeded, superseded | `GymRAT-signed-noposter.xcarchive` |
| Signed archive (with poster) | **succeeded** | `release-artifacts/2026-11-03-testflight-candidate/GymRAT.xcarchive` |
| Exported IPA (App Store Connect method) | **succeeded** | `release-artifacts/2026-11-03-testflight-candidate/ipa-appstore/GymRAT.ipa` |
| Installed device build | none | — |

IPA verification: app + appex signed `Apple Distribution: Mohammed Hoasam (8TBB6SU34J)` (cloud-managed certificate created by Xcode during export; the MZ5H52AJ5T identities were not used); `codesign --verify --deep --strict` OK on both; Store profiles, no `ProvisionedDevices`, `get-task-allow` false, `beta-reports-active` true; entitlements HealthKit + Data Protection (CompleteUnlessOpen) + App Group on the app, App Group on the appex. Poster present at `Payload/GymRAT.app/assets/assets/exercises/stretches/pre_workout_stretches.jpg`, SHA-1 identical to source. Version 1.0.0 (1). `127.0.0.1` occurrences in bundle: 0.

```
625db167f1db592b8b80e2f88351187e7e0278c395fa6c5c0eb8732d87690465  ipa-appstore/GymRAT.ipa
```

**Still blocking a useful TestFlight build:** no production `EXPO_PUBLIC_AUTH_API_URL`. This IPA's sign-in screen says the server is not configured. Rebuild after `.env` exists. Nothing uploaded.

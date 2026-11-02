# Phase 5 → Phase 6 handoff (release readiness)

**Date:** 2026-11-02 · **main:** merge commit of `feature/phase5-ios` (see `git log --merges -1`) · **Phase 5 tip merged:** `ed724ed` (the reported `b019137` plus one commit: Neila Rey poster restored for dev/internal builds, owner change) · ADR-013 · Report: `reviews/2026-11-02-phase5-report.md`.
**Phase 6 is not authorized yet.** Nothing here has been started; no EAS command has been run; nothing submitted.

## 1. Verified on main after the merge
| Check | Result |
|---|---|
| Tree identity | `git diff ed724ed <merge>` empty: everything verified on the branch applies to main |
| `npm ci` + Jest | 33 suites, 297 tests pass; 4 protected snapshots unchanged |
| `npx tsc --noEmit` / `npx expo lint` | 0 errors / clean |
| `npx expo-doctor` | 19/20; the failure is `app.json` top-level `"splash": null`, present since before Phase 5 (b90ece9). Fix in Phase 6 (remove the key) |
| Store bundle without poster | `GYMRAT_STORE_BUILD=1 npx expo export --platform ios`: 0 JPEG assets. Dev export on the branch: poster present (same SHA-1 as the source file) |
| Simulator build | Done on the branch tree (`expo run:ios`, BUILD SUCCEEDED incl. widget extension); not repeated from the main checkout (see §2) |
| Physical iPhone | **Never run** |

## 2. First steps for whoever picks up Phase 6
1. **Regenerate native projects.** The main checkout's `ios/` (gitignored, CNG) was generated from Phase 4 config and lacks the HealthKit/data-protection entitlements, `expo-notifications`, the `expo-widgets` extension and `modules/gym-native`. Run `npx expo prebuild --clean` (or delete `ios/`) before any local build. A dev client built before the merge will red-screen on the new native modules.
2. **Expo/Apple account (owner only).** The EAS CLI on this Mac is logged into another person's account: do not use it. Owner runs `eas logout` then `eas login` in their own terminal; `app.json` has no `owner`/`extra.eas.projectId`, so link the project to the owner's account first. Team `8TBB6SU34J`, bundle id `com.gymrat.app`, extension `com.gymrat.app.ExpoWidgetsTarget`, app group `group.com.gymrat.app`; enable HealthKit + App Groups on the App IDs. Never share passwords, keys or 2FA codes in chat.
3. **Release-build rule for the Neila Rey poster.** Metro stubs the poster out when `EAS_BUILD_PROFILE=production` or `GYMRAT_STORE_BUILD=1` is in Metro's environment (`metro.config.js`); `eas.json` `build.production.env` now sets `GYMRAT_STORE_BUILD=1` (guard test). A `preview` build and any local Xcode archive started without `GYMRAT_STORE_BUILD=1` **include it**. Not verified on EAS (no EAS run was allowed): Phase 6 must confirm the poster is absent from the first production IPA (inspect the bundled assets). Shipping the poster needs documented rights or permission.
4. Physical-device checklist: report §Physical-device-only (8 items: Live Activity look, locked-phone notification, keep-awake/Low Power, data-protection enforcement, real Health store, haptics, YouTube on cellular/offline, signing).

## 3. Owner decisions open
| Decision | Recommendation |
|---|---|
| Database in iCloud/device backup | Keep included (history survives a lost phone; no export exists) |
| D11 YouTube list (35/38, title-reviewed) | Approve or edit `scripts/media/youtube-candidates.json` |
| Neila Rey poster rights | Obtain permission or keep it store-excluded |
| Arabic copy (machine-written) | Native-speaker review |
| App Store privacy labels | Health (write, not linked, no tracking); YouTube contacted only on tap |

## 4. Known issues carried into Phase 6
See report §Known issues. Release checklist items still open: device sizes, VoiceOver pass, performance, production build, `splash` schema fix.

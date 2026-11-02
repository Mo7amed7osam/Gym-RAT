# Phase 5 report — iOS Integrations & Native Experience

**Date:** 2026-11-02 · **Branch:** `feature/phase5-ios` (worktree `../Gym RAT-phase5`) · **Base:** `main @ b90ece9` · **ADR:** 013 · Merged into main 2026-11-02 (branch tip `ed724ed`); Phase 6 handoff `specs/2026-11-02-phase6-handoff.md`.

## Baseline (verified before any change)
`main` = `b90ece9`, clean. Jest 30 suites / 265 tests / 4 snapshots pass; `tsc` 0 errors; `expo lint` clean.

## Results now
| Check | Result |
|---|---|
| Jest | 33 suites, 296 tests, all pass; 4 protected snapshots unchanged |
| `npx tsc --noEmit` | 0 errors |
| `npx expo lint` | clean |
| iOS simulator build (`expo run:ios`, then `xcodebuild` after the last native edit) | BUILD SUCCEEDED; main app + `ExpoWidgetsTarget` extension; no warnings from `gym-native` |
| Migration on a real database | Phase 4 simulator database `user_version 7 → 10`; 10 sessions, 6 body entries, 3 goals intact; `health_exports` created |

## Checklist
| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | HealthKit via Expo-compatible native module | Done | `modules/gym-native` (local Expo module, Swift); entitlement + usage string (en/ar) via app.json |
| 1 | Only necessary permissions, clear consent | Done | Share (write) access to **Workouts only**, no read; requested only from Settings › iPhone › Apple Health. Sheet screenshot `phase5-screenshots/03-health-write-only.png` |
| 1 | Write completed workouts | Done (simulator) | One `traditionalStrengthTraining` / indoor workout per session, pauses as events; simulator HealthKit store: 1 workout, duration 318.8 s = 341.3 s − 22.5 s pause, 2 events |
| 1 | No duplicates | Done (simulator + Jest) | Save deletes by `HKMetadataKeyExternalUUID` first; ledger `health_exports`. Edit on simulator replaced the workout (count stayed 1, new UUID) |
| 1 | Edited/deleted workouts | Done (simulator + Jest) | Phase 4 "one day earlier" edit → Health copy moved; delete → Health count 0, ledger row removed |
| 1 | Works without permission | Done | Exporter no-ops unless `authorized`; toggles off by default; Jest covers notDetermined/denied/unavailable |
| 1 | No upload | Done | No network code; writes go only to the on-device Health store |
| 2 | Live Activity for workout + rest | Done (simulator, log-level) | `widgets/WorkoutActivity.tsx` via `expo-widgets` |
| 2 | Useful info, no sensitive details | Done | Day code, current exercise, "Set n of m", active time, rest countdown. No weights, reps, notes or body data (asserted in Jest) |
| 2 | Lock Screen + Dynamic Island | Implemented; **visual check pending device** | SpringBoard log: activity started at workout start, system-aperture element created (`preferredLayoutMode = compact`), updated on set/rest/pause/resume, stale at rest end, removed on finish and on discard. Widget extension log: 9 successful render batches, no runtime errors. Rendered appearance unverified: the one capture while backgrounded showed the island as an empty outline |
| 2 | Pause, resume, timer completion, finish, termination | Done | Pause/resume freeze/restart the SwiftUI timers (`pauseTime`); `staleDate` = rest end → "Rest over"; killed mid-workout and relaunched: same activity id updated, no second start |
| 2 | Unsupported devices | Done (Jest) | Start/listing failures → no activity, no retries until the workout ends |
| 3 | Configurable rest notifications | Done | Settings › iPhone › Rest alerts (off by default) |
| 3 | Permission handling | Done | Prompt only from the toggle (`02-notification-permission.png`); denied → switch disabled + "Open iOS Settings"; status refreshed on return |
| 3 | Cancel/update stale, no duplicates | Done | Fixed id `rest-complete`, cancel-then-schedule on start/±15 s/resume, cancel on pause/skip/finish, delivered one dismissed when stale. Simulator: banner delivered once, 1.2 s after `endsAt`, with the app in the background |
| 3 | Respect settings / iOS limits | Done | No banner/sound in foreground (in-app chime instead); custom sound only when "Rest-over sound" is on; no time-sensitive or critical level (needs entitlements) |
| 3 | No cloud push | Done | `enableRemoteNotifications: false`; no `aps-environment` entitlement in the generated project |
| 4 | Haptics | Done | Existing set/PR/rest/steppers + new finish (success) and pause/resume (light); all behind the Haptics setting |
| 4 | Keep Awake | Done; **device-pending** | Held only while a workout is active and not paused, setting on |
| 4 | Low Power Mode | Done; **device-pending** | `expo-battery` `useLowPowerMode` releases the lock (always false on simulator) |
| 4 | Persistence / rotation unchanged | Done | Jest suites for persistence, rotation and session engine unchanged and green |
| 4 | Protected Sets Logging UI | Preserved | `SetRow`/`ExerciseCard` untouched; 4 snapshots unchanged |
| — | Late duplicate chime | Fixed | A countdown first seen > 2 s late (app suspended) marks rest elapsed silently (simulator: `elapsedAt` set 39 s after `endsAt`; absence of the chime follows from the code path, not heard) |
| 5 | Optional embedded YouTube | Done | `components/ExerciseVideo.tsx`; nothing loads until tapped; plays inline on simulator (`11-video-player.png`, `12-video-playing.png`) |
| 5 | Official embedding, policy | Done | YouTube IFrame Player API, ≥ 200 pt, no overlays, origin `https://com.gymrat.app`, page generated locally (no third-party host), navigation away blocked |
| 5 | Verified ids only | Done | `scripts/media/check-youtube.mjs`: oEmbed 200 (public + embeddable) **and** reviewed title. 35/38 verified (`data/youtubeVideos.json`, `checkedAt`); in-app playback confirmed on the simulator for one id (Leg Press); 3 rejected for wrong variant (one-arm vs two-arm cable curl, bench vs floor leg raise, wrist curl vs reverse curl). Review was by title/channel; **owner approval of the list (D11) pending** |
| 5 | Unavailable / offline | Done (Jest) | `embed_not_allowed`/`video_not_found`/network error/15 s timeout → fallback card + retry; "needs internet" note up front |
| 5 | Never required | Done | Video only in exercise detail |
| 6 | Data protection audit | Done | See below |
| 6 | Neila Rey poster | Restored for development/internal testing only (owner change, 2026-11-02) | Byte-identical image from `b90ece9` (848×1200, same blob `ca3e047`), original placement and code path in `WarmupRoutine`; "© Neila Rey" / neilarey.com printed on the artwork kept. Store builds swap `assets/exercises/index.ts` for a stub via `metro.config.js` (EAS profile `production` or `GYMRAT_STORE_BUILD=1`). Verified: `expo export` dev bundle contains the JPEG (same SHA-1), store and production exports contain none; guard test. Simulator: renders in Light, Dark, True Black (`16`–`18-warmup-poster-*.png`). The unused hip_rehab sheet stays removed |
| 6 | RepDB attribution | Kept | Settings › About + per-illustration line; guard test |
| 6 | No tracking/analytics | Confirmed | No SDKs added; dependency list below |
| 7 | Apple account safety | Done | No `eas` command run at all (not even `whoami`). See below |
| 8 | Verification | See tables | Physical iPhone: **never run** |

## Native modules and configuration
- **New dependencies (via `npx expo install`, SDK 58):** `expo-notifications ~58.1.7`, `expo-widgets ~58.0.26`, `@expo/ui ~58.0.26`, `expo-keep-awake ~58.0.3`, `expo-battery ~58.0.3`, `react-native-webview 14.0.1`, `react-native-youtube-iframe ^2.4.1`.
- **Local module `modules/gym-native`:** `GymHealth` (isAvailable, authorizationStatus, requestAuthorization, saveWorkout, deleteWorkout) and `GymFileProtection` (protectDirectory, protectionOf). Autolinked; null in Jest/web.
- **app.json:** `ios.entitlements` `com.apple.developer.healthkit`, `com.apple.developer.default-data-protection = NSFileProtectionCompleteUnlessOpen`; `ios.infoPlist.NSHealthUpdateUsageDescription`; `locales` en/ar for usage strings (`i18n/native/*.json`, also localises the existing camera/photos strings); plugins `expo-notifications` (`enableRemoteNotifications: false`, rest sound) and `expo-widgets` (no push, no frequent updates).
- **Generated by expo-widgets:** extension `com.gymrat.app.ExpoWidgetsTarget`, App Group `group.com.gymrat.app` on app + extension, `NSSupportsLiveActivities`.
- **Schema v10:** `health_exports` ledger.

## Permissions and privacy review
| Data / capability | Leaves the device? | Notes |
|---|---|---|
| Workout start/end/pauses → Apple Health | To the on-device Health store only (Health's own iCloud sync is Apple's, under the user's Health settings) | Opt-in, write-only, no energy/heart data, metadata = session id + indoor flag |
| Rest notification | No (local) | Generic text, no exercise or weight on the lock screen |
| Live Activity | No (local) | Shows day code + exercise name + timers on the lock screen; the user can turn it off in Settings or iOS |
| YouTube | Yes, only after tapping play | Request to YouTube (Google) with origin `https://com.gymrat.app`; subject to YouTube's privacy policy. Mention in App Store privacy labels |
| SQLite (workouts, body measurements, goals) | No | Protected as below |

**Data protection.** iOS default for app files is *Complete Until First User Authentication*. Now *Complete Unless Open*: closed files (backup copy, any file after the app exits) are unreadable while the phone is locked; the open database stays writable so the background WAL checkpoint and a lock mid-workout keep working. *Complete* was rejected because it breaks writes after lock. Existing installs are upgraded at boot. On the simulator the class is set (boot log: 5 items) but not enforced; enforcement needs a device.

**Backup — owner decision needed (not changed).** The database is still included in iCloud/Finder device backups (decision D9 default).
- Keep in backup (current): workouts, body measurements and goals survive a lost or replaced phone; iCloud Backup is end-to-end encrypted only with Advanced Data Protection, otherwise Apple holds the keys; encrypted Finder backups are protected by the user's password.
- Exclude (`isExcludedFromBackup`): nothing personal sits in backups, but a phone restore loses all history, and the app has no export (spec bans in-app backup), so data loss would be total.
Recommendation: keep it in backups; state it in the privacy text. Owner to confirm.

## Apple account safety
- No EAS command was run; the CLI login on this Mac (another person's account) was not used or inspected.
- Verified in config: Apple Team `8TBB6SU34J` (app.json + generated project), bundle id `com.gymrat.app`, extension `com.gymrat.app.ExpoWidgetsTarget`, app group `group.com.gymrat.app`. `app.json` has no `owner` / `extra.eas.projectId`, so the intended Expo account cannot be verified from the repo.
- Owner steps before any device or cloud build: `eas logout`, then `eas login` with the owner's own account in the owner's terminal (`! npx eas-cli@latest login` here), and register `com.gymrat.app` with HealthKit + App Groups and the extension id in the owner's team (automatic signing does it on first device build). Never share passwords or 2FA codes in chat.
- Nothing was submitted to TestFlight or the App Store.

## Simulator results (Arabic RTL unless noted)
Driven with AXe on the `GymRAT-Phase4` simulator (iPhone 16 Pro, iOS 26.3) with the Phase 5 build installed over the Phase 4 build. A fresh simulator was created first but did not accept injected touches on this Xcode (no Simulator.app); it was deleted. The Phase 4 app data was backed up before reuse.
| Flow | Result |
|---|---|
| Upgrade real Phase 4 DB | `migrated 7 → 10`, rows intact; file protection applied |
| Settings › iPhone in ar/en, Light, Dark, True Black | Mirrored in Arabic; screenshots 01, 13, 14, 15 |
| Rest alerts toggle | iOS prompt → Allow → on |
| Apple Health toggle | Write-only sheet → Allow → on |
| Start workout → log set → rest 2:00 | Live Activity started then updated; notification scheduled |
| Background (other app) during rest | Banner "Rest over" delivered once at rest end; activity marked stale |
| Return to app | rest marked elapsed, no second chime |
| Pause 22 s → resume → finish | activity updated twice, removed on finish; Health: 1 workout with pause events |
| Edit (Phase 4 "one day earlier") | Health copy replaced (still 1) |
| Delete workout | Health 0, ledger 0 |
| Start → kill → relaunch | same activity adopted, no duplicate |
| Discard workout | activity removed |
| Exercise video | idle card with "needs internet", tap → player ready → plays inline |

## Physical-device-only (pending)
1. Live Activity appearance on the Lock Screen and Dynamic Island (compact, minimal, expanded), in Arabic and English, light/dark; timer accuracy over 2+ minutes locked.
2. Rest notification with the phone **locked**, silent switch on/off, Focus modes; custom sound.
3. Keep-awake during a workout; release when paused and in Low Power Mode.
4. Data protection enforcement (lock 10 s+, confirm the closed backup file is unreadable; app keeps working after lock mid-workout).
5. HealthKit on a real Health store: workout appears once in Fitness/Health, edit/delete reflected, denial path; Watch-paired behaviour.
6. Haptics feel (finish, pause/resume).
7. YouTube on cellular/offline/airplane mode; fullscreen rotation.
8. Signing with the owner's team: HealthKit + App Groups capabilities, widget extension provisioning.

## Known issues
- Live Activity follows the **system** language/direction, not the in-app language override.
- Arabic strings (including Health usage text) are machine-authored; owner review pending.
- YouTube list reviewed by title/channel only; owner approval (D11) pending; 3 exercises have no video.
- Keep-awake is held only while the workout screen is mounted; minimising the workout to another tab lets the screen sleep (by design).
- Custom exercise photos created before this build keep their old protection class (new files inherit the entitlement).
- The HealthKit sheet and usage text follow the system language, like the Live Activity.
- Blocking of "Watch on YouTube"/logo navigation is verified in Jest only, not tapped on the simulator.
- Simulator taps via AXe need `--tap-style physical` on this setup (tooling, not app).
- `lib/format` Arabic-Indic digits / "kg" on other tabs (carried from Phase 4).

## Phase 6 release blockers
- **Neila Rey poster:** excluded from store builds automatically, but a TestFlight/App Store binary must be produced with the `production` EAS profile (or `GYMRAT_STORE_BUILD=1` for a local archive, Metro started with `--clear`). Shipping it requires documented redistribution rights or permission. A `preview` (internal) build includes it.

Physical-device items above; owner EAS login and App ID capabilities; backup decision; D11 video approval; Arabic copy review; App Store privacy labels (YouTube network use, Health write); release checklist §9 lines not yet green (device sizes, VoiceOver, performance, production build).

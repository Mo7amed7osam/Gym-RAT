# TestFlight preparation — Gym RAT 1.0.0 (1)

**Prepared:** 2026-11-03 at main `866dd27`. **Nothing uploaded. Nothing submitted.** Placeholders marked `TBD` are owner-supplied; none were invented.

## Version
- Marketing version `1.0.0`, build `1` (app.json `ios.buildNumber`, Info.plist, widget extension all agree). First TestFlight build; no bump needed. Each later upload needs `buildNumber` incremented in app.json and `ios/` regenerated, or the number edited in Xcode.

## Icon and launch screen
- `assets/images/icon.png` 1024×1024, no alpha (App Store requirement met). `ios/GymRAT/Images.xcassets/AppIcon.appiconset` generated from it.
- Launch: `SplashScreen.storyboard`, black background, logo from `splash-icon.png`.

## App Store Connect record (owner)
- Bundle id `com.gymrat.app` (+ `com.gymrat.app.ExpoWidgetsTarget`, App Group `group.com.gymrat.app`) on team `8TBB6SU34J`. The identifier has never been confirmed as registered to this team; Xcode's automatic signing registers it on the first successful signed archive, or create it in the developer portal. If it is taken by someone else, pick a new id (changes the widget id and App Group too).
- Create the app record in App Store Connect with that bundle id, name "Gym RAT", primary language English, category Health & Fitness.
- Privacy policy URL is required (HealthKit). `TBD`.
- App Privacy: data collected = email address + name (account, linked to identity, not used for tracking); health data stays on device/Health. No tracking (`NSPrivacyTracking` false).
- Export compliance: `ITSAppUsesNonExemptEncryption` false already in Info.plist.

## Beta description (TestFlight → Test Information)
Gym RAT is a private, offline-first strength training tracker for invited members. Log sets and reps, follow a rotation plan, get rest timers in the Dynamic Island, see PRs and progress analytics, and save finished sessions to Apple Health. English and Egyptian Arabic. Accounts are created by the owner; there is no sign-up in the app.

## What to Test (build 1.0.0 (1))
1. Sign in with the test account you received by email. Password recovery from the sign-in screen.
2. Complete onboarding, start today's workout, log sets, use the rest timer. Check the Dynamic Island and the rest notification with the phone locked.
3. Force-quit mid-workout and relaunch: the workout should continue where it was.
4. Finish a workout and confirm it appears in Apple Health as Strength Training.
5. Switch to Arabic (Settings) and check layout and wording. Try Light, Dark and True Black.
6. Put the phone in Airplane Mode and keep using the app; it should stay signed in.
7. Sign out and back in; your history must still be there.
Report: what you did, what you expected, what happened, with a screenshot. Mention device and iOS version.

## Tester login instructions
- Accounts are invitation-only. The owner creates the tester in the admin dashboard; the invitation link arrives by email (72 h validity). Open it on any device, set a password (12+ characters), then sign in inside the app.
- Server: `TBD` (the production HTTPS origin baked into the build; testers never enter it).
- Dedicated test account: `TBD` — cannot be created until the server is deployed with SMTP configured (the dashboard refuses to create members without SMTP). Create it with a neutral display name and an owner-controlled mailbox; never reuse the owner's own account, so no real workout data reaches testers.
- Apple App Review (later, not TestFlight): guideline 5.1.1 needs a demo account in the review notes. Use a second dedicated account, not the tester one.

## Permission strings shipped (Info.plist, EN + AR localised)
| Key | Text |
|---|---|
| NSHealthUpdateUsageDescription | Gym RAT saves each finished workout to Apple Health as a strength-training session (start, end and pauses only). It never reads your Health data. |
| NSPhotoLibraryUsageDescription | Gym RAT uses your photos to illustrate custom exercises you create. |
| NSCameraUsageDescription | Gym RAT uses the camera to photograph custom exercises you create. |
| NSFaceIDUsageDescription | Allow $(PRODUCT_NAME) to access your Face ID biometric data. (expo-secure-store default; see audit, low) |
| Notifications | Requested at runtime for rest alerts (local only; no remote push). |

## Upload (owner decision only)
Not performed. When approved: Xcode → Organizer → Distribute App → App Store Connect → Upload, or `xcrun altool`/Transporter with the owner's own App Store Connect API key. Run `scripts/release/check-unlicensed-assets.sh <ipa>` on the exact file first (it no longer lists the Neila Rey poster, which ships by owner decision; ADR-020).

## Third-party content
The Neila Rey warm-up poster is included in this build by owner decision (ADR-020). No licence or permission is on file; redistribution rights are unverified. App Review may question it under guideline 5.2.1.

# Physical iPhone checklist — iPhone 16 Pro Max

**Date prepared:** 2026-11-03 · **Build under test:** main `866dd27` (to be rebuilt once `EXPO_PUBLIC_AUTH_API_URL` is set) · **Status: NOT RUN.** Nothing below has been performed on a physical device. Tick a row only after doing it on the phone.

Prerequisites: iOS 26.x on the device; the production auth server reachable over HTTPS from mobile data (not only Wi-Fi); one tester account that has never held real workout data; Developer Mode on if installing a development-method IPA.

| # | Area | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Fresh install | Delete any previous Gym RAT. Install the IPA (TestFlight or Xcode Devices). Launch. | Splash → sign-in screen. No crash, no "server not configured" message. | ☐ |
| 2 | Login | Enter the tester email + password. Tap sign in. | Onboarding appears (first sign-in). Wrong password shows the error text, not a hang. | ☐ |
| 3 | Session persistence | Finish onboarding. Force-quit (swipe up). Relaunch. | Opens straight to Today; no sign-in prompt. Settings → Account shows the email. | ☐ |
| 4 | Workout logging | Today → start a workout → log 3 sets on 2 exercises (weight + reps, Arabic-Indic digits once) → finish. | Sets persist between exercises; finish writes a session visible in Progress → History. | ☐ |
| 5 | Force-quit recovery | Start a workout, log 2 sets, start a rest timer, force-quit mid-rest. Relaunch. | Workout resumes with both sets and the rest timer at the right remaining time; nothing duplicated. | ☐ |
| 6 | Dynamic Island / Live Activity | During a workout with rest running, lock the phone, then long-press the Dynamic Island. | Rest countdown shown in the Island (compact + expanded) and on the Lock Screen. Ends when rest ends. | ☐ |
| 7 | Rest notifications | Grant notifications on first prompt. Start rest, background the app. | Alert + custom "rest complete" sound fires at zero; tapping it opens the workout. Dismissal after the fact does not re-fire. | ☐ |
| 8 | Apple Health | Finish a workout. Grant Health write permission when asked. Open Health → Workouts. | One Strength Training workout with the right start/end; nothing read from Health. Toggle off in Settings and finish another: no new entry. | ☐ |
| 9 | Haptics | Log a set, hit a PR, finish rest. | Distinct haptic on set logged, PR and rest end; Settings toggle turns them off. | ☐ |
| 10 | Keep Awake | Start a workout, leave the phone untouched past the auto-lock interval. | Screen stays on during the workout; locks normally after finishing. | ☐ |
| 11 | Arabic RTL | Settings → language → العربية (or iOS language Arabic). | Entire UI mirrored, Egyptian Arabic strings, weights/reps in Western digits, units كجم. Sign-in screen also Arabic. Switch back to English. | ☐ |
| 12 | Themes | Settings → Light, Dark, True Black. Also set iOS to Dark with "system". | Each theme applied immediately on every tab; True Black is pure #000 background; status bar readable. | ☐ |
| 13 | Offline access | Turn on Airplane Mode. Force-quit, relaunch. Log a set. | App opens signed in (lease ≤ 7 days), workout works, "offline" state visible where designed. Turn Airplane off: no sign-out. | ☐ |
| 14 | Logout and re-login | Settings → Account → sign out. Confirm. Sign in again with the same account. | Returns to sign-in; local history untouched; after re-login history is intact; a second account sees an empty database (account isolation). | ☐ |
| 15 | Revocation (optional, admin) | Admin disables the account in the dashboard; foreground the app online. | App signs out with the "account disabled" message; local data kept. | ☐ |
| 16 | VoiceOver | Enable VoiceOver; swipe through sign-in, Today and one set row. | Every control announces a label; set row reads weight and reps; no unlabeled buttons. | ☐ |

Record device model, iOS version, build number and date at the top when run. File results in `.10x/reviews/` as `2026-MM-DD-device-run.md`.

# Phase 1 — Foundation & Premium UI: change summary, evidence, limitations

**Branches:** `phase1/m0-test-harness` … `phase1/m8-reset-build` (one per milestone, fast-forwarded into `main`).
**Gates on every milestone:** `npx tsc --noEmit`, `npx expo lint`, `npx jest` (80 tests, 4 protected-UI snapshots), simulator run where native code changed.

## What changed (by milestone)
| M | Delivered | Evidence |
|---|---|---|
| M0 | Git repo, Jest harness, 41 baseline tests on `lib/` and the store | `npm test`; coverage ≥95% stmts on the four target modules |
| M1 | Sync/server removed; persist v3 | no `lib/sync.ts`, `server/`; store has no `syncQueue` |
| M2 | Cool-down and fixed weight increment removed; persist v4 | ActiveWorkout: Warm-up/Workout only; last exercise → finish |
| M3 | SQLite write-through persistence (ADR-002), importer, backup-before-migrate | simulator DB: `user_version`, WAL, tables, legacy session imported, `gymrat.backup.db` created on v1→v2 |
| M4 | Plans + rotation (ADR-003), session reducer (pause/active time/do-later), Today rewrite, History per plan day | schema v2 on the simulator; legacy history auto-adopted the PDF program |
| M5 | Theme system (ADR-005): light/dark/true black/system, 6 accents, text scale, density | simulator screenshots in system dark and light; snapshots unchanged |
| M6 | i18n EN/AR, locale-aware dates, language setting, `LocaleProvider`, RTL via `supportedLocales` | Arabic simulator screenshots: strings, tabs, dates, and full RTL mirroring |
| M7 | Four tabs, Plan and Library shells, onboarding behind protected routes | fresh install on a second simulator shows onboarding |
| M8 | Reset All Data, storage status, `eas.json`, app config for iPhone-only builds | code + tests; reset tap is owner-verified |

## Protected UI
`components/SetRow.tsx` and the grid/tiles/footer of `components/ExerciseCard.tsx` were not edited in any milestone except for theme-token and string-key substitution. RNTL snapshots taken before M5 pass after M5–M8 (one snapshot updated for a merged text node with identical rendered text).

## Owner verification checklist (Appendix D)
- [ ] Dev build on a physical iPhone (blocked by D5: Apple credentials). Simulator builds verified.
- [ ] Kill test: log a set, force-quit within 1 s, relaunch → set present (10 runs). Jest proves the write commits before state applies; the physical test is yours.
- [ ] Theme switch: System / Light / Dark / True Black + accents in Settings → Appearance.
- [ ] Arabic end to end: Settings → Language → العربية, restart app, check layout direction and strings. Arabic text is a machine-authored draft; please correct freely in `i18n/ar.ts`.
- [ ] Reset All Data → onboarding appears; complete onboarding → Today shows the Starter plan.
- [ ] Rotation: finish a workout → next day queued regardless of weekday; "Repeat next time" on the summary; Plan tab "Make next".
- [ ] Pause during a workout: active time stops; summary shows "x active".

## Known limitations / tech debt carried into Phase 2
- Full Body Starter content is a draft pending D4; the PDF program is the active plan on installs that had history.
- Plan editor, exercise library illustrations (ADR-004 mapping), embedded YouTube, custom exercises: Phase 2.
- Progress tab = the existing History screen until Phase 4.
- Language switch changes strings immediately; layout direction applies on next launch (no `expo-updates` reload in dev builds).
- Arabic dates use Arabic-Indic digits in some `Intl` outputs (calendar strip uses Western digits); D8 digit policy to confirm.
- Splash screen is black in light mode (needs `expo-splash-screen` `dark`/light variants).
- `getDayHistory` matches by raw id while screens use `isSessionForDay`; `nextIndexAfterHistory` has a dead `endsWith` branch; README still describes the weekday schedule.
- `completeSet` writes two transactions (session, then rest timer); a kill between them loses only the timer.
- Persistence errors are logged and shown in Settings → Storage, not as an in-flow toast yet.
- No EAS project/login yet; `eas.json` is ready but untested against a real account.

## Not exercised in this session (owner will meet these first)
- Reset All Data end to end (needs a tap); `resetAllData` re-runs boot without a visible loading state.
- In-app language switch via Settings (`applyLayoutDirection` + "restart to apply"): only device-language launch was tested.
- Onboarding beyond the welcome step on device (plan adoption from onboarding, body-input parsing are not unit-tested).
- Plan tab "Make next" / "Use this plan" and Library search on device (logic covered by store tests only).
- `ios/` is Continuous Native Generation output (gitignored) and was regenerated three times this session (expo-sqlite, interface style, expo-localization). A checkout with a stale `ios/` must run `npx expo prebuild --platform ios` before `npx expo run:ios`.

## Verification still open at time of writing
- RTL layout after the `supportedLocales` rebuild: **verified** on the simulator launched with `-AppleLanguages (ar)` — header, rotation strip, hero, week calendar, figures and tab bar all mirror; numbers stay Western.

# Gym RAT — Master Plan v3 (exercise media direction updated)

Planning document only. No application code, dependencies, assets, or project files were changed. Verified facts cite their source; anything not seen verbatim in a fetched page is marked **unverified**.

**Approval note.** Accepting this document means the plan is accepted for review. It is not authorization to begin Phase 1. Phase 1 begins only on an explicit "start Phase 1" from the owner (workflow §26).

---

## 1. Summary of changes

### v3 (this revision): exercise media direction

| Area | v2 | v3 |
|---|---|---|
| Exercise demonstration | Original procedural looping animations; Blender pipeline; PoC gate; 100% animation coverage as TestFlight gate | **Static illustrations.** RepDB free-tier start/end stills where the match is exact; optional embedded YouTube tutorials in-app; no animation work of any kind. |
| Blender / PoC / Appendix E | Authorized standalone experiment | **Cancelled and deferred.** Removed from roadmap, milestones, risks, checklist. Nothing was installed or created. |
| Media release gate | 100% real loops | Every built-in exercise has accurate, legally usable static illustration(s) and instructional content; YouTube curated, embed-verified where feasible, optional. |
| Phase 1 blockers | D1 animation decision | Animation no longer blocks Phase 1. |
| Risk register | Animation labour High | Replaced by illustration coverage/licensing risks (Medium). |

### v2 (previous revision, retained)

Reviewer-driven changes: owner decisions as fixed constraints; program selection process; owner-vs-tester without identity; persistence safety design; Phase 1 split into M0–M8; native compatibility matrix; release checklist; decision list with defaults.

The v1 audit tables (feature inventory, UX treatment, Phases 2–6) remain valid and are kept in Appendices A–C.

---

## 2. Updated architecture decisions

### 2.1 Fixed constraints (owner decisions; override anything the codebase implies)

1. Existing PDF program: reference material only. Never the default. Never auto-seeded as the personal plan.
2. Exactly one active plan; Workout Rotation, not weekdays.
3. Local only. No accounts, cloud, sync, or in-app backup/export feature.
4. No post-workout cool-down.
5. Kilograms and centimetres only.
6. Sets Logging UI stays visually recognizable and structurally the same.
7. **Exercise media = consistent static illustrations (RepDB free tier where accurate) + optional embedded YouTube.** Free assets only. No animation production.
8. All agreed features complete before the first TestFlight build.

**Conflicts still open (flagged, not resolved):**
- C1. RepDB free tier covers the current 38 exercises only partially with *exact* matches (20 matched, ~17 nearest-variant, 1 none; two filename ranges unread). Rule 12 ("never substitute an incorrect variation") means those exercises need either a confirmed exact RepDB id, a renamed/reselected exercise in the program, or a non-RepDB illustration in the same style. Resolved per exercise during program selection (§3.4).
- C2. "Do not automatically share the owner's plan" vs "no identity": resolved by interpretation in §4.3; needs owner confirmation.
- C3. iOS system backups include the app sandbox by default. Spec bans an in-app backup *feature*, not OS backup. Default: leave OS behaviour; owner to confirm.

### 2.2 Stack (verified)

Expo SDK 58.0.22 / React Native 0.88 / React 19.3 / Expo Router / TypeScript strict / Zustand. Development builds from Phase 1. SDK 58 minimums: iOS 16.4, Xcode 26.4, Node 22.13+ (https://docs.expo.dev/versions/v58.0.0/). Generated Xcode project already targets 16.4 (`ios/GymRAT.xcodeproj/project.pbxproj:364`).

### 2.3 Layering

```
src/app/            Expo Router routes (thin re-exports; existing pattern)
src/features/*      screens and feature components per domain
src/components/ui/  design-system primitives (existing, extended)
src/domain/*        pure TypeScript: models, session reducer, math, PR engine, recommendations, analytics
src/data/*          SQLite schema, migrations, repositories, seed templates, exercise library, media manifest
src/services/*      health, liveActivity, notifications, media, youtube, feedback
src/store/*         Zustand runtime state; DB is the source of truth
src/theme/*         tokens + ThemeProvider + useStyles
src/i18n/*          dictionaries + hooks
```

### 2.4 Key model decisions

- **Plan / rotation.** `plans` (one `is_active`), `plan_days` (ordered), `plan_exercises`. Rotation pointer `plans.next_day_index`; advanced on "Finish and advance", unchanged on "Finish and repeat" or on skipped days. Calendar = query over `sessions.started_at`. Today-only edits go to the session snapshot; permanent edits to `plan_exercises`.
- **Templates.** `plans.kind ∈ {active, template, reference}`. Bundled: Full Body Starter (template, default on fresh install), approved program (template), PDF program (reference). Template starts create `sessions.kind = 'template'` extra sessions that do not move the rotation pointer.
- **Session state machine.** `idle → active ⇄ paused → reviewing → completed | discarded`; `paused_intervals`, `exercise_order`, `deferred_ids`, `warmup_duration_ms`, `ended_at_override`, `notes`. Pure reducer in `domain/session/`.
- **Exercises.** Runtime table (built-in + custom, `archived`, `weight_type`, `is_unilateral`, instructions, breathing, ROM, mistakes, alternatives, user notes). Sessions snapshot the prescription (existing pattern, `types/workout.ts:198-199`). Compile-time `ExerciseId` union (`data/exercisesData.ts:551`) replaced by runtime validation.
- **Media (updated).** See §3.
- **PRs** derived into `pr_cache` inside the same transaction as any history change.
- **Rest timer** keeps the timestamp model plus scheduled local notification and Live Activity mirror.
- **Theme** via context; **i18n** via `expo-localization` + `i18n-js` + Expo Router `LocaleProvider` (verified SDK 58 guide).

---

## 3. Exercise media strategy (static illustrations + embedded YouTube)

### 3.1 Verified facts about RepDB (sources: repo README, `LICENSE-DATA.md`, `ATTRIBUTION.md`, repdb.co/pricing, repdb.co/license)

- Free tier: 701 exercises; `exercises.json` (schema v3: `name_en/de/es`, `description_*`, `category`, `force_type`, `mechanic`, `difficulty`, `body_part`, `primary_muscles`, `secondary_muscles`, `equipment`, `is_unilateral`, `is_bodyweight`, `instructions_*`, `tips_*`, `met`, `images`); images `images/flat/<id>-start.webp` + `<id>-peak.webp` (or `<id>-main.webp` for holds), 512×512 WebP, "flat-illustration style on a solid designed background"; also `images/muscles/`, `images/equipment/`.
- License "RepDB — Free Tier License (v1.0)": "Free for personal and commercial use inside applications"; "In-app use only"; attribution is a **condition** ("Exercise data by RepDB (repdb.co)" visible in about/credits); no redistribution as a dataset or API; images "may be resized, cropped, or recolored for in-app use" (upscaling/background removal = derived dataset, not allowed); no generative-AI derivation; premium samples evaluation-only.
- Bundling inside an app binary is "inside applications" → permitted for the free stills. TestFlight not named; no cap on exercises/users.
- Repo active (last push 2026-10-29, 0 open issues). Images are RepDB's own AI-generated originals; no third-party media credits.
- Coverage of the current 38 exercises by file name: 20 matched (15 verbatim, 5 from a tool summary), ~17 nearest-variant only, 1 none (`leg_press_calf_raise`); `barbell-*` and `pec-deck`/`paused-*` ranges unread. Cardio icons exist (`treadmill-running`, `stationary-bike`, `elliptical-trainer`).

### 3.2 Rules

1. RepDB images used only where the exercise match is **exact** (same movement, equipment, and grip/stance variant). Nearest variants are never substituted, in development or release.
2. Images are bundled unmodified except resize/crop/recolour permitted by term 4. No upscaling, no background removal, no AI processing.
3. Attribution "Exercise data by RepDB (repdb.co)" on the About/Credits screen (link), plus per-exercise provenance in the data.
4. Where RepDB has no exact match, the exercise either (a) gets an alternative illustration in a matching flat style with its own recorded license, (b) is replaced in the program by an exactly-matched equivalent during program selection (owner decision), or (c) ships with a clearly labelled "No illustration" card (last resort; counted in the coverage report).
5. YouTube is optional, in-app, never auto-redirects to the YouTube app; fullscreen allowed where the player permits; graceful fallback when unavailable or embedding blocked.
6. Custom exercises: user-provided photo(s) via the camera roll, or the labelled fallback.
7. The existing PDF photos (`assets/exercises/*.jpg`) are removed from the bundle (unconfirmed rights, inconsistent style).

### 3.3 Media architecture

- **Manifest** `exercise-media.json`, generated by a script from the asset folder: `{ exerciseId, kind: 'still_pair' | 'still_single' | 'user_photo' | 'none', start?, end?, source: 'repdb' | 'original' | 'user', license, attribution, width, height }`. Hand edits forbidden; CI lint fails if any built-in exercise lacks an entry other than `none`, and prints a coverage report.
- **Import script** (Phase 2): copies only the explicitly mapped RepDB files by exact id into `assets/exercise-media/`, records SHA-256 + license per file, and never touches unmapped files. The mapping table (`exerciseId → repdbId`) is reviewed by the owner.
- **Renderer:** `expo-image` (verified: WebP on iOS, `cachePolicy`, local `require()`, `allowDownscaling`, `recyclingKey`). Start/end presentation: a two-frame card with "Start" / "End" labels, swipe or tap to toggle, or side-by-side at larger widths. Not animated; labelled as positions.
- **Detail screen content:** illustration(s), primary/secondary muscles, equipment, weight type, instructions, breathing, range of motion, common mistakes, alternatives, personal notes, history and PRs, optional video.
- **YouTube:** `react-native-youtube-iframe` + `react-native-webview` (webview in Expo's SDK 58 third-party list; iframe lib 2.4.1, pushed 2026-09). Curated `youtube_video_id` per exercise with `embeddable: boolean | null` and `checked_at`. Policy (verified): player ≥ 200×200, no overlays, Referer header set, OS WebView. Owner-disabled embeds (error 101/150, from a summary, unverified codes) → fallback card "Video unavailable" with retry; no external redirect. Fullscreen via the iframe player's own control where available.
- **Reduced motion / offline:** images are static, so reduced motion needs nothing; images are bundled and work offline; video needs internet and says so.
- **Storage:** ~76 WebP stills at 512² ≈ 1.5–2.5 MB total. Negligible.

### 3.4 Coverage workflow (tied to program selection)

1. Program selected (§4) → built-in exercise list fixed.
2. For each exercise, find an exact RepDB id (read the two unread filename ranges first). Record exact / none.
3. Owner reviews the mapping table and the "none" list and decides per rule 4 (a/b/c).
4. Import script runs; lint confirms coverage; coverage report attached to the Phase 2 change summary.
5. YouTube curation: one verified-embeddable tutorial per exercise where feasible; recorded with `checked_at`.

### 3.5 Removed from the roadmap

Blender installation, procedural character/rig, motion specs, animation production, animation PoC, animated WebP generation, animation effort estimates, and the 100% animation coverage gate. Nothing from these items was ever installed, created, or run.

---

## 4. Plan selection and onboarding strategy (unchanged from v2)

### 4.1 Program selection process
1. Owner questionnaire: goal, experience, days/week, session length, equipment access, injuries/avoid list, exercise preferences, current working weights (kg).
2. Shortlist 2–3 published, free, reputable programs matching days/week; sources fetched and cited at that checkpoint. (No program is named as verified now.)
3. Comparison table: frequency, weekly sets, progression scheme, exercise count, equipment, session length, **RepDB exact-match coverage of the exercise list**.
4. Owner approves one → encoded as a locked template. PDF program encoded as `reference`.

### 4.2 Full Body Starter Plan
3 days/week, ~6–8 exercises/day, drawn only from exercises with exact RepDB illustrations. Content approved before seeding.

### 4.3 Owner vs tester without identity
What is personal is the owner's **instance** (weights, history), not the program definition. Bundle ships Starter (default), approved program (selectable template), PDF program (reference). Onboarding: Start with Starter · Choose a template · Build my own (Phase 2; until then "set up later"). No identification, no network. Needs owner confirmation (D3).

---

## 5. Persistence safety design (unchanged from v2)

Engine `expo-sqlite`. Verified APIs: `openDatabaseAsync`, `runAsync`, `getAllAsync`, `withTransactionAsync`, `withExclusiveTransactionAsync`, `runSync`, `getAllSync`, `execSync`, `withTransactionSync`, `closeAsync`, `backupDatabaseAsync`, `serializeAsync`, WAL recommended. Summary-only: `openDatabaseSync`, `deleteDatabaseAsync`, change listener. No Expo guidance on `PRAGMA synchronous`.

| Requirement | Design |
|---|---|
| Explicit ack | Mutations run `withTransactionSync` in one repository module; UI marks a set logged only after commit returns. |
| Atomic set completion | One transaction: `sets`, `sessions.updated_at`, `session_exercises.current_set`, rest-timer state. |
| Transaction boundaries | One transaction per reducer event; migrations one each; PR cache rebuild in the triggering transaction. |
| Concurrency | Single writer on the JS thread via the sync API; background tasks never write; side effects after commit, idempotent. |
| Interrupted writes | WAL + `synchronous = NORMAL` (D7); `PRAGMA quick_check` on open; restore latest backup on failure with a non-destructive error. |
| Migration validation | `backupDatabaseAsync` before; transaction; `quick_check` + row-count assertions + `user_version` bump; failure → rollback, restore, halt. Backup kept until next successful launch. |
| Preserve original data | AsyncStorage key `gym-rat/workout-store` imported in one transaction, counts verified, key **renamed** (never deleted). |
| Termination / background | No pending writes; `wal_checkpoint(TRUNCATE)` on background; re-read active session on foreground. |
| Platform limits | iOS can kill at any instant; uncommitted work is lost by design; disk-full/corruption need the backup; OS device backups include the sandbox (C3). |
| Tests | Jest against `better-sqlite3` with identical SQL; on-device: 100 rapid completions; 10× force-quit after log; kill mid-migration. |

---

## 6. Phase 1 milestones (updated: no animation PoC in parallel)

Sets Logging UI (`components/SetRow.tsx`, grid/tiles/footer in `components/ExerciseCard.tsx`) is not edited in any Phase 1 milestone; M5 changes only its colour tokens via the theme hook. Rollback for every milestone: revert the branch; M3/M4 additionally restore the pre-migration backup.

| M | Objective | Scope / files | Depends | Tests | Acceptance | Owner verifies |
|---|---|---|---|---|---|---|
| M0 | Git + test harness | `git init`, baseline; Jest (`jest-expo`); tests for `lib/workoutMath.ts`, `lib/parseNumber.ts`, `lib/format.ts`, rest-timer helpers | — | New suite; tsc/lint/doctor | Suite green, ≥90% on those modules, behaviour unchanged | `git log`, `npm test` |
| M1 | Remove sync/server | Delete `lib/sync.ts`, `server/`, `.env.example`; `app/_layout.tsx:49`; store `syncQueue`/`SyncOp`/`ackSyncOps`; persist v2→v3 dropping `syncQueue`; Settings sync row `screens/SettingsScreen.tsx:104-115` | M0 | v2→v3 migration test | No network code; existing data loads | Settings has no sync row; history intact |
| M2 | Remove cool-down + weight increment | `screens/ActiveWorkoutScreen.tsx:34-38, 240-242, 274`; `types/workout.ts:237, 276`; `screens/TodayDashboardScreen.tsx:395`; `data/scheduleData.ts:248`; keep stretch data for warm-up | M1 | Finish-flow tests | Finish → summary directly | Run and finish a workout |
| M3 | SQLite behind existing store facade | `expo-sqlite`; schema v1; repositories; WAL/synchronous; integrity check; AsyncStorage importer with verification + rename; backup framework; remove `store/batchedStorage.ts`; screens unchanged | M2; dev build | Repo/migration/importer tests on better-sqlite3; device kill tests | Kill test 10/10; counts match; screens unchanged | Log set, force-quit, relaunch |
| M4 | Plan/rotation + session reducer | `plans`/`plan_days`/`plan_exercises`; seed PDF as reference + placeholder Starter; rotation pointer; `domain/session/` reducer (pause, active time, order, deferred); importer maps weekday/routine → plan-day; Today hero = next in rotation; week strip → calendar; week-start setting replaces Saturday constants (`lib/workoutMath.ts:186`, `lib/format.ts:58-62`) | M3 | Reducer + rotation + mapping tests | Missed day does not skip; advance/repeat; pause excluded; grid untouched | Finish, see next queued; pause and check active time |
| M5 | Theme system | `theme/` from `constants/theme.ts`; `useStyles`; migrate ~15 stylesheets; `userInterfaceStyle: automatic`; appearance settings | M4 | Snapshots per screen per theme; grid snapshot | Four modes + accent at runtime; no hard-coded colours (lint) | Switch modes; grid looks the same |
| M6 | Localization + RTL | `i18n/`; string extraction; `expo-localization` plugin; `LocaleProvider`; language switch with reload; RTL audit; digits per D8 | M5; dev build | Screenshot review in Arabic; digit tests | No untranslated strings; no broken mixed-direction layouts | Arabic end-to-end workout |
| M7 | Four tabs + onboarding | Today/Plan/Progress/Library (Plan, Library functional placeholders); onboarding (goal, experience, body info, rest prefs, plan choice Starter/template/later), skippable; `onboarding_complete` | M6 | Navigation + onboarding state tests | Fresh install → onboarding → Starter → Today | Fresh install flow |
| M8 | Reset All Data + build config | Reset (DB, settings, flag, sandbox media) → onboarding; `eas.json`; bundle id/team (D5); `runtimeVersion`; `usesNonExemptEncryption`; `supportsTablet: false`; dev build on device | M7; Apple creds | Reset test; build | Reset returns to first launch; dev build installs; Appendix D green | Reset, re-onboard, kill-test again |

Each milestone also records: risks (listed in v2 detail, unchanged), rollback = revert branch (+ restore backups for M3/M4).

### Phases 2–6 (media-related updates only; otherwise Appendix C)

- **Phase 2** gains: RepDB exact-match mapping table → owner review → import script → manifest + lint → Library detail screen with start/end card and instructional content; YouTube curation list (ids, embeddable check). Loses: animation pipeline integration.
- **Phase 5** keeps embedded YouTube (`react-native-youtube-iframe` + `react-native-webview`) with fullscreen and fallback; adds nothing animation-related.
- **Phase 6** gate updated (§9).

---

## 7. Native compatibility matrix (animation row updated)

| Capability | Package / API | Verified | Unverified / notes | Native integration |
|---|---|---|---|---|
| Platform | Expo SDK 58.0.22, RN 0.88, React 19.3 | Min iOS 16.4, Xcode 26.4, Node 22.13+; built for iOS 27 | Legacy Architecture removal not confirmed | CNG only |
| Deployment target | pbxproj 16.4 | Matches SDK minimum | — | Generated |
| Persistence | `expo-sqlite` | Sync + async APIs, transactions, WAL, backup, serialize | `openDatabaseSync`, change listener summary-only | Config plugin |
| Live Activities | `expo-widgets` | `createLiveActivity`, start/update/end, `staleDate`, Dynamic Island regions, isolated runtime, no experimental label | Foreground-start rule, update budget, overall iOS min not stated; Dynamic Island hardware not verified; Apple 8 h active / 4 h linger verified | Config plugin |
| HealthKit | `@kingstinct/react-native-healthkit` 16.2.0 | Config plugin; React ≥19, RN ≥0.79, Nitro ≥0.35; body fat/heart rate examples | Strength-training enum and save function names not found yet; Nitro on RN 0.88 not stated | Nitro modules (only new native infra) |
| Notifications | `expo-notifications` | `TIME_INTERVAL`/`DATE`, cancel, categories, custom sound, iOS permission fields | Local delivery when app killed = iOS behaviour, not Expo-documented; `timeSensitive` summary-only | Config plugin |
| **Exercise images** | `expo-image` | Static WebP on iOS, `cachePolicy`, local `require()`, `allowDownscaling`, `recyclingKey`, `prefetch` | — | None |
| YouTube embed | `react-native-webview` 14.0.1 + `react-native-youtube-iframe` 2.4.1 | Webview in Expo third-party list; policy ≥200×200, no overlays, Referer | Error codes 101/150 summary-only; iframe lib New Arch status not read | JS + WebView |
| RTL / i18n | `expo-localization` + `i18n-js` + `LocaleProvider` | `supportsRTL`, `forcesRTL`; SDK 58 iOS RTL change; `LocaleProvider` | Runtime switch needs reload (example-based) | Config plugin; dev build |
| Keep awake / dimming | `expo-keep-awake`, `expo-brightness` | Both in SDK 58; brightness persists until lock | Background behaviour not stated | None |
| Custom exercise media | `expo-image-picker` | **Not verified this pass** | Verify before Phase 2 | Config plugin |
| Dev builds / TestFlight | EAS | TestFlight and ad-hoc both need a paid Apple Developer account; submit flow | Free Apple ID for local `run:ios --device` not verified | — |

---

## 8. Risk register (updated)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Data loss on kill (500 ms debounce today) | High | M3 sync transactions + ack + kill tests |
| 2 | Session state corruption | High | M4 pure reducer, exhaustive tests |
| 3 | Scope: 30+ feature areas before TestFlight | High | Milestones; per-phase approval; no MVP redefinition |
| 4 | **Illustration coverage gaps** (RepDB exact matches missing for some exercises) | Medium | Coverage check during program selection; rule 4 options; owner-reviewed mapping |
| 5 | **Media licensing** (RepDB attribution condition; no upscaling/background removal; PDF photos) | Medium | Attribution screen; import script records license + hash; PDF JPGs removed |
| 6 | **Wrong-variant substitution** | Medium | Exact-id mapping only; lint rejects unmapped ids; owner review |
| 7 | YouTube embeds disabled / policy | Medium | Curated ids with `embeddable`; fallback card; no external redirect |
| 8 | Weekday→rotation migration semantics | Medium | Importer mapping; tests |
| 9 | Theme/stylesheet regressions | Medium | Snapshots per theme |
| 10 | RTL breakage | Medium | Dev build; per-screen review |
| 11 | Live Activity limits | Medium | Update on state change only; `staleDate` |
| 12 | HealthKit API names / Nitro on RN 0.88 unverified | Medium | Verify at Phase 5 start |
| 13 | TestFlight signing (paid account, bundle id) | Medium | D5 |
| 14 | Migration failure | Medium | Backup, verify, restore, halt |
| 15 | OS backup includes sandbox (C3) | Low | D9 |
| 16 | Existing on-device data | Low | D6 |

Removed: animation labour, mocap limits, animation PoC risks.

---

## 9. Release acceptance checklist (first TestFlight)

No TestFlight build until every line is green or explicitly waived in writing by the owner.

- [ ] Every agreed feature (spec §4–§20, Appendix A) implemented and demonstrated.
- [ ] **Every built-in exercise has accurate, legally usable static illustration(s)** (exact match only) and instructional content (muscles, equipment, instructions, mistakes, alternatives); lint passes; coverage report attached; any `none` entries explicitly waived by the owner.
- [ ] YouTube: curated tutorial per exercise where feasible, embed-verified with `checked_at`; in-app playback; fullscreen where permitted; fallback card when unavailable; no automatic external redirect.
- [ ] Custom exercises show user media or the labelled fallback; never a wrong illustration.
- [ ] Offline: workouts, plans, history, analytics, images in airplane mode; video states it needs internet.
- [ ] Reliable logging: kill test 10/10; rapid logging; resume after lock/app switch/reorder.
- [ ] Workout Rotation: advance/repeat/skip-day; calendar shows actual dates.
- [ ] PR/analytics match recomputation from raw sets; edits/deletes recompute.
- [ ] Apple Health: one workout per session; graceful denial.
- [ ] Live Activities: compact/expanded rest countdown + current exercise; ends on finish.
- [ ] Notifications: per-category toggles; rest alert with phone locked.
- [ ] Arabic/English full UI; RTL review set passed.
- [ ] iPhone SE-class, 15/16, 16 Pro Max verified.
- [ ] Accessibility: VoiceOver workout flow; large Dynamic Type; reduced motion.
- [ ] Performance: cold start < 1.5 s; 500-session history and 50-card library at 60 fps.
- [ ] Licensing: About/Credits lists "Exercise data by RepDB (repdb.co)" and every other third-party asset; every media row has a recorded license.
- [ ] No known critical or high defects; medium list in tester notes; tester notes state when test data may be reset.
- [ ] `tsc`, lint, doctor, unit suite green; production `eas build` succeeds.

Escalation rule: unmet lines are reported with the measured gap and options; the gate is not redefined.

---

## 10. Remaining owner decisions, with recommended defaults

| # | Decision | Recommended default |
|---|---|---|
| D1 | *(Resolved by owner: static illustrations + embedded YouTube.)* Confirm start/end two-position card as the presentation. | Confirm |
| D2 | Use RepDB `exercises.json` metadata (instructions, muscles, tips) with attribution? | Yes, with attribution; our own EN/AR names and cues kept where better |
| D3 | Confirm owner-vs-tester interpretation (§4.3) | Confirm |
| D4 | Program questionnaire answers; approve shortlist, final program, Starter content; decide rule-4 handling for exercises without an exact RepDB illustration | Answer before M4 ends |
| D5 | Apple Developer Program status; bundle id; team | Provide before M8 |
| D6 | Any real on-device data to preserve? | Assume none; importer still built |
| D7 | `PRAGMA synchronous` NORMAL vs FULL | NORMAL under WAL |
| D8 | Arabic scope and digit style | Full UI; Western digits for weights/reps |
| D9 | Leave iOS system backup default? | Leave default |
| D10 | Keep web target? | Drop |
| D11 | YouTube curation ownership: Claude Code proposes one video id per exercise, owner approves the list? | Yes |

---

## Technical verdict

**Ready for Phase 1 approval?** Yes, pending three answers that do not change engineering scope: D5 (Apple Developer status for dev builds on device, needed by M3's device tests at the latest), D6 (on-device data), D3 (owner-vs-tester interpretation, needed by M7). Media is no longer a Phase 1 blocker. D4 (program + illustration mapping) is needed before M4 completes.

**Unresolved.** Program selection; RepDB exact-match coverage of the final exercise list (two filename ranges unread); HealthKit enum names; `expo-image-picker`; Nitro on RN 0.88.

**First milestone after approval.** M0 (git init + Jest harness + baseline tests).

---

## Appendix A — Existing feature audit (from v1)

Status key: ✅ reusable · 🟡 partial · ❌ incorrect · ⬜ missing · 🗑 obsolete

| Feature | Status | Evidence | Required change |
|---|---|---|---|
| Sets grid (Set · Previous · kg · Reps · ✓) | ✅ | `components/SetRow.tsx`; `components/ExerciseCard.tsx:146-169` | Keep layout; additive behaviour only |
| Target / Rest / Best tiles; Add set; Mark warm-up | ✅ | `components/ExerciseCard.tsx:140-144, 171-195` | Keep |
| Arabic-Indic digit input | ✅ | `lib/parseNumber.ts` | Keep |
| Rest timer model + hook + sheet + pill | ✅ | `types/workout.ts:257-268`; `store/useWorkoutStore.ts:462-527`; `store/useRestTimerCountdown.ts`; `components/RestTimerModal.tsx` | Notification, pre-warning, per-exercise prefs, Live Activity |
| Haptics + chime | ✅ | `lib/feedback.ts` | Per-event settings |
| Prefill + carry-forward | ✅ | `store/useWorkoutStore.ts:153-186, 361-373` | Keep |
| Volume / e1RM / PR detection | 🟡 | `lib/workoutMath.ts:119-180`; `screens/HistoryScreen.tsx:61` | Derive, recompute, 4 kinds, conventions |
| Persistence | 🟡 | `store/batchedStorage.ts:13,46` | SQLite (M3) |
| Resume / finish warning / summary | 🟡 | `screens/TodayDashboardScreen.tsx:421-443`; `screens/ActiveWorkoutScreen.tsx:111, 311-391` | Pause, active time, review step |
| Weekday schedule | ❌ | `data/scheduleData.ts:199-233`; `screens/TodayDashboardScreen.tsx:216-263` | Rotation (M4) |
| PDF program as only plan | ❌ | `data/scheduleData.ts`; `types/workout.ts:106` | Reference template only |
| Cool-down | 🗑 | `screens/ActiveWorkoutScreen.tsx:34-38, 240-242`; `types/workout.ts:237` | Remove (M2) |
| Cloud sync + server | 🗑 | `lib/sync.ts`; `server/`; store `syncQueue` | Remove (M1) |
| Dark-only theme | 🟡 | `constants/theme.ts`; `app.json` | Theme context (M5) |
| Exercise dictionary | 🟡 | `data/exercisesData.ts` | Runtime table, richer schema |
| PDF photos | 🗑 | `assets/exercises/*.jpg` | Remove from bundle; replace with exact RepDB stills |
| Form guide + YouTube search URL | 🟡 | `components/VideoModal.tsx:60-82`; `data/exercisesData.ts:15-19` | Curated ids, in-app embed, fallback |
| History list/delete | 🟡 | `screens/HistoryScreen.tsx:156-230` | Edit, detail, recompute |
| Settings | 🟡 | `screens/SettingsScreen.tsx` | Reset All Data; remove sync/increment |
| Cardio day checklist | ❌ | `screens/TodayDashboardScreen.tsx:363-398` | Cardio logging |
| Tests / git / EAS | ⬜ | none | M0, M8 |

## Appendix B — UX treatment (from v1)

Unchanged: Sets grid, tiles, Add set, Mark warm-up. Polish: rest sheet/pill. Functional upgrade: Active workout (pause, queue, notes, inactivity prompt, keep-awake, Live Activity; cool-down removed). Reorganize: Today (next-in-rotation hero), History → Progress, Settings sections, Form guide → Library detail with start/end card + embedded video. New: Plan, Library, onboarding, templates, body tracking, cardio, calendar, comparisons, goals.

## Appendix C — Phases 2–6 (substance from v1/v2; media items per §6)

Phase 2 Workout Engine & Media: exercise library table + RepDB mapping/import + manifest/lint + Library detail → plan editor → session engine additions (queue, defer, notes, undo, inactivity, end-time correction) → rest/warm-up → templates → advanced set types. Phase 3 Smart Training: PR engine → recommendations → coach → smart targets → substitution. Phase 4 Progress & Analytics: analytics queries → session edit → comparisons → trends → calendar → goals → body tracking → summary review. Phase 5 iOS Integrations: notifications → keep-awake/dimming → Live Activities → Health → embedded YouTube → feedback matrix → size pass. Phase 6 QA & TestFlight: regression → fixes → performance/accessibility → production build → internal TestFlight → tester notes. Each phase keeps the ten-item structure (objectives, dependencies, files, features, ordered tasks, risks, testing, acceptance, DoD, owner verification).

## Appendix D — Phase 1 acceptance list

All existing flows work on a physical iPhone from a dev build · kill test 10/10 · four tabs · four appearance modes + accent · Arabic RTL review passed · no sync code · no cool-down · rotation replaces weekday · fresh install contains only Starter + templates, no personal data · Reset All Data returns to onboarding · unit suite green · `tsc`/lint/doctor clean.

# Gym RAT

A dark, one-thumb workout tracker for the **Push - Pull - Leg / Upper - Lower Ver 5.0** program, built with Expo (React Native) and TypeScript.

It loads today's routine automatically, runs the workout set by set with a rest timer, keeps an offline log on the device, and shows volume and personal records over time. Every exercise has English and Arabic names, form cues and a YouTube tutorial link.

- **Program source:** `Push Pull Leg Upper Lower 5.0.pdf` (35 pages, Arabic). All sets, reps and rest periods come from its tables.
- **Design source:** the "PPL Coach — iOS Workout Tracker" design canvas (style guide plus 9 phone screens: Today, Warm-up, Player, Rest timer, Cool-down, Summary, Plan, Exercise detail, Progress).

---

## Contents

1. [Quick start](#quick-start)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Phase 1: Types and workout data](#phase-1-types-and-workout-data)
5. [Phase 2: State store](#phase-2-state-store)
6. [Phase 3: Core UI components](#phase-3-core-ui-components)
7. [Phase 4: Screens and navigation](#phase-4-screens-and-navigation)
8. [Design system](#design-system)
9. [Where the data differs from the brief or the design](#where-the-data-differs-from-the-brief-or-the-design)
10. [Verification](#verification)
11. [Known limitations and next steps](#known-limitations-and-next-steps)

---

## Quick start

```bash
npm install
npx expo start          # then press i (iOS simulator), a (Android) or w (web), or scan the QR code with Expo Go
```

Checks:

```bash
npx tsc --noEmit        # typecheck (strict mode)
npx eslint .            # lint
npx expo-doctor         # dependency / config health
```

The app is dark-only and designed for a 393 × 852 pt phone (iPhone 15/16 size), with 44 pt minimum touch targets.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 58, React Native 0.88, React 19.3 |
| Navigation | Expo Router (file-based): a tab navigator plus a full-screen workout route |
| Language | TypeScript 6, `strict: true`, no `any` in app code |
| Styling | `StyleSheet` with design tokens in `constants/theme.ts` (no NativeWind, to keep the build simple) |
| State | Zustand 5 with the `persist` middleware |
| Persistence | `@react-native-async-storage/async-storage` (offline, on device) |
| IDs | `expo-crypto` `randomUUID()` |
| Icons | `lucide-react-native` (on top of `react-native-svg`) |
| Rings / charts | `react-native-svg` for progress rings; the bar chart is plain Views |
| Video | `expo-web-browser` (in-app browser) and `Linking` (YouTube app) |
| Feedback | `expo-haptics` and `expo-audio` (rest-over chime) |

---

## Project structure

```
app/                       Expo Router routes (thin: each one re-exports a screen)
  _layout.tsx              Root stack, dark navigation theme, splash held until storage loads
  (tabs)/_layout.tsx       Bottom tabs: Today, History
  (tabs)/index.tsx         → screens/TodayDashboardScreen
  (tabs)/history.tsx       → screens/HistoryScreen
  workout.tsx              → screens/ActiveWorkoutScreen (full-screen modal)
  +html.tsx                Web HTML shell (black background)
  +not-found.tsx           404 page

screens/                   Full screens (Phase 4)
components/                Feature components (Phase 3)
  ui/                      Small shared building blocks
constants/theme.ts         Design tokens
data/                      Program data from the PDF (Phase 1)
lib/                       Pure helpers: maths, formatting, input parsing, haptics/sound
store/                     Zustand store and hooks (Phase 2)
types/workout.ts           Domain model (Phase 1)
assets/sounds/             Generated rest-over chime
```

---

## Phase 1: Types and workout data

### `types/workout.ts`: the domain model

The model has two layers:

**1. Program (static, shipped with the app)**

| Type | Purpose |
|---|---|
| `LocalizedText` | `{ en, ar }` pair used everywhere text appears in both languages |
| `Weekday` | `'saturday' … 'friday'`. The program week starts on **Saturday**, as in the PDF. |
| `MuscleGroup`, `Equipment` | String unions for muscles and equipment |
| `Exercise` | Dictionary entry: id, names, `arabicNameSource` (`'pdf'` or `'supplied'`), primary/secondary muscles, equipment, `isUnilateral`, `formCues[]`, `videoUrl`, optional `thumbnailKey` |
| `RepRange` | `{ min, max }` |
| `RestPeriod` | `{ defaultSeconds, minSeconds, maxSeconds }`. Keeps the PDF's "1–2 min" ranges instead of flattening them. |
| `ExercisePrescription` | How an exercise is programmed **on a given day**: `exerciseId`, `sets`, `reps`, `rest` |
| `DaySchedule` | One of three kinds: `TrainingDay` (routine id, code such as "Push A", focus `strength`/`hypertrophy`, muscle summary, exercises), `CardioDay` (activities, duration, recovery routines) or `RestDay` (note) |
| `StretchMove`, `StretchRoutine`, `WarmupStage` | Warm-up and stretching content |

**2. Log (user data, persisted)**

| Type | Purpose |
|---|---|
| `ExerciseSet` | One set: number, `type` (`warmup` or `working`), target reps, `weightKg`, `reps`, `completed`, `completedAt` |
| `SessionExercise` | An exercise inside a session, with a **snapshot of the prescription** taken at start, its sets, `skipped` and `notes` |
| `WorkoutSession` | A whole session: routine, status (`in_progress` / `completed` / `cancelled`), start/finish times, exercises, current exercise index, warm-up and cool-down checklist ids, `summary` |
| `SessionSummary`, `PersonalRecord` | Volume, sets done/total, duration, PRs |
| `RestTimerState` | Timestamp-based rest timer (see Phase 2) |
| `WorkoutSettings` | Auto-start rest, prefill from history, weight step, warning threshold, haptics on/off, sound on/off |

**Key decision: sets, reps and rest live on the day, not on the exercise.** The PDF programs the same exercise differently on different days. For example, Seated Calf Raise is 4 × 12–15 on Leg A but 4 × 13–15 on Lower B. Keeping one `Exercise` entry per movement also gives a stable `exerciseId` across days, which progressive-overload history needs.

All log ids are UUID strings and all times are ISO-8601 strings, so the log maps straight onto database tables later.

### `data/exercisesData.ts`: the exercise dictionary

There are **38 unique exercises** (the PDF has 42 rows; some repeat across days). Each has:

- English and Arabic names from the PDF. Broken Arabic from PDF text extraction was repaired (for example كابلات, الأرض, الثلاثاء).
- Primary and secondary muscles, equipment, and whether it is one-sided.
- 2–3 short **form cues**. These were written for the app; the PDF has none.
- A **YouTube search URL** built by `youtubeSearchUrl()` (defaults to `"<name> proper form"`; a few use a custom search).

Helpers: `EXERCISES`, `ExerciseId` (a typed key, so a typo in the schedule fails to compile), `EXERCISE_LIST`, `getExercise()`, `isExerciseId()`, and `MUSCLE_LABELS` (English and Arabic muscle names).

**Arabic names added by us** (the PDF has none for these; marked `arabicNameSource: 'supplied'`):

| Exercise | Arabic used |
|---|---|
| Hip Thrust | هيب ثرست |
| Leaning Dumbbell Lateral Raise | رفرفة جانبي مائل بالدامبل |
| One-Arm Overhead Cable Curl | باي كابل علوي بذراع واحدة |
| Forearm Barbell Curl | ساعد بالبار (from the PDF's video caption) |

### `data/scheduleData.ts`: the weekly split

Rest values: "2 دقيقة" is stored as 120 s. "1 - 2 دقيقة" is stored as a 60–120 s range with a 90 s timer default.

| Day | Routine | Focus | Exercises (sets × reps, rest) |
|---|---|---|---|
| **Saturday** | Push A: Chest · Shoulders · Triceps (الصدر + الكتف + التراي) | Strength (قوة) | Flat Barbell Bench Press 3×10–12 (2′) · Incline DB Bench Press 3×10–12 (2′) · Pec Deck Fly 3×10–12 (2′) · High-to-Low Cable Fly 3×10–12 (2′) · Standing Overhead DB Press 3×10–12 (2′) · DB Lateral Raise 3×10–12 (1–2′) · DB Skull Crushers 3×10–12 (1–2′) · Triceps Rope Pushdown 3×10–12 (1–2′) · Lying Leg Raises **3×25** (1–2′) |
| **Sunday** | Pull A: Back · Biceps (الظهر + الباي) | Strength | Single-Arm DB Row 3×10–12 (2′) · Seated Close-Grip Row 3×10–12 (2′) · Standing Lat Pushdown 3×10–12 (2′) · Hammer Strength Lat Pulldown 3×10–12 (2′) · DB Front Raise 3×10–12 (1–2′) · Reverse Pec Deck **3×10** (1–2′) · Close-Grip EZ Bar Curl **4×10–12** (1–2′) · DB Hammer Curl **4×10–12** (1–2′) |
| **Monday** | Leg A: Legs · Calves (الرجل + السمانة) | Strength | DB Deadlift 3×10–12 (1–2′) · Leg Extensions **3×10** (2′) · Lying Leg Curls **3×10** (2′) · Leg Press **3×10** (2′) · Standing Calf Raise **4×12–15** (1–2′) · Seated Calf Raise **4×12–15** (1–2′) · Hip Thrust 3×10 (2′) |
| **Tuesday** | Light cardio and recovery (تمرين كارديو خفيف) | — | Treadmill / incline walk, stationary bike or elliptical, 20–30 min easy, plus the dynamic warm-up and static stretch routines |
| **Wednesday** | Upper B: Chest · Back · Shoulders · Arms | Hypertrophy (ضخامة) | Flat DB Bench Press 3×10–12 (2′) · Hammer Strength Incline Press 3×10–12 (2′) · Single-Arm DB Row 3×10–12 (2′) · Wide-Grip Lat Pulldown 3×10–12 (2′) · Seated DB Shoulder Press 3×10–12 (2′) · Leaning Lateral Raise 3×10–12 (2′) · EZ-Bar Skull Crushers **3×10** (1–2′) · DB Kickback **3×10** (1–2′) · One-Arm Overhead Cable Curl **3×10** (1–2′) · Straight Barbell Curl **3×10** (1–2′) |
| **Thursday** | Lower B: Legs · Calves · Forearms | Hypertrophy | Hack Squat 3×10 (2′) · Leg Extensions 3×10 (2′) · Lying Leg Curls 3×10 (2′) · DB Lunge **3×13–15** (2′) · Seated Calf Raise **4×13–15** (1–2′) · Leg Press Calf Raise **4×13–15** (1–2′) · Seated DB Wrist Curl 3×10–12 (1–2′) · Forearm Barbell Curl 3×10–12 (1–2′) |
| **Friday** | Full rest: no training or cardio (راحة كاملة) | — | — |

Totals: Push A 9 exercises / 27 sets · Pull A 8 / 26 · Leg A 7 / 23 · Upper B 10 / 30 · Lower B 8 / 26.

Helpers: `WEEKLY_SCHEDULE`, `ROUTINES`, `WEEKDAYS`, `PROGRAM_INFO` (program name, version, description, focus labels), `weekdayFromDate()` (maps JavaScript's Sunday-first `getDay()` to the Saturday-first program week), `getDaySchedule()`, `getTrainingDays()`, `getTotalSets()` and `estimateDurationMinutes()` (≈ 45 s per set + rest + 15 min warm-up/cool-down).

### `data/warmupData.ts`: warm-up, stretches and coach notes

- **Warm-up stages (PDF p.2–3):** 1) treadmill 5–10 min at an easy pace, 2) dynamic stretches, 3) light acclimation sets of the first exercise.
- **Dynamic warm-up (p.3), 9 moves:** jogging, marching, back kicks, front kicks, hands in the air, foot touching, knee bending, ankle holding, arm/leg/torso stretch.
- **Pre-workout stretches (p.35), 6 moves at 10–20 s:** dynamic chest, triceps, shoulder, groin and back, standing toe touch, calf against the wall.
- **Static cool-down (p.33), 9 stretches at 20 s:** full body, side body, shoulder, tricep, bicep/forearm, upper chest/shoulder, quadricep, calf, hamstring. One-sided stretches are flagged `bothSides`.
- **Coach notes (p.32):** focus on form and the mind–muscle connection rather than total time; sip water; stretch after training.

The instruction text for each move was written for the app from the PDF's images. PDF page 34 (a third-party hip-bursitis rehab sheet) is not part of the program flow and was left out.

---

## Phase 2: State store

### `store/useWorkoutStore.ts`

One Zustand store, persisted to AsyncStorage under the key `gym-rat/workout-store` (version 1).

**State**

| Field | Saved? | Meaning |
|---|---|---|
| `selectedWeekday` | no | Day picked on the Today screen; `null` means follow the calendar |
| `activeSession` | yes | The workout in progress, if any |
| `history` | yes | Finished sessions, newest first |
| `restTimer` | yes | Timestamp-based rest timer |
| `settings` | yes | Defaults: auto-start rest on, prefill on, 2.5 kg step, 15 s warning, haptics on, sound on |

When saved data loads, settings are merged with the defaults, so settings added in later versions get their default value.

**Actions**

| Group | Actions |
|---|---|
| Day | `selectWeekday(weekday \| null)` |
| Session lifecycle | `startWorkout(weekday?)` returns `{ok:true, session}` or `{ok:false, reason:'not_training_day' \| 'session_in_progress'}`. `finishWorkout()` builds the summary, moves the session into history and returns it. `cancelWorkout()` discards it. |
| Navigation | `goToExercise(i)`, `goToNextExercise()`, `goToPreviousExercise()`, `setExerciseSkipped()`, `setExerciseNotes()` |
| Set logging | `updateSet()`, `completeSet()`, `uncompleteSet()`, `addSet()`, `removeSet()`, `toggleSetType()` |
| Checklists | `toggleWarmupItem(id)`, `toggleCooldownItem(id)` |
| Rest timer | `startRestTimer(seconds, context)`, `pauseRestTimer()`, `resumeRestTimer()`, `adjustRestTimer(±seconds)`, `skipRestTimer()`, `markRestTimerElapsed()` |
| History and settings | `deleteSession(id)`, `clearHistory()`, `updateSettings(patch)` |

**Behaviour details**

- **Prefill:** when a workout starts, each set's weight and reps are copied from the last time that exercise was logged, matched by set number (on any day that uses the exercise).
- **Logging a set:**
  - If weight is empty it counts as 0 kg (bodyweight). If reps are empty, the top of the target range is used.
  - The logged numbers are copied into the next untouched set.
  - The rest timer starts with that day's default rest, except after the very last set of the workout.
- **Rest timer:** the store saves the time rest ends (`endsAt`) rather than counting down every second. Remaining time is always `endsAt − now`. This survives the app being backgrounded or restarted, avoids re-rendering every second, and ±15/30 s simply moves `endsAt`. Subtracting never goes below zero, and pausing freezes the remaining time.
- **Finishing:** the summary holds total volume (working sets only), sets done/total, duration and personal records.
- **Personal records:** a PR is a new **top weight** or a new **estimated 1-rep max** (Epley formula: weight × (1 + reps / 30)) that beats all earlier history. The first time you log an exercise never counts as a PR.

**Selectors**

`selectActiveWeekday`, `selectActiveDaySchedule`, `selectTodaySchedule`, `selectCurrentSessionExercise`, `selectIsWorkoutActive`, `selectPreviousExercise(exerciseId)` and `getRoutineHistory()`. Apart from `getRoutineHistory`, they return existing objects rather than new ones, so components can use them directly without `useShallow`.

### `store/useRestTimerCountdown.ts`

A hook that counts down locally, so only the component using it re-renders. It returns:

- `phase`: `idle`, `paused`, `running`, `warning` (15 s or less left) or `overtime`
- `remainingMs` and `remainingSeconds` (negative in overtime)
- `progress` (0 → 1)

It also exports `formatRestTime()`, which prints "1:42" or "-0:07".

`onElapsed` fires **once** when rest reaches zero. Only a hook given an `onElapsed` callback claims that moment, so a second timer view (the pinned mini timer) cannot swallow the alert. `RestTimerModal` is the one that passes it.

### `store/useStoreHydrated.ts` (added in Phase 4)

Uses `useSyncExternalStore` with the persist API to report when AsyncStorage has finished loading. The root layout keeps the splash screen up until then.

### `lib/workoutMath.ts`

Pure helpers used by both the store and the UI:

- **Volume:** `isCountedSet` (completed working sets only), `setVolumeKg`, `exerciseVolumeKg`, `sessionVolumeKg`, `countSets`
- **Strength:** `estimateOneRepMax`, `roundTo`, `formatSet` ("57.5 × 12" or "BW × 25")
- **History lookups:** `getPreviousPerformance`, `getPreviousSetAt` (drives the "Previous" column), `getExerciseBests`
- **Results:** `detectPersonalRecords`, `buildSessionSummary`, `weeklyVolumeKg` (Saturday-start weeks, oldest first)

---

## Phase 3: Core UI components

### `components/ExerciseCard.tsx`

- **Header:** "Push A · 2 of 9", the English name and Arabic name (right-to-left), and up to 3 muscle chips plus an equipment chip.
- **Form tile:** a dumbbell placeholder showing the first two form cues and a **Form video** badge. Tapping it opens `VideoModal`.
- **Stat tiles:** Target (sets × reps), Rest (for example "1:00–2:00"), and Best (best set by estimated 1-rep max).
- **Sets grid:** columns Set · Previous · kg · Reps · ✓.
- **Buttons:** **Add set** and **Mark warm-up** (turns the next working set into a warm-up set).
- **Haptics:** a success tap when a set is logged, and a light tick when a set's type changes.

### `components/SetRow.tsx`

- **Input drafts:** typed values are kept as text until you leave the field, so "57." or Arabic digits like "٥٧٫٥" can be typed. Tapping ✓ while still typing logs what you typed.
- **Empty fields:** these show last time's weight and the target reps as hints, and those hints are used if the field is left empty.
- **Check button:** an orange ring on the next set to log, green with a tick once logged; tap again to undo.
- **Set number:** tap to switch between working set and warm-up ("W"), long-press to remove the set.
- **Logged rows:** turn light green and show the values as plain text.

### `components/RestTimerModal.tsx`

**`RestTimerModal`** (bottom sheet):

- **Header:** exercise name and "Set 2 logged · 60 × 12".
- **Ring:** drains as rest runs out. Blue while running, orange in the last 15 s, red and full once in overtime, grey when paused. Its size scales to 30% of screen height (maximum 248 pt).
- **Big timer:** "1:42" with "of 2:00" under it.
- **Controls:** −15 s, pause/resume, +30 s, plus smaller −30 s / +15 s.
- **Up next:** next set's weight × target reps, with last time's numbers.
- **Skip Rest** button. Tapping the backdrop or the grabber minimises the sheet.
- **When rest ends:** 3 rigid haptic pulses and the chime.

**`RestTimerPill`** is the small sticky bar shown while the sheet is minimised (for example "Rest · Set 2 next 1:57"). Tap it to reopen the sheet.

### `components/VideoModal.tsx`

A page-sheet form guide with:

- A tap-to-play tile
- English and Arabic names
- Muscle chips (primary muscles in orange)
- "In Push A · Upper B" (which days use the exercise)
- **Watch tutorial**, which opens an in-app browser (SFSafariViewController / Chrome Custom Tabs)
- **Open in YouTube**, which opens the YouTube app if installed, otherwise the browser
- An error message if neither can open
- Numbered form cues

### `components/WarmupRoutine.tsx`

`variant="warmup"`:

- The 3 PDF stages, each with its Arabic text.
- Stage 2 contains the 9 dynamic moves. Stage 2 counts as done when all moves are ticked.
- Stage 3 names the day's first exercise and suggests ~50% of last time's top weight, rounded to 2.5 kg.
- An optional, collapsible section with the 6 pre-workout stretches.

`variant="cooldown"`: the 9 static stretches, then the coach notes.

Both variants have a **hold timer**: "Now · 3 of 9 · side 1 of 2", a ring, **Start/Pause** and **Done · next**. When a hold finishes it moves to side 2 where needed, ticks the stretch off and starts the next one. Tap a stretch's row to make it current, or its circle to tick it. `getRoutineProgress(variant, ids)` returns 0–1 for progress rings.

The component doesn't store what's ticked. The screen passes `completedIds` and `onToggle`, from the active session or from local state.

### Shared building blocks (`components/ui/`)

- `ProgressRing` (SVG)
- `Chip` (neutral, orange, green or blue)
- `Button` (primary, tinted, secondary or destructive, with an optional Lucide icon)
- `ConfirmDialog` (added in Phase 4)
- `SectionHeader` (added in Phase 4)

### Supporting files

- `constants/theme.ts`: design tokens (see [Design system](#design-system)).
- `lib/feedback.ts`:
  - Haptics: `hapticSelection`, `hapticSetCompleted`, `hapticWarning`, `restCompleteFeedback`.
  - Sound: `playRestCompleteSound`. It mixes with the user's music, respects the silent switch, and never throws.
- `lib/parseNumber.ts`: converts Arabic-Indic digits and `,`/`٫` decimal points, with `parseWeight`, `parseReps` and `formatInputNumber`.
- `assets/sounds/rest-complete.wav`: a generated 3-beep chime (880 / 880 / 1320 Hz).

---

## Phase 4: Screens and navigation

### Navigation (`app/`)

- **Root stack:** `(tabs)` and `workout`. `workout` is a full-screen modal with swipe-to-dismiss turned off, so a workout can't be closed by accident.
- **Tabs:** **Today** (house icon) and **History** (bar-chart icon), styled to match the design.
- **Theme:** dark navigation theme built from the tokens, light status bar.
- **Loading:** the splash screen stays up until saved data has loaded.

### `screens/TodayDashboardScreen.tsx`

- **Header:** the long date, and "Today" or the previewed weekday, with a **Today** button to go back.
- **Week strip (Sat–Fri):** tap a day to preview it. Dot colours: grey for training, blue for cardio, outlined for rest, green when done this week.
- **Resume banner:** shown if a workout is in progress, with sets done/total, **Resume** and **Discard** (with confirm).
- **Day card:**
  - **Training day:** focus and "Day n of 5", code, muscles in English and Arabic, and a progress ring (100% if done today, otherwise the live session's set progress). Tiles for exercises, sets and ~minutes, the last session for this day (date · volume · duration), and the main button: **Start Workout**, **Resume Workout**, **Resume <other day>** or **Train Again**.
  - **Tuesday:** the cardio options, plus the static stretch routine with its hold timer.
  - **Friday:** the rest note and what's on next.
- **Stat cards:** this week's volume with % vs last week, and training days done out of 5.
- **Lists (training days):** the 3 warm-up stages, and every exercise with its Arabic name, sets × reps and best set. Tapping an exercise opens the form guide.
- **Coach note** from the PDF.

### `screens/ActiveWorkoutScreen.tsx`

- **Top bar:** minimise (the workout keeps going and can be resumed from Today), a running clock with "n/27 sets", and **Finish**.
- **Stage switcher:** Warm-up / Workout / Cool-down. It opens on Warm-up unless sets are already logged.
- **Warm-up:** `WarmupRoutine`, then **Begin Push A** (or **Skip to Push A**).
- **Workout:**
  - Numbered exercise chips: orange for current, green with a tick when done, faded when skipped.
  - The `ExerciseCard`, an "Up next" row, **Skip exercise** and **Discard workout**.
- **Cool-down:** `WarmupRoutine variant="cooldown"`, then **Finish Workout**.
- **Bottom bar:** the pinned rest timer above ‹ Previous and **Next Exercise** (this becomes **Cool-down** on the last exercise, and turns solid orange once the current exercise is done).
- **Rest sheet:** opens automatically for each newly logged set and stays closed once minimised, until the next set.
- **Finishing:** if sets are still empty, a confirm says how many won't count.
- **Summary:** a progress ring, "Push A complete", the date and time range, then tiles for **Volume** (with % vs the last time you did this day), **Sets**, **Duration** (and whether warm-up/cool-down were done) and **New PRs**. Each PR row shows its type, the new value and the old one. **Done** returns to Today.

### `screens/HistoryScreen.tsx`

- **Weekly volume:** a bar chart for the last 8 weeks, in one colour. Tap a bar to read its week; the latest week is selected by default. Shows % change vs last week.
- **Totals:** sessions, all-time volume and PRs.
- **Volume records:** best session volume for each of the 5 days.
- **Recent sessions:** badge (PSH / PUL / LEG / UPR / LWR), date · duration · sets · PRs, and volume. Tap to expand each exercise's logged sets (PR sets marked with a star). Delete from the expanded view, or long-press, with confirm.
- **Empty state** when nothing has been logged yet.

### Other Phase 4 files

- `components/WeeklyVolumeChart.tsx`
- `lib/format.ts`: kg, durations, stopwatch, dates, % change, start of week
- `components/ui/ConfirmDialog.tsx`: works on web too, where the built-in alert has no buttons
- `components/ui/SectionHeader.tsx`

### Config and cleanup

- **`app.json`:**
  - Name "Gym RAT", dark-only, black splash.
  - `web.output: "single"`. The template's `"server"` setting sent no app code in development.
  - The `expo-audio` plugin has the microphone permission, Android audio recording and background playback turned off. The app only plays one short sound.
  - The `expo-asset` plugin is added.
- **Template removed:** the sample tab and modal, the light/dark helpers, the unused SpaceMono font, `EditScreenInfo`, `ExternalLink` and `constants/Colors.ts`.

---

## Design system

Taken from the design canvas style guide (`constants/theme.ts`):

| Token | Value | Use |
|---|---|---|
| `background` | `#000000` | True-black OLED background |
| `surface` | `#1C1C1E` | Cards |
| `surfaceRaised` | `#2C2C2E` | Inputs, chips, tiles |
| `surfaceHigh` | `#3A3A3C` | Rings, outlines |
| `label` / `labelSecondary` / `labelTertiary` | `#FFF` / `rgba(235,235,245,.6)` / `.3` | Text |
| `tint` | `#FF9F0A` (orange) | Main actions, current item, warning phase |
| `success` | `#30D158` (green) | Logged sets, done |
| `link` | `#0A84FF` (blue) | Links, running rest timer |
| `destructive` | `#FF453A` (red) | Discard, delete, overtime |

- **Type scale:** iOS text styles: Large Title 34, Title 1 28, Title 2 22, Headline 17, Body 17, Subheadline 15, Footnote 13 (uppercase), and a 76 pt timer. Every number uses evenly spaced (tabular) digits so columns don't shift.
- **Spacing:** 8-pt grid, 16 pt screen margins.
- **Corner radii:** 10 rows / 12 tiles / 14 cards / 20 sheets.
- **Touch targets:** at least 44 pt; main buttons are 50 pt tall.
- **Accessibility:** every control has a role and label; checkboxes, tabs and the timer announce their state; decorative elements are hidden from screen readers; Arabic text is right-to-left.

---

## Where the data differs from the brief or the design

The PDF was treated as the source of truth:

- **Reps and sets:** Leg Raises 3×25 · Reverse Pec Deck 3×10 · EZ Curl and Hammer Curl 4 sets · Leg A machine exercises 3×10 · Upper B's last four exercises 3×10 · Lower B lunges and calves 13–15.
- **Seated Calf Raise:** 12–15 on Leg A and 13–15 on Lower B.
- **Upper B bench press:** the design's Exercise Detail screen shows Flat *Barbell* Bench on Upper B. The PDF has Flat *Dumbbell* Bench there, and the app follows the PDF.
- **Week start:** Saturday, as in the PDF.

---

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` (strict) | 0 errors |
| `npx eslint .` | 0 errors, 0 warnings |
| `npx expo-doctor` | 20/20 checks passed |
| `npx expo export --platform ios` | Bundles, including the `.wav` asset |
| Node smoke test of data and store (Phase 2) | 38 exercises; 31 Oct 2026 → Saturday; start → log → rest (−15, pause, +30, skip) → finish → prefill → PR detection (60×12, estimated 1-rep max 84 vs 80.5) → persisted keys and version all correct |
| Web walkthrough at phone width (393 pt) | Today → Start → warm-up → log 60×12 → rest sheet → pinned timer → Finish confirm → summary (720 kg, 1/27) → Today shows 100%, Train Again, green Saturday dot → History chart, records and expanded session → Tuesday and Friday cards |

Bugs found and fixed during testing:

- History badges were ambiguous (both Push A and Pull A showed "PA").
- Chart date labels were cut off.
- The date line on previewed days repeated the weekday.
- An invisible stretch-timer ring.
- Two warnings on web from the progress ring.
- A one-frame flash of a wrong time when a new rest timer starts.

---

## Known limitations and next steps

- **Not yet run on a real device or simulator.** On web, the pop-up sheets (rest timer, confirm, summary) cover the whole browser window, so their phone layout should be checked with `npx expo start` on a phone or simulator.
- **Rest-over alert in the background:** haptics and the chime only fire while the app is open. A notification when rest ends in the background needs `expo-notifications`.
- **Exercise photos:** the form tile is a placeholder. The PDF has one photo per exercise (pp. 7–31). These could be extracted into `assets/exercises/` and linked through `Exercise.thumbnailKey`, once you confirm you're allowed to redistribute them. The stretching posters (pp. 33–35) are third-party.
- **Plan and Library tabs** from the design were not built (they weren't in the brief). The Today week strip covers picking a day, and the form guide covers exercise details.
- **Duration estimate:** gives ~83 min for Push A against the design's ~70; tune `estimateDurationMinutes()` if needed.

---

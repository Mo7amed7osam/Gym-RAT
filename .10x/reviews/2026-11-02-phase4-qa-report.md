# Phase 4 QA report — Progress & Analytics

**Date:** 2026-11-02 · **Branch:** `feature/phase4-analytics` · **Base:** `6319c60` · **Device:** dedicated simulator `GymRAT-Phase4` (iPhone 16 Pro, iOS 26.3, Metro :8082), driven with AXe 1.8.0 (taps, typing) and deep links. Screenshots: `phase4-screenshots/`.

## Automated
| Check | Result |
|---|---|
| `npx jest` | 23 suites, 213 tests, all pass |
| `sh scripts/test-timezones.sh` | 57 date-sensitive tests × 6 zones (Cairo, London, Los Angeles, Auckland, Riyadh, UTC): all pass |
| `npx tsc --noEmit` | 0 errors |
| `npx expo lint` | clean |

Coverage of the brief's correctness list:
| Requirement | Test |
|---|---|
| Edits that change existing PRs | `history.edit.test.ts` (raise an early set → later PRs disappear; move a session earlier → order + PRs re-derived) |
| Delete + recompute | `history.edit.test.ts`, `analytics.edge.test.ts` |
| Zero / sparse history | `analytics.edge.test.ts` (every analytic on `[]`; one session a year ago; warm-up-only and skipped exercises) |
| Month/year boundaries | `analytics.edge.test.ts` (1 Jan vs 1 Jan, week spanning New Year, 31 Mar vs Feb in a leap year, grids for 12 months × 3 week starts) |
| Time zones / DST | `analytics.edge.test.ts` under six TZ values (23:30 / 00:15 local day keys, 52 weekly buckets across both DST changes, boundary sessions) |
| Rollback on failed write | `history.edit.test.ts` (persist throws → state and DB unchanged, error surfaced), `progress.body-goals.test.ts` |
| Active session never corrupted | `analytics.edge.test.ts` (edit + delete with an in-progress session: object identity and DB rows unchanged; history actions refuse the active session) |
| Migration across branches | `progress.migration-merge.test.ts` (v6, Phase 3 v7, Phase 4 v7 → merged sequence, history intact; renumber-only gap demonstrated; boot repair) |
| Strings | `progress.i18n.test.ts` (every referenced key resolves in en + ar) |

## Simulator (real expo-sqlite, Hermes)
Seeded 11 workouts over 6 weeks, 5 weigh-ins, 2 goals directly into the app database, then:

| Flow | Language | Result |
|---|---|---|
| Schema upgrade on first launch | — | `user_version` 7, `body_metrics` + `goals` present |
| Progress tab, all 7 sub-screens (deep link) | en, ar | render, numbers match the seed |
| Arabic RTL layout, every Phase 4 screen | ar | mirrored: headers, chips, tiles, rows, calendar weekday order, steppers, progress bars fill from the right, chart time axes run right→left |
| Edit workout: invalid weight (110100) → Save | ar RTL | refused, error shown next to Save |
| Edit workout: set 1 100 → 110 → Save | ar RTL | DB set 110, summary volume 2400 → 2480, later PRs re-derived |
| Edit oldest Legs to 200 kg | ar RTL | every later Legs session lost its PRs; Push sessions gained theirs from the replay (verified in DB per session) |
| Delete that workout (confirm dialog) | ar RTL | later Legs PRs returned (2 each from 9 Oct); navigates back |
| Body: 900 kg → error; 81.2 kg on "yesterday" | ar RTL | refused with range message; saved 81.2 at 08:00 local on 1 Nov |
| Goal: create exercise weight goal (picker search, target 130, 8-week deadline) | ar RTL | row with baseline 110 and deadline 27 Dec |
| Goal: edit target, archive | ar RTL | target updated, archived goal moves under "Show archived (1)" |
| Calendar: previous month, select 27 Oct, open workout, back, next month | ar RTL | correct day list, navigation and back state preserved; next disabled on the current month |
| Progress period chips, exercise metric/range chips | ar RTL | tiles and chart switch |

## Defects found and fixed
| # | Defect | Fix (commit) |
|---|---|---|
| 1 | Arabic dates used Arabic-Indic digits (Hermes ignores `nu-latn` and `numberingSystem`) — violates D8 | digits mapped after formatting (`dd7d83e`) |
| 2 | English "min" inside Arabic rows reordered by bidi ("min · 3 55") | localised durations (`dd7d83e`) |
| 3 | Bar-chart ticks truncated to "31…" at 12 columns | edge ticks only (`dd7d83e`) |
| 4 | Edit validation errors rendered above the exercises, off-screen when Save is tapped | errors next to Save; drag dismisses keyboard (`fb458b2`) |
| 5 | Latin values inside Arabic sentences reordered ("(95 كان kg)") | Unicode directional isolates (`fb458b2`) |
| 6 | Body/goal inputs kept the previous invalid text, so retyping appended ("90081.2") | select on focus (`fb458b2`) |
| 7 | Goal target editing existed only in the store | edit dialog with validation (`fb458b2`) |
| 8 | Goal targets had no upper bound (typo 130125 kg accepted) | per-kind bounds (`fb458b2`) |
| 9 | Phase 3 dev database at v7 would lack Phase 4 tables and fail to load progress | `ensureProgressSchema` at boot (`74a75f3`) |

## Open (not fixed; owner/Phase 3 decisions)
- **Shared helpers outside Phase 4:** `formatKgCompact` shows "t" and `formatKg` shows "kg" in Arabic; `lib/format` date helpers still emit Arabic-Indic digits on other tabs (pre-existing D8 gap, noted in the Phase 1 device report). Phase 4 screens use Latin-digit wrappers.
- Header pencil and the "Edit workout" button share one accessibility label (two identical VoiceOver targets; harmless).
- 30-day body change uses calendar days; an entry made exactly 30×24 h ago across a DST change falls outside the window.
- Arabic strings are machine-authored; owner review pending.
- Not run on a physical iPhone.

## Release readiness
Phase 4 is functionally complete and verified on its branch. Not mergeable until the Phase 3 integration steps in `specs/2026-11-02-phase4-phase3-integration-handoff.md` are done.

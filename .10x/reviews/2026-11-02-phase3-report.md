# Phase 3 — Smart Training & Progressive Overload: completion report

**Date:** 2026-11-02 · **Baseline:** `6319c60` · **Code HEAD:** `cd19cc9` (state commits after it change only `.10x/`) · **Gates on HEAD:** 168 Jest tests in 22 suites, 4 protected Sets-grid snapshots byte-identical, `tsc --noEmit` 0 errors, `expo lint` exit 0. **Physical iPhone:** not tested (owner chose the simulator).

## 1. Features implemented
| Area | What ships |
|---|---|
| PR engine (W1) | `domain/records`: four record kinds (top weight, estimated 1RM, set volume, reps at weight), derived on read from completed sets only, warm-ups / in-progress sessions / the running session excluded, Epley capped at 12 reps, weight-type rules (bodyweight → rep records only, assisted → no load records), variants never compared, event trail oldest-first. `detectSetRecords` (toast) and `detectSessionRecords` (summary). |
| Progression (W2) | `domain/progression`: deterministic `recommend()` with 11 numbered rules and an explanation key for every output; EN + AR explanations; per-session decision (`accepted` / `dismissed` / `edited`) stored on the session exercise (schema v7, ADR-010). |
| Coach (W3) | `domain/coach`: six rule-based insights (break, insufficient data, progressing, missed ×3, plateau, consistent), ordered, max 3, dismissals dated and hidden 14 days (settings). |
| Smart targets (W4) | Recommendation chip above the protected Sets grid: suggested load × rep range, explanation, "Use" prefills only unlogged sets, "Ignore" records the dismissal; editing targets after "Use" marks the decision `edited`. Grid layout untouched (snapshots). |
| Substitution (W5) | `domain/substitution`: equivalent / similar / different tiers with reasons, equipment availability demotion, listed alternatives always included; "Suggested" group at the top of the exercise picker when substituting; equivalence chips in exercise detail. |
| UI / settings (W6) | PR toast in the active workout, PR list in the session summary, Records + PR history in exercise detail (hidden kinds respected), coach card on Today, Settings → Smart training (recommendations on/off, coach on/off, step 2.5 kg, per-hand step 1 kg, hidden record kinds). |

## 2. Commits (oldest first)
| Commit | Workstream |
|---|---|
| `644cd30` | W1 PR engine, schema v7, settings, ADR-010 |
| `23435bf` | W2 progression rules + store decisions |
| `b53cb73` | W3 coach insights |
| `6e672d5` | W5 substitution ranking |
| `cd19cc9` | W4 + W6 UI: chip, PR toast, coach card, records section, suggested substitutes, settings |
| `c1f17b6` | state: interim report + screenshots |
| (this commit) | state: final report, status, handoff |

## 3. Recommendation rules (verbatim numbering from `domain/progression/index.ts`)
1. Inputs: the last 3 completed sessions of the exercise, the prescription rep range, weight type, the kg / per-hand steps from settings, optional RPE / RIR.
2. No completed history → `insufficient_data`: prescription reps, no weight.
3. Working weight of a session = the heaviest load used by at least half of its completed working sets; only those sets are judged.
4. A session is `hit` when every judged set reached the top of the range, `met` when every set reached the bottom, otherwise `missed`.
5. Two consecutive hits at the same weight → add the step (per-hand step for per-hand exercises), reps reset to the bottom of the range. 5a: if the last session was at the limit (RPE ≥ 9.5 or RIR 0) → hold. 5b: only one session on record → hold.
6. `met` but not `hit` → same weight, weakest set + 1 rep, capped at the top of the range.
7. One miss → hold the weight.
8. Two consecutive misses at the same weight → −10 %, floored to the step.
9. Breaks: ≥ 21 days since the last session → hold the last weight; ≥ 42 days → 90 % of it.
10. Bodyweight and assisted exercises never receive a load suggestion (reps only).
11. Every output carries an explanation key; nothing is inferred from missing RPE / RIR.

## 4. Tests (all green on HEAD)
- `records.test.ts` (7): e1RM cap, four kinds + trail, exclusions, weight-type rules, variants, set/session detection.
- `progression.test.ts` (9): rules 2–10, running-session exclusion, determinism.
- `coach.test.ts` (6): rules A–F, ordering, dismissal window, max 3.
- `substitution.test.ts` (2): tiers, source/archived exclusion, equipment demotion.
- `recommendations.store.test.ts` (5): apply-to-unlogged-only, decision recording, setting off, insufficient data, SQLite v7 round-trip after force-quit, coach dismissal persistence.
- `phase3.ui.test.tsx` (4): RecommendationChip (explain / apply / ignore; hidden without history or when disabled; Arabic strings), CoachCard (show / dismiss / off), ExerciseDetail records (list, PR history, hidden kinds).
- Protected: `screens.hardening.test.tsx` snapshots of the Sets grid unchanged (4/4).
- `i18n.test.ts` EN/AR dictionary parity covers every new key.

## 5. Simulator verification (Release build, iPhone 18 Pro simulator, Xcode 27 Device Hub)
Fixture: `scratchpad/seed_history.py` injected two completed Starter sessions (24 Oct, 28 Oct; leg press 3 × 12 @ 100 kg) into the simulator database.

| Step | Result | Evidence |
|---|---|---|
| Today after fixture | "Last time Wed 28 Oct"; coach card "Not enough data yet (2 of 3)" | `phase3-screenshots/today-last-time.png`, `coach-card.png` |
| Dismiss coach card | card gone; `dismissedInsights.insufficient_data = 2026-11-01T22:23:22Z` in settings (DB) | DB query |
| Start Full Body A | chip "Suggested 102.5 kg × 8–12 — You hit 12 reps on every set at 100 kg last time. Try 102.5 kg (+2.5). Based on 2 sessions" | `recommendation-chip.png` |
| Use | all three unlogged sets prefilled 102.5 × 8; `recommendation_json = {"weightKg":102.5,"repsMin":8,"repsMax":12,"decision":"accepted",…}` (DB) | `recommendation-applied.png`, DB query |
| Tick set 1, set 2 | sets 1–2 stored 102.5 × 8 completed, set 3 pending (DB) | DB query, `rest-after-record-set.png`, `undo-and-rest-pill.png` |
| PR toast | "New PR · Top weight 102.5 kg" shown above the undo toast after set 2 | `pr-toast.png` |
| Rest sheet | overtime countdown, "Up next Set 3: 102.5 kg × 8–12, last 100 × 12"; Skip rest returns to the card, chip reads "Applied to the sets you have not logged yet" | `rest-sheet-overtime.png`, `chip-after-apply.png` |

**Not captured on the simulator:** session summary PR list, Records section in exercise detail, Suggested group in the substitution picker, Settings → Smart training, Arabic / light-theme renders of the new UI. Observed: after two successful taps (Resume workout, Skip rest), one drag and four taps produced no visible change in the app; the cause was not determined. During that window the owner's browser game was in the foreground of the main display and a video was playing on the second display, so driving the simulator was halted rather than competing with the owner for the pointer. Each of these screens is covered by the Jest renders listed in §4 and by the dictionary parity test for Arabic; they remain on the owner checklist below.

**Side effects to disclose:** between 01:05 and 01:14 the pointer was moved to the Device Hub window several times and three taps landed at the wrong points inside the app (a pixel/point scaling mistake on downscaled screenshots; they hit non-interactive areas). Every posted click was checked against the on-screen window stack first and landed inside the Device Hub device window; none reached another app. A `screencapture` call raised macOS's Screen Recording prompt for Visual Studio Code ("…requesting to bypass the system private window picker…"). That permission is not needed; the owner may dismiss it.

## 6. Owner checklist (simulator or iPhone)
1. Finish the in-progress Full Body A session → review → summary shows "New PR · Top weight 102.5 kg" for Leg Press.
2. Library → Leg Press → Records: after the session is finished, top weight reads 102.5 kg and the PR history shows that event on top; estimated 1RM and set volume stay with the 100 × 12 sessions (140 kg / 1,200 kg beat 102.5 × 8); reps at weight gains a 102.5 kg row (8) without an event, since a first exposure at a new load is not a record.
3. Active workout → ⋯ → Substitute → picker shows a "Suggested" group above the full list with reasons; for Leg Press the listed alternatives are Hack Squat and Leg Extension, ranked equivalent / similar by muscles and equipment.
4. Settings → Smart training: toggles and steps persist after force-quit.
5. Arabic (Settings → Language): chip, coach card, records section, toast strings render RTL with Western digits.

## 7. Phase 2 debt carried (unchanged)
RPE / RIR entry UI (rule 5a only reachable from data), giant-set multi-select, drag reorder, Arabic copy review of Phase 2 strings, README stale, Neila Rey poster rights, curated YouTube ids unverified.

## 8. Limitations
- Recommendations use only the last 3 sessions and the prescription range; no autoregulation beyond RPE / RIR at the limit.
- Coach insights ignore template-session volume splits; chip recomputes on each card render (cheap, derived).
- Records are derived on read; a 500-session history has not been profiled (Phase 4/6).

## 9. Not started
Phase 4 (analytics), Phase 5 (iOS integrations), Phase 6 / TestFlight — each needs explicit authorization. Physical iPhone: Developer Mode still off on the owner's phone; EAS CLI on this Mac is logged in as another person.

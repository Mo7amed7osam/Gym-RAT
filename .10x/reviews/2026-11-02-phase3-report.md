# Phase 3 — Smart Training: interim report (session cut off by usage limit)

**Date:** 2026-11-02 · **Baseline:** `6319c60` · **HEAD:** `cd19cc9` · **Gates on HEAD:** 168 Jest tests / 4 protected snapshots (byte-identical), `tsc` clean, `expo lint` clean. **Physical iPhone:** not tested.

## Implemented (all committed)
| Commit | Workstream |
|---|---|
| `644cd30` | W1 PR engine: `domain/records` (top weight, e1RM capped at 12 reps, set volume, reps-at-weight, event trail, weight-type rules), summaries use it, schema v7, settings (ADR-010) |
| `23435bf` | W2 Progression: `domain/progression` with 11 numbered rules (quoted in the module header), store accept / dismiss / edit, EN+AR explanations |
| `b53cb73` | W3 Coach: `domain/coach` six insight rules, max 3, dated dismissals |
| `6e672d5` | W5 Substitution: `domain/substitution` equivalent / similar / different ranking with reasons |
| `cd19cc9` | W4+W6 UI: recommendation chip on the card, PR toast, coach card on Today, Records + PR history + equivalence chips in exercise detail, Suggested group in the picker, Settings → Smart training |

## Recommendation rules (verbatim from `domain/progression/index.ts`)
1 inputs: last 3 completed sessions, rep range, weight type, steps, RPE/RIR · 2 no history → insufficient data · 3 working weight = heaviest load used by ≥ half the sets · 4 hit / met / missed vs the rep range · 5 hit twice → +step (per-hand step for per-hand), reps = min; 5a at the limit (RPE ≥ 9.5 or RIR 0) → hold; 5b one session → hold · 6 met → add reps (weakest set + 1, capped) · 7 one miss → hold · 8 two misses at the same weight → −10 % floored to the step · 9 ≥ 21 days → hold, ≥ 42 days → 90 % · 10 bodyweight / assisted: no load suggestion · 11 every output has an explanation key; nothing inferred from missing RPE/RIR.

## Simulator (Release build, iPhone 18 Pro) — performed
- Fixture: two completed Starter sessions injected into the simulator DB (leg press 3 × 12 @ 100 kg).
- Today: "Last time Wed 28 Oct"; coach card "Not enough data yet (2 of 3)"; dismiss → `dismissedInsights` written to settings (DB).
- Workout: chip "Suggested 102.5 kg × 8–12 — You hit 12 reps on every set at 100 kg last time. Try 102.5 kg (+2.5). Based on 2 sessions". Use → all three unlogged sets prefilled 102.5 × 8, `recommendation_json` = accepted (DB); set 1 logged 102.5 × 8 (DB).
- PR toast: verified in Jest (`New PR · Top weight 102.5 kg`); on the simulator the toast expired before the screenshot was taken (the rest sheet covered it). Not captured.
- Screenshots in `.10x/reviews/phase3-screenshots/`.

## Not done (cut off)
- Simulator screenshots of: PR toast, summary PR list, Records section in exercise detail, Suggested substitutes in the picker, Settings → Smart training, Arabic RTL / light theme of the new UI (Arabic strings are covered by the parity test and a Jest render).
- Finish-and-review of the fixture session on the simulator.
- Phase 3 state notes in `.10x/status.md` / `handoff.md` beyond the sde/dba decision logs.

## Limitations / debt
- RPE / RIR has no entry UI, so rule 5a can only trigger from programmatic data.
- Coach insights ignore template-session volume splits; chip recomputes on every card render (cheap).
- Phase 2 debt unchanged: giant-set multi-select, drag reorder, Arabic review, README, Neila Rey poster, Developer Mode off on the phone.

# Handoff

**2026-11-02 — Phase 3 + Phase 4 integration** on `integration/phase3-phase4` (`reviews/2026-11-02-integration-report.md`, ADR-012). Schema v9 = 7 Phase 3 column, 8 Phase 4 tables, 9 reconcile; `migrate()` reconciles on every launch. One strength engine (`domain/records`) behind `domain/analytics/metrics`. Both feature branches and the Phase 4 worktree preserved. Next: owner review; Phase 5 only on authorization; no TestFlight.

**2026-11-02 — Phase 3 implemented and partly simulator-verified** (`reviews/2026-11-02-phase3-report.md`). Next: owner runs the checklist in §6 of that report, then authorizes Phase 4 (analytics) or Phase 5 (iOS integrations). Do not start either, or TestFlight, without the owner's word. Open: RPE/RIR entry UI, Arabic copy review, README, curated YouTube ids, Developer Mode on the iPhone, owner's own EAS login. Simulator driving: use `tap` only when the owner is not using the Mac; points = px × 874 / image height.

**2026-11-01 — Phase 2 implemented and simulator-verified** (`reviews/2026-11-01-phase2-report.md`). Next: owner review. Phase 3 (PR engine, recommendations, coach, smart targets, substitution suggestions) needs explicit authorization. Open: RPE/RIR entry UI, curated YouTube ids (unverified), Arabic review of all Phase 2 strings, D8 digits, physical-device run.

# Handoff

**From:** 10x orchestrator (discovery + strategy + design + Phase 1 planning)
**To:** SDE / Senior Engineer — Phase 1 authorized; M0 complete
**Date:** 2026-11-01

## Gates still open
- D5 (Apple credentials) before M3 device tests; D3 before M7; D4 before M4 completes.

## Phase 1 complete — next: owner verification, then Phase 2 approval
- Report: `reviews/2026-11-01-phase1-report.md` (changes, evidence, owner checklist, limitations).
- Owner clarification applied (ADR-006): the extracted program is a normal bundled template, no `reference` kind, schema v3. Plan editor (Phase 2) must duplicate-then-edit locked templates.
- Simulator verification evidence: `reviews/2026-11-01-device-verification.md` (simulator section). Physical iPhone not tested (owner: no test iPhone).
- Blockers carried: D5 partially resolved (membership confirmed; device build signed locally with team 8TBB6SU34J; Developer Mode on the iPhone and the owner's own EAS login still needed), D4 (program + Starter content + illustration mapping), D3 (owner-vs-tester confirm), D8 (digits).
- Phase 2 first tasks (when approved): exercise library table + RepDB exact-match mapping (ADR-004) → owner review → import script → manifest + lint → Library detail; then plan editor; then session engine additions.

## Done: M8, M7, M6, M5, M4, M3, M2, M1, M0

- M5: theme system. See `decisions/sde`.
, M3, M2, M1, M0
- M4: rotation model, reducer, Today rewrite. See `decisions/sde`, `decisions/dba`.
, M2, M1, M0
- M3: SQLite write-through persistence, importer, boot. See `decisions/sde`, `decisions/dba`.

1. Baseline already committed (`chore: baseline import`). Add Jest via `npx expo install jest-expo jest @types/jest`, config `jest.config.js` with preset `jest-expo`.
2. Tests for `lib/workoutMath.ts` (volume, e1RM, PR detection incl. first-time-no-PR, weekly buckets), `lib/parseNumber.ts` (Arabic-Indic digits, `٫`/`,` decimals), `lib/format.ts`, rest-timer helpers (`getRestRemainingMs`, `adjustRestTimer` never below zero).
3. Do not touch `components/SetRow.tsx` or the grid/tiles/footer of `components/ExerciseCard.tsx` in any Phase 1 milestone.
4. Commit per milestone on a branch `phase1/m0-test-harness`; merge after owner review.

## Read first
- `specs/2026-11-01-gym-rat-transformation-design.md` §2, §5, §6 (milestones), Appendix A.
- `adrs/001`–`005`.
- `decisions/senior-engineer/transformation.md` for per-milestone approach and traps.

## Protected
Sets Logging UI layout; rest timer model; `lib/workoutMath.ts`, `lib/parseNumber.ts`, `lib/feedback.ts`; theme tokens; Barlow Condensed; PDF program data as reference seed.

---
## Phase 4 track (2026-11-02) — `feature/phase4-analytics`
From architect/planning to SDE. Read ADR-011 (was 010 on the branch) and `decisions/*/phase4-analytics.md`. Task order A1→A8 in `decisions/engineering-manager/phase4-analytics.md`. Do not edit Phase 3 surfaces listed in `decisions/staff-engineer/phase4-analytics.md`.
Implementation done (A1–A7): see `decisions/sde/phase4-analytics.md`, `decisions/dba/phase4-analytics.md`. QA focus: history edit recompute (edit early session → later PRs change), delete recompute, to-date period comparisons, schema v7 upgrade, Arabic RTL on charts/calendar.
**2026-11-02 — Phase 4 verified (10x Phase 5 for this track).** QA report and security review in `reviews/2026-11-02-phase4-*`. Next role: whoever merges Phase 3 + 4 — follow `specs/2026-11-02-phase4-phase3-integration-handoff.md` (strength-engine registration, single summary builder, pr_cache rebuild inside `persistDiff`, migration 7/8/9 + reconcile). Phase 5 not started.

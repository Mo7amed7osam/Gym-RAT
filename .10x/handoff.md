# Handoff

**2026-11-01 — Phase 2 implemented.** Next role: QA (simulator pass of the critical scenarios in the Phase 2 brief) then owner review. Phase 3 (PR engine, recommendations, coach, smart targets, substitution suggestions) needs explicit authorization. Open: RPE/RIR entry UI, curated YouTube ids (unverified), Arabic review of all Phase 2 strings, D8 digits, physical-device run.

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

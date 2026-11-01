# ADR-010: Records are derived on read; recommendations are explainable, deterministic and stored per session exercise

**Status:** Accepted (Phase 3, 2026-11-01)
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
Phase 3 adds personal records, progressive-overload suggestions, a rule-based coach and substitution ranking. History can be edited later (Phase 4), sessions can be resumed after a kill, and the owner requires deterministic, offline, explainable output with no invented certainty.

## Decision
- **Records are a pure function of history** (`domain/records`). Nothing is cached in SQLite; every read recomputes from completed sessions, so edits and deletions can never leave stale records. `SessionSummary.personalRecords` stays the one durable PR list (computed at finish against history excluding the finishing session); the in-workout PR toast compares a just-completed set against history the same way and stores nothing, so resumes and re-ticks cannot create duplicate events.
- **e1RM** uses Epley and is `null` above 12 reps (`E1RM_MAX_REPS`); labels say "estimate". Weight records need `weightKg > 0`; `assisted` exercises get rep records only; `bodyweight` gets rep records at 0 kg; `per_hand` compares within the exercise id (an id is a variant, so variants are never compared).
- **Recommendations** (`domain/progression`) are one pure function over the last sessions of an exercise with a numbered rule list in the module header; every output carries an explanation key and parameters. Accepting a recommendation rewrites prefills on incomplete sets only; completed sets and plans are never changed. The decision (accepted / edited / dismissed, with the suggested values) is stored on the session exercise (schema v7 `recommendation_json`) so it survives force-quit.
- **Coach insights** (`domain/coach`) are recomputed on read; dismissals live in settings keyed by insight kind and exercise with a date, so an insight can return after the cool-down.
- Suggestion steps (`progressionStepKg`, `progressionStepPerHandKg`) only shape the suggestion; typed weights are never rounded.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| `pr_cache` table | Fast reads | Invalidation on edits; two sources of truth | Derive on read; history is small |
| Store recommendations in kv | No migration | Not tied to the session, lost on discard | Column on `session_exercises` |

## Consequences
- Positive: no stale PRs after edits; every number traceable to a set id.
- Negative: O(history) per read on screens that show records (fine at hundreds of sessions; revisit with Phase 4 analytics).

# ADR-009: Advanced set metadata as nullable columns; rest derived from set kind and grouping

**Status:** Accepted (Phase 2, 2026-11-01)
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + DBA)

## Context
Spec §8 asks for drop sets, rest-pause, AMRAP, supersets, giant sets and optional RPE/RIR; §10 asks for per-exercise rest, warm-up set rest and set-type rest behaviour. `sets.type` has a `CHECK IN ('warmup','working')` that SQLite cannot widen without a table rebuild, and the sets grid is protected UI.

## Decision
- Schema v6 adds nullable/defaulted columns: `sets.set_kind` (`normal|drop|rest_pause|amrap`), `sets.rpe`, `sets.rir`, `session_exercises.group_id`, `session_exercises.group_kind` (`superset|giant`). `type` stays warm-up/working so volume, PRs and prefill are unchanged.
- Rest after a set is computed by one pure function (`restSecondsAfter`): drop → 0, rest-pause → 15 s, warm-up → `settings.warmupRestSeconds`, grouped exercise with later members still open → 0, otherwise `exercise.userRestSeconds` → prescription default.
- The grid shows advanced kinds only as a suffix in the set-number cell (↓ · +); controls live in the options sheet.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Widen `sets.type` | One column | Table rebuild, analytics must learn new types | Columns beside it |
| Separate `set_metadata` table | No ALTER on `sets` | Join on every load for rarely used fields | Nullable columns |

## Consequences
- Positive: history and the protected UI are untouched for normal sets; rest rules are testable in isolation.
- Negative: RPE/RIR has storage but no entry UI yet (tracked as tech debt).

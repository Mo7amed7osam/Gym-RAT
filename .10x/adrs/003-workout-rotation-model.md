# ADR-003: Rotation-based plan model replaces weekday schedule

**Status:** Proposed
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + Product Manager)

## Context
Scheduling is keyed by weekday (`Weekday`, `WEEKLY_SCHEDULE`, `weekdayFromDate`, `WorkoutSession.weekday`, Saturday-start weeks in `lib/workoutMath.ts:186` and `lib/format.ts:58-62`). Spec §5 requires one active plan, rotation ("next in sequence"), no auto-skip on missed days, calendar of actual dates, today-only vs permanent edits, user-created plans, templates, and an immutable reference to the original program. The PDF program is reference material only.

## Decision
Tables `plans` (kind ∈ active|template|reference, one `is_active`, `next_day_index`), `plan_days`, `plan_exercises`. Rotation pointer advances only on "Finish and advance". Sessions store `plan_day_id` and `kind ∈ plan|template|extra|cardio`; template/extra sessions never move the pointer. Sessions keep a prescription snapshot (existing pattern). Bundled definitions: Full Body Starter (default on fresh install), owner-approved program (selectable template, locked), PDF program (reference). The owner's personal *instance* is created on device; nothing personal ships in the bundle. Week start becomes a setting.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Keep weekday schedule, add "catch-up" | Small change | Contradicts rotation; missed day logic hacks | Spec explicit |
| Multi-active plans with versioning | Flexible | Complexity spec forbids | Spec §5 |
| Identify owner via build flag to seed personal plan | Direct | Owner's TestFlight build lacks it; ships personal data in dev builds | Rejected; D3 interpretation instead |

## Consequences
### Positive
- Matches user mental model; templates and extra sessions fall out naturally.
### Negative
- Deepest model change; importer must map `routineId`/`weekday` → reference-plan day ids.
### Risks
- History semantics drift → mapping tests; reference plan ids stable.

## Dependencies
- ADR-002. Program content pending D4.

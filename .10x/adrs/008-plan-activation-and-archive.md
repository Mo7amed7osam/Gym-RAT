# ADR-008: Plan activation flips in place; plans are archived, never deleted

**Status:** Accepted (Phase 2, 2026-11-01)
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
The plan builder (P2.3) lets users create, duplicate, edit and switch plans while keeping exactly one active plan and preserving history. Sessions reference `plan_day_id` snapshots; the rotation pointer lives on the active plan.

## Decision
- `activatePlan(planId)`: a locked bundled template is cloned (the clone becomes `active`, as in Phase 1); an unlocked user plan flips `kind` to `active` in place. The previously active plan is demoted to `template` and keeps its `nextDayIndex`, so switching back resumes where it left off.
- Day ids are stable across reorders; new days get UUIDs. `removeDay` / `reorderDay` keep the rotation pointer on the same day when possible.
- Plans are archived (`plans.archived`, schema v5), never deleted. Active plans and bundled templates cannot be archived.
- Editing the active plan changes future sessions only; the running session keeps its prescription snapshot. Session-only edits never write to plans; "save targets to plan" is the single explicit write-back.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Always clone on activation | One code path | Every switch duplicates the plan, the list fills with copies | Flip in place keeps one row per plan |
| Delete plans | Simpler UI | History day ids dangle; owner wording is "archive" | Archive |

## Consequences
- Positive: switching plans is reversible; history never loses its day references.
- Negative: the `plans` list grows (archived rows); the Plan tab hides them behind a toggle.
- Risk: a future plan editor must respect `locked` (duplicate-then-edit); enforced by `LockedPlanError`.

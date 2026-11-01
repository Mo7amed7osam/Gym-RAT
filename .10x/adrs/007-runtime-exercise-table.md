# ADR-007: Exercises live in SQLite (built-in seed + custom), archive-not-delete

**Status:** Accepted (Phase 2 authorized 2026-11-01)
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + DBA + Staff Engineer)

## Context
Phase 1 kept the exercise dictionary as a compile-time TypeScript object (`data/exercisesData.ts`, `ExerciseId` union). Phase 2 needs custom exercises, archiving, user notes, per-exercise rest preferences, richer instructional content and a media manifest, all of which are user data or content that must survive app updates and be editable offline. Sessions and plans reference exercises by id only; history must survive renames and archiving.

## Decision
- New table `exercises` (schema v4), one row per built-in and custom exercise. Columns: `origin` (`builtin`|`custom`), bilingual name, muscles, equipment, `weight_type` (`total`|`per_hand`|`bodyweight`|`weighted_bodyweight`|`assisted`), `is_unilateral`, instructions, breathing, range of motion, common mistakes, alternatives (exercise ids), `video_id` (nullable, curated YouTube id for Phase 5), `user_notes`, `user_rest_seconds` (per-exercise rest override), `image_uri` (custom media in the app sandbox), `archived`, timestamps.
- Built-ins are seeded from `data/exercisesData.ts` at boot when missing (same pattern as bundled plans). Built-in content fields are refreshed from the seed on every boot (`content_version` bump) so authored content improves with app updates; user fields (`user_notes`, `user_rest_seconds`, `archived` for customs) are never touched by the seed.
- The store gains a persisted `exercises` slice; every lookup goes through `selectExercise`/`useExercise`. `ExerciseId` stops being a compile-time union; a Jest test asserts every seed prescription resolves.
- Custom exercises are archived, never deleted. `session_exercises.exercise_id` has no foreign key, so archiving or renaming never touches history. Archived exercises are hidden from pickers but still resolve for history and the detail screen.
- Media: `assets/exercise-media/manifest.json` (generated) maps exercise ids to bundled RepDB start/peak stills with licence, attribution, sha256 and dimensions; `none` entries render a consistent labelled fallback. Custom exercises use `image_uri`.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Keep built-ins compile-time, store only customs in SQLite | Smaller migration | Two lookup paths, notes/rest overrides need a side table anyway | One table keeps every feature uniform |
| Hard-delete custom exercises with cascading history cleanup | Simple UI | Destroys workout records, violates the brief | Archive instead |
| Store user notes in `kv` | No schema change | Unqueryable, grows unbounded | Columns on the row |

## Consequences
### Positive
- One model for built-in and custom exercises; user content survives updates and renames.
### Negative
- Every screen that used `getExercise()` now reads the store; seed refresh logic must be careful not to clobber user fields.
### Risks
- Seed refresh overwriting user edits: mitigated by separating content columns from user columns and testing it.

## Dependencies
- ADR-002 (SQLite), ADR-004 (static media + YouTube later).

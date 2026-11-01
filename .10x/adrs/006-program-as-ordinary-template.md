# ADR-006: The extracted program is an ordinary bundled template

**Status:** Accepted (owner clarification 2026-11-01); supersedes the "reference" plan kind in ADR-003
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + Product Manager)

## Context
ADR-003 modelled the owner's original program as an immutable `reference` plan: browse-only, labelled "Reference program", never adopted automatically. The owner clarified that the source document was only the material the program was extracted from. The app must not treat it as a document, attachment or special reference object; the program is structured native plan data that works like any other template.

## Decision
- `PlanKind` is `active | template`. The `reference` kind is retired; schema v3 rewrites existing rows (`UPDATE plans SET kind = 'template' WHERE kind = 'reference'`).
- "Push / Pull / Legs + Upper / Lower v5.0" (`pdf_ppl_ul_v5`, id kept for the legacy-history mapping) ships as a locked bundled template next to the Full Body Starter: selectable in onboarding and the Plan tab, adopted through `adoptPlan` (a clone becomes the active plan), followed by the normal rotation, editable and duplicable through the plan editor (Phase 2) like every other template.
- Full Body Starter stays the default on a fresh install; the program is never selected automatically except for installs that already have history logged against it (importer behaviour, unchanged).
- The source document is not bundled or displayed. Nothing personal (weights, history) ships in the template: the bundle contains prescriptions only.
- Prescriptions were re-checked row by row against the source tables (pages 7, 13, 18, 22, 28) on 2026-11-01: all 42 rows (sets, reps, rest) match.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Keep `reference` kind, hide the label | Smallest change | Still a special object; CHECK constraint and UI branches remain | Owner asked for the special behaviour to go |
| Rebuild the `plans` table in v3 to tighten the CHECK | Schema says exactly what is allowed | Table rebuild for one retired value; more migration risk | Row update is enough; the old value is documented as retired |

## Consequences
### Positive
- One code path for every template; no "reference" branches in UI, seed or tests.
### Negative
- Existing installs need schema v3 (backup taken automatically before the step).
### Risks
- A plan editor that edits locked templates in place would change the bundled program; Phase 2 must duplicate-then-edit (already the `adoptPlan` pattern).

## Dependencies
- ADR-003 (rotation model) otherwise unchanged. Importer mapping to `pdf_ppl_ul_v5:<day>` ids unchanged.

# Engineering Manager — transformation
## Phase 1 milestones (spec §6)
| M | Title | Depends | Est. |
|---|---|---|---|
| M0 | Git + Jest + baseline tests | — | 0.5 d |
| M1 | Remove sync/server; persist v3 | M0 | 0.5 d |
| M2 | Remove cool-down + weightIncrementKg | M1 | 0.5 d |
| M3 | SQLite behind store facade + importer + backups | M2 | 2–3 d |
| M4 | Plan/rotation + session reducer | M3 | 2–3 d |
| M5 | Theme system | M4 | 1–2 d |
| M6 | i18n + RTL | M5 | 1–2 d |
| M7 | Four tabs + onboarding | M6 | 1 d |
| M8 | Reset All Data + eas.json + dev build | M7 | 0.5–1 d |
Estimates are engineering-day guesses, not measurements.

## Sequencing rationale
Removals first (M1/M2) shrink the surface before persistence (M3). Rotation (M4) before theme/i18n so screens migrate once. Build config last.

## Risks / unknowns
Apple credentials (D5) gate M3 device tests · program content (D4) gates M4 seed · RTL only testable on dev build.

## Phases 2–6
Appendix C of spec; planned in detail at each phase approval.

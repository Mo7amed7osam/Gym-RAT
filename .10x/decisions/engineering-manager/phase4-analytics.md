# Engineering Manager — phase4-analytics

Order follows spec §316 (analytics queries → session edit → comparisons → trends → calendar → goals → body tracking → summary review). Commit per task on `feature/phase4-analytics`.

| # | Task | Output | Depends |
|---|---|---|---|
| A1 | Metrics seam + dates + aggregates + comparisons + muscles + trends | `domain/analytics/*`, tests | — |
| A2 | Session edit ops + validation + replay recompute + store glue | `domain/history/*`, `store/historyActions.ts`, tests | A1 (seam) |
| A3 | Progression + calendar | `domain/analytics/progression.ts`, `calendar.ts`, tests | A1 |
| A4 | Schema v7 + ProgressRepository + progress store + boot wiring | db + store, migration/repository tests | — |
| A5 | Body + goals domain | `domain/analytics/body.ts`, `goals.ts`, tests | A3, A4 |
| A6 | Charts + Progress tab | `components/charts/*`, `screens/ProgressScreen.tsx` | A1–A5 |
| A7 | Sub-screens: history, session detail/edit, calendar, exercises, exercise progression, body, goals | `screens/analytics/*`, `app/analytics/*` | A6 |
| A8 | i18n (en + ar), tsc, lint, Jest, simulator check on a dedicated device | report | all |

Risks: migration v7 collision with Phase 3 (renumber at merge); replay cost on very large history; RTL chart direction.

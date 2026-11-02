# SDE — phase4-analytics

Branch `feature/phase4-analytics` (worktree `../Gym RAT-phase4`), base `6319c60`. ADR-011.

## Built
| Area | Files |
|---|---|
| Strength seam | `domain/analytics/metrics.ts` (`StrengthMetrics`, `registerStrengthMetrics`, baseline = `lib/workoutMath`) |
| Analytics core | `domain/analytics/{dates,aggregate,trends,muscles,progression,calendar,body,goals}.ts` |
| History edit | `domain/history/{edit,recompute}.ts`, `store/historyActions.ts` |
| Persistence | `data/db/schema.ts` (SCHEMA_V7, REQUIRED_TABLES), `data/db/migrations.ts` (step 7), `data/db/progressRepository.ts`, `data/db/boot.ts` (hydrate/attach/reset) |
| State | `store/useProgressStore.ts`, `types/progress.ts` |
| UI | `screens/ProgressScreen.tsx`, `screens/analytics/*`, `components/charts/{LineChart,BarChart}.tsx`, `components/progress/{parts,MonthGrid}.tsx`, `lib/analyticsFormat.ts`, `lib/useFocusNow.ts` |
| Routes | `app/(tabs)/progress.tsx` → ProgressScreen; `app/analytics/{history,calendar,exercises,body,goals}.tsx`, `app/analytics/session/[id].tsx`, `app/analytics/exercise/[id].tsx`; registered in `app/_layout.tsx` |
| Strings | `i18n/progress.{en,ar}.ts`, mounted as `progress` in `i18n/en.ts` / `i18n/ar.ts` |
| Tests | `__tests__/analytics.test.ts`, `history.edit.test.ts`, `progress.body-goals.test.ts`, `progress.i18n.test.ts`, `progress.screens.test.tsx`; fixtures `test/fixtures/sessions.ts` |

## Deviations from plan
- Analytics derive volume/sets/reps from raw sets, not stored summaries (only PR counts come from summaries). Keeps edits consistent everywhere.
- Bodyweight sets (weight null) count as working sets with zero volume in Phase 4 totals; `lib/workoutMath` volume/PR rules unchanged.
- Weekly goals are recurring: never latched as achieved.
- `__tests__/session.engine.test.ts`: v6 migration assertion made version-relative (was hard-coded `[6]`).
- `screens/HistoryScreen.tsx` left in place (no longer routed by the tab) for Phase 3; delete at merge if unused.

## Tech debt
- Replay is O(n²) in prior sessions with the baseline PR adapter (fine at 500 sessions; revisit with Phase 3 `pr_cache`).
- Session edit uses text fields for start time (HH:MM) and duration; no native date/time picker dependency added.
- Logging bodyweight does not update `settings.profile.bodyweightKg` (avoids touching the workout store).
- Weight-type semantics (`per_hand`, `assisted`) not applied to volume/e1RM (Phase 3 decision).
- Arabic strings machine-authored; owner review pending (same as Phases 1–2).

## QA pass (2026-11-02)
Fixed: Arabic date digits, localised durations, bidi isolates, chart ticks, edit errors next to Save, select-on-focus inputs, goal target editing with bounds, boot schema repair. Integration duplicates and invalidation points listed in `specs/2026-11-02-phase4-phase3-integration-handoff.md` §2–3.

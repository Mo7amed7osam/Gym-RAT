# Staff Engineer — transformation
**[DISCOVERED]** Conventions: screens own layout, components own behaviour; `lib/` pure helpers; Arabic-Indic input normalization; haptics fire-and-forget; `ConfirmDialog` instead of Alert for web parity; typed `ExerciseId` union (to be replaced by runtime validation).

## Cross-cutting rules for the migration
- Protected: `components/SetRow.tsx`, grid/tiles/footer in `components/ExerciseCard.tsx` — layout unchanged; behaviour additive only.
- Strings: all UI text through `i18n` from M6 on; lint for literals.
- Colours: only via theme hook from M5 on; lint for literals.
- Writes: only through repositories; no direct SQL in screens.
- Dates: ISO strings in DB; `Date` only at edges.
- Tests: every `domain/` module has table-driven tests; repositories tested on better-sqlite3.
- Branch per milestone `phase1/mN-*`; one reviewable PR each.
- Decision (M3): keep the existing root folders (`data/`, `store/`, `lib/`…) rather than moving to `src/` mid-Phase-1; a tree move adds churn without acceptance value. Revisit after Phase 1.
- Rule: `expo-sqlite` is imported only by `data/db/driver.expo.ts` and `data/db/boot.ts`; everything else talks to the `Driver` interface so Jest runs on `node:sqlite`.

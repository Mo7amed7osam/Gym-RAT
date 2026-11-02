# Phase 4 → Phase 3 integration handoff

**Branch:** `feature/phase4-analytics` (worktree `../Gym RAT-phase4`), base `6319c60`. ADR-010.
**Audience:** the Phase 3 (Smart Training) developer. Do not merge until Phase 3 is ready; this document is the merge plan.

## 1. Strength-metrics boundary (`domain/analytics/metrics.ts`)

```ts
export interface StrengthMetrics {
  estimateOneRepMax(weightKg: number, reps: number): number;
  detectPersonalRecords(session: WorkoutSession, priorHistory: readonly WorkoutSession[]): PersonalRecord[];
}
export function registerStrengthMetrics(engine: StrengthMetrics | null): void; // null → baseline
export function getStrengthMetrics(): StrengthMetrics;
```

Semantics Phase 4 relies on:
| Call | Inputs | Must return |
|---|---|---|
| `estimateOneRepMax(w, r)` | `w` ≥ 0 kg as logged (null weight passed as 0), `r` ≥ 0 integer | kg, 0 when `w` or `r` is 0; pure; monotonic in `w` for fixed `r` (charts and goals take the max) |
| `detectPersonalRecords(s, prior)` | `s`: a **completed** session; `prior`: completed sessions that started strictly before `s` (ties broken by id), **oldest first**, already carrying recomputed summaries | the `PersonalRecord[]` stored in `s.summary.personalRecords`; pure and deterministic (same input → equal output, element order stable) so unchanged sessions keep their object and are not rewritten |

- Register once at startup, before the first render that reads history (e.g. top of `app/_layout.tsx` or `data/db/boot.ts`, before `hydrate`).
- If the engine needs exercise metadata (weight type, bodyweight), close over the store inside the engine; the interface stays `(session, prior)`.
- `PersonalRecord.kind` today is `'top_weight' | 'estimated_1rm'`. New kinds need: `progress.session.recordKinds.<kind>` strings (en + ar) and the dynamic-key list in `__tests__/progress.i18n.test.ts`.

## 2. Calculations that must be unified at merge (no two engines)

| Where | What | Action at merge |
|---|---|---|
| `lib/workoutMath.ts` `buildSessionSummary` (finish path in `store/useWorkoutStore.ts` `finishWorkout`) | calls `detectPersonalRecords` **directly** | Make it call `getStrengthMetrics().detectPersonalRecords` (or have Phase 3's finish path use its engine and register the same engine). Otherwise a freshly finished session and a replayed one disagree. |
| `domain/history/recompute.ts` `summarize` | same summary fields as `buildSessionSummary` (volume, completed/total sets, duration, active, PRs via seam) | After the line above, replace one with the other so there is a single summary builder. Tests: `history.edit.test.ts` "builds the same summaries the app stores at finish time". |
| `domain/analytics/progression.ts` `topWeightKg` | plain max of logged weight | If Phase 3 defines weight-type rules (`per_hand` ×2, `assisted` inverted, bodyweight added), expose them on the engine (e.g. `effectiveLoadKg(set, exercise)`) and use it here, in `goals.ts` (`exercise_weight`), and in volume. |
| `domain/analytics/aggregate.ts` `sessionStats` / `lib/workoutMath.ts` `setVolumeKg` | volume = weight × reps on completed working sets; Phase 4 also counts bodyweight sets (weight null) as working sets with 0 volume | Keep one volume rule; if Phase 3 changes it, analytics follow automatically (they call `setVolumeKg`). |
| `screens/analytics/SessionDetailScreen.tsx` per-exercise volume | inline weight × reps | Switch to `setVolumeKg` if the rule changes. |
| `store/useWorkoutStore.ts` `deleteSession` / `clearHistory` | delete without recomputing later PRs | Route all deletes through `store/historyActions.ts` `deleteHistorySession`. `screens/HistoryScreen.tsx` (no longer routed by the tab) is the only caller; delete that screen or repoint it. |
| `lib/workoutMath.ts` `getExerciseBests` | baseline bests used by the PR detector and prefill | Owned by Phase 3; Phase 4 does not call it. |

## 3. Cache invalidation and transaction boundaries

All history writes go through the workout store's guarded `set` → `WorkoutRepository.persistDiff` → **one SQLite transaction**. History changes come from:
1. `finishWorkout` (append), 2. `historyActions.saveHistorySession` (edit + replay from the earliest affected start), 3. `historyActions.deleteHistorySession` (delete + replay), 4. `deleteSession` / `clearHistory` (legacy), 5. the importer `replaceAll`, 6. `resetAllData`.

If Phase 3 adds `pr_cache` (spec §72):
- Rebuild it **inside `persistDiff`'s transaction** whenever `prev.history !== next.history`, from `next.history` (only for exercises in sessions whose object reference changed, or all of it — 500 sessions is cheap). Then every path above is covered without touching Phase 4 code, and a failed write rolls back the cache too.
- `resetAllData` deletes the file, so no extra work. The importer's `replaceAll` needs the same rebuild.
- Do not maintain the cache from screens or selectors.
- Phase 4 never reads `pr_cache`; it reads `summary.personalRecords`. If Phase 3 makes the cache authoritative, keep summaries in sync from the same rebuild.

## 4. Schema merge (both branches start at v6)

Phase 4 owns step 7 on its branch: `CREATE TABLE IF NOT EXISTS body_metrics …; goals …` (`SCHEMA_V7`). Phase 3 likely also defined a step 7.

**Renumbering alone is unsafe**: a development database that already ran Phase 4's v7 has `user_version = 7`, so a merged build where 7 = Phase 3 would skip Phase 3's step (proven in `__tests__/progress.migration-merge.test.ts`, "renumbering alone"). Resetting databases is not acceptable.

Safe sequence:
1. Merge Phase 3 first; its step keeps number 7.
2. Rebase Phase 4 on top; rename Phase 4's step to 8 (`SCHEMA_V8 = SCHEMA_V7` text, or rename the constant).
3. Add step 9 = **reconcile**: re-run Phase 3's step-7 DDL and Phase 4's DDL, both create-if-missing. Every database ends at 9 with all tables: v6 → 7, 8, 9; Phase 3 v7 → 8, 9; Phase 4 v7 → 8, 9 (reconcile creates Phase 3's tables).
4. If Phase 3's step 7 contains anything not idempotent (`ALTER TABLE ADD COLUMN`, data rewrites), the reconcile step must guard it: check `PRAGMA table_info(<table>)` before `ALTER`, and make data rewrites conditional on the column/table being newly created. Never `DROP` user tables.
5. Keep `ensureProgressSchema` in `data/db/boot.ts` (Phase 4 tables repaired at boot, create-only) — it also covers a Phase 3 database that already reached a higher `user_version` without Phase 4's tables.
6. Update `REQUIRED_TABLES` to include both branches' tables; migration tests assert against `SCHEMA_VERSION`, not literals.
7. Run `__tests__/progress.migration-merge.test.ts` with the real Phase 3 DDL substituted for `PHASE3_V7`, plus the full suite.

The boot path already backs the file up before any step and restores it on failure (`migrateWithBackup`).

## 5. Expected text conflicts

| File | Phase 4 change | Resolution |
|---|---|---|
| `data/db/schema.ts` | `SCHEMA_V7` block appended; `REQUIRED_TABLES` + 2 names | keep both, renumber per §4 |
| `data/db/migrations.ts` | import + one step line | per §4 |
| `data/db/boot.ts` | progress store hydrate/attach/reset + `ensureProgressSchema` | additive |
| `app/_layout.tsx` | 7 `Stack.Screen name="analytics/…"` lines | additive |
| `app/(tabs)/progress.tsx` | re-exports `screens/ProgressScreen` | keep Phase 4 |
| `i18n/en.ts`, `i18n/ar.ts` | one `progress: progressEn/Ar` line + import at the top | additive |
| `__tests__/session.engine.test.ts` | v6 assertion made version-relative | keep Phase 4 |
| `.10x/status.md`, `.10x/handoff.md`, ADR numbering | Phase 4 sections appended; ADR-010 | renumber ADR if Phase 3 used 010 |

## 6. After merge, verify
`npx tsc --noEmit` · `npx expo lint` · `npx jest` · `sh scripts/test-timezones.sh` · migration-merge test with real Phase 3 DDL · on a simulator: edit an early workout and confirm later PR stars move; delete a record-setting workout; finish a new workout and confirm its PRs match a replay (saving that workout unedited must leave every later session's summary, and its `updated_at`, unchanged).

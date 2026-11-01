# Architect — phase4-analytics

**Phase:** product Phase 4 (Progress & Analytics), branch `feature/phase4-analytics` from `6319c60`. ADR-010.

## Components
| Unit | Responsibility | Depends on |
|---|---|---|
| `domain/analytics/metrics.ts` | `StrengthMetrics` seam (e1RM, PR detection); default = `lib/workoutMath` | workoutMath (read-only) |
| `domain/analytics/dates.ts` | Local-day keys, period ranges (week/month/3 months/year), to-date previous period | `startOfWeek` |
| `domain/analytics/aggregate.ts` | Totals for a range: sessions, volume, working sets, reps, active time, training days; period comparison | workoutMath counted-set rules |
| `domain/analytics/trends.ts` | Weekly series (volume/sessions/sets/minutes), least-squares direction | dates |
| `domain/analytics/muscles.ts` | Sets per muscle (primary 1, secondary 0.5) | exercise library |
| `domain/analytics/progression.ts` | Per-exercise per-session points (top weight, best e1RM via seam, volume, reps), trained-exercise index | metrics |
| `domain/analytics/calendar.ts` | Month grid aligned to week start, day buckets, weekly streak | dates |
| `domain/analytics/goals.ts` | Goal evaluation → current, progress 0..1, achieved | aggregate, progression, body |
| `domain/analytics/body.ts` | Body series per kind, latest, change over window, 7-entry moving average | — |
| `domain/history/edit.ts` | Pure edit ops on a finished session + validation | reducer helpers |
| `domain/history/recompute.ts` | Chronological replay from an edit point; reference-preserving | metrics |
| `data/db/progressRepository.ts` | `body_metrics`, `goals` CRUD + diff writer | driver |
| `store/useProgressStore.ts` | Body entries + goals, write-through | progressRepository |
| `store/historyActions.ts` | Save edited session / delete with replay via `useWorkoutStore.setState` | history domain |
| `screens/ProgressScreen.tsx` + `screens/analytics/*` | UI | all above |

## Data flow
history (workout store) ──pure──▶ analytics view models (memoised in screens) ──▶ charts.
Edit: draft copy (screen state) → `validateSession` → `commitSessionEdit` (replay) → `setState({history})` → persistDiff (one transaction) → UI.
Body/goals: progress store action → ProgressRepository.persistDiff (one transaction) → state.

## Failure modes
- DB write fails → state unchanged, `persistenceError` set (existing contract); edit screen keeps the draft and shows the error.
- Edited session invalid (end < start, negative weight, fractional reps) → save refused with field errors, nothing written.
- Session referenced by id disappears (deleted elsewhere) → detail screen shows "not found".
- Exercise archived/unknown → names fall back to id; analytics still count sets; muscles unknown → "Other".

## Boundaries with Phase 3
Phase 3 provides `StrengthMetrics` and may add `pr_cache`. Phase 4 does not modify `lib/workoutMath.ts`, `store/useWorkoutStore.ts`, `screens/HistoryScreen.tsx`, `components/SetRow.tsx`, `components/ExerciseCard.tsx`.

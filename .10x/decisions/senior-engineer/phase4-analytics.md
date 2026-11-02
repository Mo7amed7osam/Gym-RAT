# Senior Engineer — phase4-analytics

- **Periods:** `week` (current week from `weekStart`), `month` (calendar month), `quarter` (last 13 weeks), `year` (calendar year). Comparison is to-date aligned: current range `[start, now)` vs `[prevStart, prevStart + (now - start))`, so day 2 of a month compares to day 2 of last month.
- **Replay:** sort completed sessions asc (`startedAt`, then `id`); cutoff = min(old start, new start); for sessions before cutoff keep as is; for each at/after cutoff compute summary with prior = completed sessions strictly earlier in the new order. Equality check on summary fields + PR list (kind, exerciseId, value, previous, setId) → keep old object. Output history newest-first, non-completed sessions retained in place.
- **Edit validation:** weight finite ≥ 0 or null; reps integer ≥ 0 or null; completed set needs reps; end > start; duration ≤ 24 h; started not in the future; set `type` ∈ warmup/working; pauses clamped into [start, end], empty ones dropped.
- **Edit semantics:** time change writes `startedAt` and `endedAtOverride` (keeps `finishedAt` as the real tap time).
- **Muscles:** primary 1 set, secondary 0.5 set, per counted working set; unknown exercise → `other`.
- **Goals:** kinds `bodyweight`, `body_measurement`, `exercise_e1rm`, `exercise_weight`, `weekly_sessions`, `weekly_volume`. Direction = sign(target − baseline) (bodyweight can be a cut). Weekly kinds evaluate the current week. Achieved stamps `achievedAt` once (idempotent action).
- **Body kinds:** `bodyweight` kg, `body_fat` %, `waist`, `chest`, `hips`, `arm`, `thigh`, `neck` cm. Stored canonical units.
- **Tricky:** zustand selectors must return stable refs → derive in `useMemo`; never run replay in render.

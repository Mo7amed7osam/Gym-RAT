# Architect — transformation
**[DISCOVERED]** Routes in `app/` re-export `screens/*`; one Zustand store (`store/useWorkoutStore.ts`) persisted as a JSON blob with 500 ms batched writes; weekday schedule (`data/scheduleData.ts`); rest timer timestamp model (`endsAt`); PRs computed at finish and stored in `summary`; cool-down stage present; sync queue present.

## Target
See spec §2.3 (layering), §2.4 (models), §3.3 (media), §5 (persistence). ADR-001…005.

## Components and boundaries
- `domain/session` reducer: events start/logSet/undo/defer/reorder/substitute/pause/resume/requestFinish/confirmFinish/discard; no I/O.
- `data/repositories`: single writer; one transaction per event; returns committed rows.
- `services/liveActivity`, `services/notifications`, `services/health`, `services/youtube`, `services/media`: side effects after commit; idempotent; no-op when unavailable.
- `features/*` screens read via query hooks; mutations via store actions that call repositories.

## Failure modes
Process kill mid-transaction (lost by design, acked only after commit) · migration failure (backup/restore/halt) · permission denied (no-op) · embed blocked (fallback card) · Live Activity ended by system after 8 h (resume shows in-app state only).

## Data flow (log a set)
SetRow ✓ → store.completeSet → reducer → repository transaction (sets, session, rest timer) → commit → store state updated → notification scheduled at endsAt → Live Activity update.

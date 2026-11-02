import type { HealthExportRow } from '@/data/db/healthExportRepository';
import { endTimeMs } from '@/domain/session/reducer';
import type { WorkoutSession } from '@/types/workout';

/**
 * Apple Health export as a reconciler (ADR-013), not a write hook: Health
 * cannot join the SQLite transaction, so after every history change the
 * ledger (`health_exports`) is compared with history and the difference is
 * applied. Finish, edit (Phase 4 `saveHistorySession`), delete, import and a
 * failed earlier attempt all converge the same way, and the native save
 * replaces by session id, so a retry never duplicates.
 *
 * Only start, end and pauses leave the device, as one strength-training
 * workout. Nothing is read from Health and nothing is uploaded anywhere.
 */

export type HealthAuthorization = 'notDetermined' | 'denied' | 'authorized' | 'unavailable';

export interface HealthWorkout {
  sessionId: string;
  startMs: number;
  endMs: number;
  pauses: { fromMs: number; toMs: number }[];
}

export interface HealthAdapter {
  status(): HealthAuthorization;
  save(workout: HealthWorkout): Promise<{ uuid: string; replaced: number }>;
  remove(sessionId: string): Promise<number>;
}

export interface HealthLedger {
  loadAll(): HealthExportRow[];
  put(row: HealthExportRow): void;
  remove(sessionId: string): void;
}

/** A completed session as one Health workout; null when its times are unusable. */
export function healthWorkout(session: WorkoutSession): HealthWorkout | null {
  if (session.status !== 'completed') return null;
  const startMs = Date.parse(session.startedAt);
  const endMs = endTimeMs(session, startMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const pauses = session.pausedIntervals
    .filter((interval) => interval.to !== null)
    .map((interval) => ({ fromMs: Math.max(startMs, Date.parse(interval.from)), toMs: Math.min(endMs, Date.parse(interval.to!)) }))
    .filter((pause) => pause.toMs > pause.fromMs);
  return { sessionId: session.id, startMs, endMs, pauses };
}

export const workoutFingerprint = (workout: HealthWorkout): string =>
  [workout.startMs, workout.endMs, ...workout.pauses.map((pause) => `${pause.fromMs}-${pause.toMs}`)].join('|');

export interface HealthExportPlan {
  save: HealthWorkout[];
  remove: string[];
}

/**
 * Sessions to (re)write and session ids to delete from Health. A session is
 * exported when it started after export was enabled, or was exported before
 * (so editing its start earlier does not orphan the Health copy).
 */
export function planHealthExport(history: readonly WorkoutSession[], ledger: readonly HealthExportRow[], since: string | null): HealthExportPlan {
  const rows = new Map(ledger.map((row) => [row.sessionId, row]));
  const sinceMs = since ? Date.parse(since) : Number.POSITIVE_INFINITY;
  const keep = new Set<string>();
  const save: HealthWorkout[] = [];
  for (const session of history) {
    const row = rows.get(session.id);
    if (!row && !(Date.parse(session.startedAt) >= sinceMs)) continue;
    const workout = healthWorkout(session);
    if (!workout) continue;
    keep.add(session.id);
    if (!row || row.fingerprint !== workoutFingerprint(workout)) save.push(workout);
  }
  const remove = ledger.filter((row) => !keep.has(row.sessionId)).map((row) => row.sessionId);
  return { save, remove };
}

/** Null skips the run (export was turned off while it was queued). */
export interface HealthExportInput {
  history: readonly WorkoutSession[];
  since: string | null;
}

export interface HealthExportResult {
  saved: number;
  removed: number;
  failed: number;
}

/**
 * Runs plans one at a time. A request that arrives while a run is in flight
 * is folded into one follow-up run with the latest input.
 */
export class HealthExporter {
  private running: Promise<HealthExportResult> | null = null;
  private pending: (() => HealthExportInput | null) | null = null;

  constructor(
    private readonly adapter: HealthAdapter,
    private readonly ledger: HealthLedger,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** `input` is read when the run starts, so queued runs see the newest history; null skips. */
  sync(input: () => HealthExportInput | null): Promise<HealthExportResult> {
    if (this.running) {
      this.pending = input;
      return this.running;
    }
    this.running = this.run(input).finally(() => {
      this.running = null;
      const next = this.pending;
      this.pending = null;
      if (next) void this.sync(next);
    });
    return this.running;
  }

  private async run(input: () => HealthExportInput | null): Promise<HealthExportResult> {
    const result: HealthExportResult = { saved: 0, removed: 0, failed: 0 };
    let status: HealthAuthorization;
    try {
      status = this.adapter.status();
    } catch {
      return result;
    }
    if (status !== 'authorized') return result;
    const current = input();
    if (!current) return result;
    const { history, since } = current;
    const plan = planHealthExport(history, this.ledger.loadAll(), since);
    for (const sessionId of plan.remove) {
      try {
        await this.adapter.remove(sessionId);
        this.ledger.remove(sessionId);
        result.removed += 1;
      } catch (error) {
        result.failed += 1;
        console.warn('[health] delete failed; will retry', error);
      }
    }
    for (const workout of plan.save) {
      try {
        const saved = await this.adapter.save(workout);
        this.ledger.put({ sessionId: workout.sessionId, fingerprint: workoutFingerprint(workout), healthUuid: saved.uuid, exportedAt: this.clock().toISOString() });
        result.saved += 1;
      } catch (error) {
        result.failed += 1;
        console.warn('[health] save failed; will retry', error);
      }
    }
    return result;
  }
}

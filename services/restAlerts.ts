import type { RestTimerState } from '@/types/workout';

/**
 * Rest-complete local notification (spec §10). The in-app chime covers the
 * foreground; this covers a locked phone or another app. One request with a
 * fixed identifier, cancelled and re-created whenever the end time changes,
 * so a paused, skipped, adjusted or finished timer never leaves a stale alert.
 */

export const REST_NOTIFICATION_ID = 'rest-complete';

export interface RestAlertContent {
  title: string;
  body: string;
}

export interface RestAlertAdapter {
  /** Schedules the single rest alert for `at` (epoch ms). */
  schedule(at: number, content: RestAlertContent): Promise<void>;
  /** Cancels the pending alert and removes a delivered one from Notification Center. */
  cancel(): Promise<void>;
}

/** Alerts closer than this are left to the in-app chime. */
const MIN_LEAD_MS = 1_000;

/** When the alert should fire, or null when there should be none. */
export function restAlertTime(timer: RestTimerState, enabled: boolean, now: number): number | null {
  if (!enabled || timer.status !== 'running' || timer.endsAt === null || timer.elapsedAt !== null) return null;
  return timer.endsAt - now >= MIN_LEAD_MS ? timer.endsAt : null;
}

/**
 * Serialises adapter calls so a fast pause → resume → +15 s sequence ends with
 * exactly the last request scheduled. Errors are swallowed: alerts are best-effort.
 */
export class RestAlertController {
  private current: number | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly adapter: RestAlertAdapter,
    private readonly content: () => RestAlertContent,
  ) {}

  sync(at: number | null): Promise<void> {
    if (at === this.current) return this.queue;
    this.current = at;
    const content = at === null ? null : this.content();
    this.queue = this.queue
      .then(async () => {
        await this.adapter.cancel();
        if (at !== null && content) await this.adapter.schedule(at, content);
      })
      .catch((error) => console.warn('[rest-alert] failed', error));
    return this.queue;
  }

  /** The end time currently scheduled (for tests and diagnostics). */
  get scheduledAt(): number | null {
    return this.current;
  }
}

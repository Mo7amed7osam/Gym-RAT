import { isPaused } from '@/domain/session/reducer';
import type { RestTimerState, WorkoutSession } from '@/types/workout';

/**
 * What the Lock Screen / Dynamic Island Live Activity shows. Strings arrive
 * translated because the widget runs in an isolated runtime without i18n.
 * Deliberately minimal: day, current exercise, set progress and timers. No
 * weights, reps, notes or body data.
 */
export interface WorkoutActivityProps {
  title: string;
  exercise: string;
  detail: string;
  /** Epoch ms such that now − activeStart = active workout time (pauses excluded). */
  activeStart: number;
  /** Set while the workout is paused: the moment it was paused. */
  pausedAt: number | null;
  /** Running rest: start/end of the countdown. */
  restStart: number | null;
  restEnd: number | null;
  /** Paused rest: seconds left, shown frozen. */
  restLeftSeconds: number | null;
  labels: { rest: string; restOver: string; paused: string; workout: string };
}

export interface ActivityText {
  title: (session: WorkoutSession) => string;
  exerciseName: (exerciseId: string) => string;
  setOf: (n: number, total: number) => string;
  done: string;
  labels: WorkoutActivityProps['labels'];
}

export function workoutActivityProps(
  session: WorkoutSession | null,
  timer: RestTimerState,
  text: ActivityText,
): WorkoutActivityProps | null {
  if (!session || session.status !== 'in_progress') return null;
  const current = session.exercises[session.currentExerciseIndex] ?? session.exercises[0];
  const counted = current ? current.sets : [];
  const next = counted.findIndex((set) => !set.completed);
  const detail = !current ? '' : next === -1 ? text.done : text.setOf(next + 1, counted.length);
  const paused = isPaused(session);
  const openPause = paused ? session.pausedIntervals.find((interval) => interval.to === null) : undefined;
  const pausedAt = openPause ? Date.parse(openPause.from) : null;
  // Closed pauses shift the start; an open pause freezes the clock at `pausedAt`.
  const closedPausedMs = session.pausedIntervals.reduce(
    (total, interval) => (interval.to === null ? total : total + Math.max(0, Date.parse(interval.to) - Date.parse(interval.from))),
    0,
  );
  const resting = timer.status === 'running' && timer.endsAt !== null && timer.elapsedAt === null;
  return {
    title: text.title(session),
    exercise: current ? text.exerciseName(current.exerciseId) : '',
    detail,
    activeStart: Date.parse(session.startedAt) + closedPausedMs,
    pausedAt,
    restStart: resting ? timer.endsAt! - timer.durationMs : null,
    restEnd: resting ? timer.endsAt : null,
    restLeftSeconds: timer.status === 'paused' ? Math.ceil((timer.pausedRemainingMs ?? 0) / 1000) : null,
    labels: text.labels,
  };
}

export interface ActivityHandle {
  update(props: WorkoutActivityProps, staleDate?: Date): Promise<void>;
  end(): Promise<void>;
}

export interface WorkoutActivityAdapter {
  /** Activities left over from an earlier process (app killed mid-workout). */
  existing(): ActivityHandle[];
  start(props: WorkoutActivityProps, staleDate?: Date): ActivityHandle;
}

const same = (a: WorkoutActivityProps | null, b: WorkoutActivityProps | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Keeps at most one Live Activity in step with the session: start on the
 * first in-progress state, update only when what it shows changes (timers
 * tick on their own in SwiftUI, so no per-second updates), end on finish,
 * discard or when the user turns it off. Every native call is guarded: an
 * unsupported device or a user who disabled Live Activities in iOS Settings
 * just gets no activity.
 */
export class WorkoutActivityController {
  private handle: ActivityHandle | null = null;
  private shown: WorkoutActivityProps | null = null;
  /** A start failed (unsupported device, disabled in iOS Settings): stop retrying until this workout ends. */
  private unavailable = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly adapter: WorkoutActivityAdapter) {}

  /** Adopts one leftover activity and ends the rest; call once at boot. */
  adopt(props: WorkoutActivityProps | null): Promise<void> {
    let leftovers: ActivityHandle[] = [];
    try {
      leftovers = this.adapter.existing();
    } catch (error) {
      console.warn('[live-activity] listing failed', error);
    }
    const [first, ...rest] = leftovers;
    this.enqueue(() => Promise.all(rest.map((handle) => handle.end())).then(() => undefined));
    if (first && props) {
      this.handle = first;
      this.shown = null; // force one update with the current state
    } else if (first) {
      this.enqueue(() => first.end());
    }
    return this.sync(props);
  }

  sync(props: WorkoutActivityProps | null): Promise<void> {
    if (!props) {
      const handle = this.handle;
      this.handle = null;
      this.shown = null;
      this.unavailable = false;
      if (handle) this.enqueue(() => handle.end());
      return this.queue;
    }
    if (this.unavailable || (this.handle && same(this.shown, props))) return this.queue;
    const staleDate = props.restEnd !== null ? new Date(props.restEnd) : undefined;
    this.shown = props;
    if (!this.handle) {
      // Started in queue order, so a restart never overtakes the previous end().
      let started: ActivityHandle | null = null;
      const pending: ActivityHandle = {
        update: (next, stale) => (started ? started.update(next, stale) : Promise.resolve()),
        end: () => (started ? started.end() : Promise.resolve()),
      };
      this.handle = pending;
      this.enqueue(async () => {
        try {
          started = this.adapter.start(props, staleDate);
        } catch (error) {
          console.warn('[live-activity] start failed', error);
          this.unavailable = true;
          if (this.handle === pending) this.handle = null;
        }
      });
      return this.queue;
    }
    const handle = this.handle;
    this.enqueue(() => handle.update(props, staleDate));
    return this.queue;
  }

  get active(): boolean {
    return this.handle !== null;
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error) => console.warn('[live-activity] failed', error));
  }
}

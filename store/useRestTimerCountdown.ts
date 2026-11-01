import { useEffect, useRef, useState } from 'react';

import { getRestRemainingMs, useWorkoutStore } from './useWorkoutStore';

export type RestTimerPhase = 'idle' | 'paused' | 'running' | 'warning' | 'overtime';

export interface RestTimerCountdown {
  phase: RestTimerPhase;
  /** Negative in overtime. */
  remainingMs: number;
  /** Whole seconds for display, rounded up while counting down. */
  remainingSeconds: number;
  durationMs: number;
  /** 0 → 1 elapsed fraction for the progress ring (clamped). */
  progress: number;
}

/**
 * Local ticking view of the timestamp-based rest timer. Only the component
 * using this hook re-renders each tick — the store itself never ticks.
 * `onElapsed` fires once when rest hits zero (haptics / sound go there);
 * pass it from exactly one mounted instance (RestTimerModal does this).
 */
export function useRestTimerCountdown(onElapsed?: () => void, tickMs: number = 250): RestTimerCountdown {
  const timer = useWorkoutStore((state) => state.restTimer);
  const warningSeconds = useWorkoutStore((state) => state.settings.restWarningSeconds);
  const markRestTimerElapsed = useWorkoutStore((state) => state.markRestTimerElapsed);
  const [now, setNow] = useState<number>(() => Date.now());

  const onElapsedRef = useRef(onElapsed);
  useEffect(() => {
    onElapsedRef.current = onElapsed;
  }, [onElapsed]);

  useEffect(() => {
    if (timer.status !== 'running') return;
    const tick = () => setNow(Date.now());
    // Refresh immediately so a freshly started / resumed timer isn't measured against a stale `now`.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, tickMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [timer.status, timer.endsAt, tickMs]);

  // Clamp: `now` freezes while idle, so a fresh timer's first frame could overshoot.
  const remainingMs = Math.min(getRestRemainingMs(timer, now), timer.durationMs);

  useEffect(() => {
    // Only the listening instance claims the "elapsed" event, so a second
    // countdown view (e.g. the sticky pill) can't swallow the alert.
    if (!onElapsedRef.current) return;
    if (timer.status === 'running' && timer.elapsedAt === null && remainingMs <= 0) {
      markRestTimerElapsed();
      onElapsedRef.current();
    }
  }, [timer.status, timer.elapsedAt, remainingMs, markRestTimerElapsed]);

  let phase: RestTimerPhase;
  if (timer.status === 'idle') phase = 'idle';
  else if (timer.status === 'paused') phase = 'paused';
  else if (remainingMs <= 0) phase = 'overtime';
  else if (remainingMs <= warningSeconds * 1000) phase = 'warning';
  else phase = 'running';

  const progress =
    timer.durationMs > 0 ? Math.min(Math.max(1 - remainingMs / timer.durationMs, 0), 1) : 0;

  return {
    phase,
    remainingMs,
    remainingSeconds: remainingMs >= 0 ? Math.ceil(remainingMs / 1000) : -Math.floor(-remainingMs / 1000),
    durationMs: timer.durationMs,
    progress,
  };
}

/** "1:42" / "-0:07" */
export function formatRestTime(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(totalSeconds);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
}

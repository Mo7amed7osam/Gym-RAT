import type { OfflineLease } from './types';

/**
 * Offline access policy (ADR-015). Pure: the session manager feeds it the
 * device clock and the persisted high-water mark (the largest device time
 * the app has ever seen). `effectiveNow = max(now, highWaterMark)`, so
 * moving the clock backwards never extends a lease; moving it forwards only
 * shortens one. A clock that sits noticeably below the high-water mark marks
 * the lease *suspect*: still usable offline, but it must be revalidated the
 * next time the server answers.
 */

/** Default lease length the server issues; the app never computes a lease itself. */
export const LEASE_DAYS = 7;

/** How far behind the high-water mark the clock may drift before it counts as rolled back. */
export const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;

/** Warn inside the app when this much of the lease is left. */
export const LEASE_WARNING_MS = 48 * 60 * 60 * 1000;

export type LeaseVerdict =
  | { state: 'valid'; remainingMs: number; effectiveNow: number; clockSuspect: boolean; warn: boolean }
  | { state: 'expired'; effectiveNow: number; clockSuspect: boolean }
  | { state: 'invalid'; reason: 'malformed' | 'wrong_user' };

export function effectiveNow(deviceNow: number, highWaterMark: number): number {
  return Math.max(deviceNow, Number.isFinite(highWaterMark) ? highWaterMark : 0);
}

export function isClockSuspect(deviceNow: number, highWaterMark: number): boolean {
  return Number.isFinite(highWaterMark) && deviceNow < highWaterMark - CLOCK_ROLLBACK_TOLERANCE_MS;
}

export function evaluateLease(lease: OfflineLease | null, userId: string | null, deviceNow: number, highWaterMark: number): LeaseVerdict {
  if (!lease) return { state: 'invalid', reason: 'malformed' };
  const expiresAt = Date.parse(lease.expiresAt);
  const issuedAt = Date.parse(lease.issuedAt);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(issuedAt) || expiresAt <= issuedAt) return { state: 'invalid', reason: 'malformed' };
  if (userId !== null && lease.userId !== userId) return { state: 'invalid', reason: 'wrong_user' };
  const now = effectiveNow(deviceNow, highWaterMark);
  const clockSuspect = isClockSuspect(deviceNow, highWaterMark);
  if (now >= expiresAt) return { state: 'expired', effectiveNow: now, clockSuspect };
  const remainingMs = expiresAt - now;
  return { state: 'valid', remainingMs, effectiveNow: now, clockSuspect, warn: remainingMs <= LEASE_WARNING_MS };
}

/** The new high-water mark after observing `deviceNow` (never decreases). */
export function advanceHighWaterMark(highWaterMark: number, deviceNow: number): number {
  return Math.max(Number.isFinite(highWaterMark) ? highWaterMark : 0, deviceNow);
}

/** Whole days left, rounded up, for UI copy ("5 days of offline access left"). */
export function leaseDaysLeft(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

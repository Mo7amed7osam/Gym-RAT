import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useWorkoutStore, type SyncOp } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';

/**
 * Offline-first sync: every write lands in the persisted store first and
 * queues a `SyncOp`; this module drains that outbox to the Postgres API
 * (server/) whenever the app is in the foreground and the server answers.
 * A failed request just leaves the queue intact — no network library needed.
 *
 * Configure with EXPO_PUBLIC_API_URL + EXPO_PUBLIC_API_TOKEN in .env.local.
 * Without them sync is off and the app stays fully local.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN;

/** Matches the server's per-request cap. */
const BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 15_000;
const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

interface SyncResponse {
  synced: string[];
  deleted: string[];
  failed: { id: string; error: string }[];
}

let inFlight: Promise<void> | null = null;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export const isSyncConfigured = (): boolean => Boolean(API_URL && API_TOKEN);

async function postBatch(upserts: WorkoutSession[], deletes: string[]): Promise<SyncResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/api/sessions/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TOKEN}` },
      body: JSON.stringify({ upserts, deletes }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`sync failed: HTTP ${response.status}`);
    return (await response.json()) as SyncResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function drainQueue(): Promise<void> {
  const { syncQueue, history, ackSyncOps } = useWorkoutStore.getState();
  const batch = syncQueue.slice(0, BATCH_SIZE);
  if (batch.length === 0) return;

  const sessionsById = new Map(history.map((session) => [session.id, session]));
  const upsertOps: SyncOp[] = [];
  const upserts: WorkoutSession[] = [];
  const deleteOps: SyncOp[] = [];
  const orphanOps: SyncOp[] = [];

  for (const op of batch) {
    if (op.kind === 'delete') {
      deleteOps.push(op);
      continue;
    }
    const session = sessionsById.get(op.sessionId);
    // Session vanished locally without a delete op (shouldn't happen) — nothing to send.
    if (!session) orphanOps.push(op);
    else {
      upsertOps.push(op);
      upserts.push(session);
    }
  }

  const result = await postBatch(
    upserts,
    deleteOps.map((op) => op.sessionId),
  );

  const done = new Set([...result.synced, ...result.deleted]);
  ackSyncOps([...orphanOps, ...[...upsertOps, ...deleteOps].filter((op) => done.has(op.sessionId))]);

  // Rejected rows (constraint violations) would fail forever; surface and keep them for inspection.
  if (result.failed.length > 0) {
    console.warn('[sync] server rejected sessions', result.failed);
    throw new Error('sync partially failed');
  }

  // More than one batch queued → keep going.
  if (syncQueue.length > BATCH_SIZE) await drainQueue();
}

function scheduleRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = Math.min(MIN_BACKOFF_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushSyncQueue();
  }, delay);
}

/** Sends queued ops upstream. Safe to call any time; concurrent calls share one run. */
export function flushSyncQueue(): Promise<void> {
  if (!isSyncConfigured()) return Promise.resolve();
  if (inFlight) return inFlight;

  inFlight = drainQueue()
    .then(() => {
      failures = 0;
    })
    .catch(() => {
      // Offline, server down or a rejected row: back off and try again later.
      failures += 1;
      scheduleRetry();
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Mount once at the root: flushes on launch, on every new queued op, and on return to foreground. */
export function useSyncQueue(): void {
  const pending = useWorkoutStore((state) => state.syncQueue.length);

  useEffect(() => {
    if (pending > 0) void flushSyncQueue();
  }, [pending]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void flushSyncQueue();
    });
    return () => subscription.remove();
  }, []);
}

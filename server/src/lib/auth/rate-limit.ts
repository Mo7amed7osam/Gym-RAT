import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

import { sha256 } from "./crypto";

/**
 * Fixed-window counters in Postgres (ADR-015). Keys are hashed so an email
 * never sits in the table in clear text. One statement, race-free thanks to
 * the upsert; good for a single-instance VPS and still correct with more.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(scope: string, identity: string, limit: number, windowSeconds: number, now = new Date()): Promise<RateLimitResult> {
  const key = `${scope}:${sha256(identity.toLowerCase())}`;
  const db = getDb();
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} <= ${now.toISOString()}::timestamptz - make_interval(secs => ${windowSeconds}) THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} <= ${now.toISOString()}::timestamptz - make_interval(secs => ${windowSeconds}) THEN ${now.toISOString()}::timestamptz ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });
  const row = rows[0];
  const count = row?.count ?? 1;
  const windowStart = row?.windowStart ? new Date(row.windowStart).getTime() : now.getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowSeconds * 1000 - now.getTime()) / 1000));
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
}

/** Clears a counter (e.g. after a successful login so a legitimate user is not locked by their own typos). */
export async function resetRateLimit(scope: string, identity: string): Promise<void> {
  const key = `${scope}:${sha256(identity.toLowerCase())}`;
  await getDb().delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
}

/** Housekeeping: drop windows older than a day. */
export async function pruneRateLimits(now = new Date()): Promise<void> {
  await getDb().delete(rateLimits).where(sql`${rateLimits.windowStart} < ${new Date(now.getTime() - 86_400_000).toISOString()}::timestamptz`);
}

export const LIMITS = {
  loginIp: { limit: 20, window: 15 * 60 },
  loginAccount: { limit: 5, window: 15 * 60 },
  refreshIp: { limit: 120, window: 60 },
  forgotIp: { limit: 5, window: 60 * 60 },
  forgotAccount: { limit: 3, window: 60 * 60 },
  tokenRedeemIp: { limit: 10, window: 15 * 60 },
  adminLoginIp: { limit: 10, window: 15 * 60 },
  adminTotpSession: { limit: 8, window: 15 * 60 },
} as const;

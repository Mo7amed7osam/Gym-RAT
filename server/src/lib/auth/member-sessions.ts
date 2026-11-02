import { and, eq, isNull, sql } from "drizzle-orm";

import { audit, type RequestContext } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { refreshTokens, users, type User } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

import { randomToken, sha256 } from "./crypto";
import { signAccessToken, verifyAccessToken } from "./jwt";
import { verifyPassword } from "./password";
import { LIMITS, consumeRateLimit, resetRateLimit } from "./rate-limit";

/**
 * Member (mobile) authentication (ADR-015): password login, rotating refresh
 * tokens with family reuse detection, access-token verification backed by a
 * live status check, and the offline lease the app stores.
 */

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
}

export interface OfflineLease {
  userId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SessionPayload {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  user: PublicUser;
  lease: OfflineLease;
  serverTime: string;
}

export const publicUser = (user: User): PublicUser => ({ id: user.id, email: user.email, displayName: user.displayName });

export function issueLease(userId: string, now = new Date()): OfflineLease {
  const days = env().OFFLINE_LEASE_DAYS;
  return { userId, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString() };
}

async function mintRefresh(user: User, familyId: string, ctx: RequestContext & { deviceName?: string | null }, now: Date, replaces?: string): Promise<string> {
  const raw = randomToken();
  const rows = await getDb()
    .insert(refreshTokens)
    .values({
      userId: user.id,
      familyId,
      tokenHash: sha256(raw),
      createdAt: now,
      expiresAt: new Date(now.getTime() + env().REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      lastSeenAt: now,
      deviceName: ctx.deviceName?.slice(0, 120) ?? null,
      ip: ctx.ip,
      userAgent: ctx.userAgent?.slice(0, 300) ?? null,
    })
    .returning({ id: refreshTokens.id });
  if (replaces) await getDb().update(refreshTokens).set({ replacedBy: rows[0].id }).where(eq(refreshTokens.id, replaces));
  return raw;
}

async function buildSession(user: User, familyId: string, refreshToken: string, now: Date): Promise<SessionPayload> {
  const access = await signAccessToken({ sub: user.id, fam: familyId, role: user.role }, now);
  return { accessToken: access.token, accessExpiresIn: access.expiresIn, refreshToken, user: publicUser(user), lease: issueLease(user.id, now), serverTime: now.toISOString() };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function loginMember(input: { email: string; password: string; deviceName?: string | null }, ctx: RequestContext, now = new Date()): Promise<SessionPayload> {
  const ipKey = ctx.ip ?? "unknown";
  const byIp = await consumeRateLimit("login:ip", ipKey, LIMITS.loginIp.limit, LIMITS.loginIp.window, now);
  const byAccount = await consumeRateLimit("login:account", `${ipKey}|${input.email}`, LIMITS.loginAccount.limit, LIMITS.loginAccount.window, now);
  if (!byIp.allowed || !byAccount.allowed) {
    const retry = Math.max(byIp.allowed ? 0 : byIp.retryAfterSeconds, byAccount.allowed ? 0 : byAccount.retryAfterSeconds);
    await audit({ ...ctx, actorType: "anonymous", action: "member.login.rate_limited", metadata: { email: input.email }, success: false });
    throw new HttpError(429, "rate_limited", undefined, { "Retry-After": String(retry) });
  }

  const user = await findUserByEmail(input.email);
  const ok = await verifyPassword(user?.passwordHash ?? null, input.password);
  if (!user || !ok || user.status === "invited") {
    await audit({ ...ctx, actorType: "anonymous", action: "member.login.failed", targetUserId: user?.id ?? null, metadata: { email: input.email, reason: !user ? "unknown" : !ok ? "password" : "invited" }, success: false });
    throw new HttpError(401, "invalid_credentials");
  }
  if (user.status === "disabled") {
    await audit({ ...ctx, actorType: "member", actorId: user.id, action: "member.login.disabled", targetUserId: user.id, success: false });
    throw new HttpError(403, "account_disabled");
  }

  const familyId = crypto.randomUUID();
  const refreshToken = await mintRefresh(user, familyId, { ...ctx, deviceName: input.deviceName }, now);
  await getDb().update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, user.id));
  await resetRateLimit("login:account", `${ipKey}|${input.email}`);
  await audit({ ...ctx, actorType: "member", actorId: user.id, action: "member.login", targetUserId: user.id, metadata: { deviceName: input.deviceName ?? null, familyId } });
  return buildSession(user, familyId, refreshToken, now);
}

/** Rotates a refresh token. A token presented twice revokes its whole family (theft or replay). */
export async function refreshMemberSession(rawToken: string, ctx: RequestContext, now = new Date()): Promise<SessionPayload> {
  const byIp = await consumeRateLimit("refresh:ip", ctx.ip ?? "unknown", LIMITS.refreshIp.limit, LIMITS.refreshIp.window, now);
  if (!byIp.allowed) throw new HttpError(429, "rate_limited", undefined, { "Retry-After": String(byIp.retryAfterSeconds) });

  const db = getDb();
  const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, sha256(rawToken))).limit(1);
  const row = rows[0];
  if (!row) throw new HttpError(401, "invalid_token");

  if (row.usedAt || row.revokedAt) {
    // Reuse: someone presented a spent token. Kill the family.
    await db.update(refreshTokens).set({ revokedAt: now }).where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
    await audit({ ...ctx, actorType: "member", actorId: row.userId, action: "member.refresh.reuse_detected", targetUserId: row.userId, metadata: { familyId: row.familyId }, success: false });
    throw new HttpError(401, "session_revoked");
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.update(refreshTokens).set({ revokedAt: now }).where(eq(refreshTokens.id, row.id));
    throw new HttpError(401, "session_revoked");
  }

  const userRows = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new HttpError(401, "invalid_token");
  if (user.status !== "active") {
    await db.update(refreshTokens).set({ revokedAt: now }).where(eq(refreshTokens.familyId, row.familyId));
    throw new HttpError(403, "account_disabled");
  }

  await db.update(refreshTokens).set({ usedAt: now, lastSeenAt: now }).where(eq(refreshTokens.id, row.id));
  const next = await mintRefresh(user, row.familyId, { ...ctx, deviceName: row.deviceName }, now, row.id);
  await audit({ ...ctx, actorType: "member", actorId: user.id, action: "member.refresh", targetUserId: user.id, metadata: { familyId: row.familyId } });
  return buildSession(user, row.familyId, next, now);
}

export type Authenticated = { user: User; familyId: string };

/** Verifies a bearer token and confirms, in the database, that the account and its session family are still live. */
export async function authenticateMember(request: Request, now = new Date()): Promise<Authenticated> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) throw new HttpError(401, "invalid_token");
  const verified = await verifyAccessToken(token, now);
  if (!verified.ok) throw new HttpError(401, verified.reason === "expired" ? "token_expired" : "invalid_token");

  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, verified.claims.sub)).limit(1);
  const user = userRows[0];
  if (!user) throw new HttpError(401, "invalid_token");
  if (user.status !== "active") throw new HttpError(403, "account_disabled");
  const live = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(and(eq(refreshTokens.familyId, verified.claims.fam), isNull(refreshTokens.revokedAt), isNull(refreshTokens.usedAt)))
    .limit(1);
  if (live.length === 0) throw new HttpError(401, "session_revoked");
  return { user, familyId: verified.claims.fam };
}

export async function logoutMember(rawToken: string, ctx: RequestContext, now = new Date()): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, sha256(rawToken))).limit(1);
  const row = rows[0];
  if (!row) return; // idempotent; never reveal
  await db.update(refreshTokens).set({ revokedAt: now }).where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
  await audit({ ...ctx, actorType: "member", actorId: row.userId, action: "member.logout", targetUserId: row.userId, metadata: { familyId: row.familyId } });
}

/** Admin action or password change: every device of the user signs out at its next contact. */
export async function revokeAllMemberSessions(userId: string, now = new Date()): Promise<number> {
  const rows = await getDb()
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  return rows.length;
}

export async function revokeFamily(userId: string, familyId: string, now = new Date()): Promise<number> {
  const rows = await getDb()
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  return rows.length;
}

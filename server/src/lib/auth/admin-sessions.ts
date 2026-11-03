import { and, eq, isNull } from "drizzle-orm";
import { Secret, TOTP } from "otpauth";

import { audit, type RequestContext } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { adminSessions, adminTotp, users, type AdminSession, type User } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

import { decryptSecret, encryptSecret, generateRecoveryCodes, randomToken, safeEqual, sha256 } from "./crypto";
import { verifyPassword } from "./password";
import { LIMITS, consumeRateLimit, resetRateLimit } from "./rate-limit";

/**
 * Admin dashboard sessions (ADR-015): opaque cookie token, hashed at rest,
 * absolute + idle expiry, mandatory TOTP (RFC 6238, 30 s, 6 digits, ±1 step)
 * with hashed recovery codes. The cookie itself is set by the route handler.
 */

export const ADMIN_COOKIE = "gymrat_admin";

export interface AdminAuth {
  session: AdminSession;
  user: User;
  /** TOTP enrolled and confirmed for this admin. */
  mfaEnrolled: boolean;
  /** This session passed the TOTP step. */
  mfaVerified: boolean;
}

/**
 * HttpOnly, Secure (on https), SameSite=Strict and host-only: there is no
 * Domain attribute, so the cookie belongs to the API host alone and is never
 * sent to the dashboard's host (ADR-018). The dashboard and the API are the
 * same site, so the Strict cookie still rides along on the dashboard's
 * credentialed requests.
 */
export function adminCookieOptions(expires: Date) {
  const secure = env().PUBLIC_ORIGIN.startsWith("https://");
  return { httpOnly: true, secure, sameSite: "strict" as const, path: "/", expires };
}

export async function startAdminSession(input: { email: string; password: string }, ctx: RequestContext, now = new Date()): Promise<{ rawToken: string; auth: AdminAuth }> {
  const byIp = await consumeRateLimit("admin-login:ip", ctx.ip ?? "unknown", LIMITS.adminLoginIp.limit, LIMITS.adminLoginIp.window, now);
  if (!byIp.allowed) throw new HttpError(429, "rate_limited", undefined, { "Retry-After": String(byIp.retryAfterSeconds) });

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
  const user = rows[0];
  const ok = await verifyPassword(user?.passwordHash ?? null, input.password);
  if (!user || !ok || user.role !== "admin" || user.status !== "active") {
    await audit({ ...ctx, actorType: "anonymous", action: "admin.login.failed", targetUserId: user?.id ?? null, metadata: { email: input.email }, success: false });
    throw new HttpError(401, "invalid_credentials");
  }

  const rawToken = randomToken();
  const e = env();
  const inserted = await db
    .insert(adminSessions)
    .values({
      userId: user.id,
      tokenHash: sha256(rawToken),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + e.ADMIN_SESSION_HOURS * 3_600_000),
      idleExpiresAt: new Date(now.getTime() + e.ADMIN_IDLE_MINUTES * 60_000),
      ip: ctx.ip,
      userAgent: ctx.userAgent?.slice(0, 300) ?? null,
    })
    .returning();
  await resetRateLimit("admin-login:ip", ctx.ip ?? "unknown");
  await audit({ ...ctx, actorType: "admin", actorId: user.id, action: "admin.login.password_ok", targetUserId: user.id });
  const totp = await db.select().from(adminTotp).where(eq(adminTotp.userId, user.id)).limit(1);
  return { rawToken, auth: { session: inserted[0], user, mfaEnrolled: Boolean(totp[0]?.confirmedAt), mfaVerified: false } };
}

/** Resolves the cookie to a live session; touches idle expiry. Null when missing, expired or revoked. */
export async function resolveAdminSession(rawToken: string | undefined | null, now = new Date()): Promise<AdminAuth | null> {
  if (!rawToken) return null;
  const db = getDb();
  const rows = await db.select().from(adminSessions).where(eq(adminSessions.tokenHash, sha256(rawToken))).limit(1);
  const session = rows[0];
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now.getTime() || session.idleExpiresAt.getTime() <= now.getTime()) return null;
  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = userRows[0];
  if (!user || user.role !== "admin" || user.status !== "active") return null;
  const idleExpiresAt = new Date(now.getTime() + env().ADMIN_IDLE_MINUTES * 60_000);
  await db.update(adminSessions).set({ lastSeenAt: now, idleExpiresAt }).where(eq(adminSessions.id, session.id));
  const totp = await db.select().from(adminTotp).where(eq(adminTotp.userId, user.id)).limit(1);
  return { session: { ...session, lastSeenAt: now, idleExpiresAt }, user, mfaEnrolled: Boolean(totp[0]?.confirmedAt), mfaVerified: session.totpVerifiedAt !== null };
}

/** The guard every admin endpoint uses: a session that finished MFA. */
export async function requireAdmin(rawToken: string | undefined | null, now = new Date()): Promise<AdminAuth> {
  const auth = await resolveAdminSession(rawToken, now);
  if (!auth) throw new HttpError(401, "unauthorized");
  if (!auth.mfaVerified) throw new HttpError(401, "mfa_required");
  return auth;
}

export async function revokeAdminSession(sessionId: string, now = new Date()): Promise<void> {
  await getDb().update(adminSessions).set({ revokedAt: now }).where(eq(adminSessions.id, sessionId));
}

export async function revokeOtherAdminSessions(userId: string, keepSessionId: string, now = new Date()): Promise<number> {
  const rows = await getDb()
    .update(adminSessions)
    .set({ revokedAt: now })
    .where(and(eq(adminSessions.userId, userId), isNull(adminSessions.revokedAt)))
    .returning({ id: adminSessions.id });
  // Re-open the current one (single statement would need NOT; keep it simple and explicit).
  await getDb().update(adminSessions).set({ revokedAt: null }).where(eq(adminSessions.id, keepSessionId));
  return rows.filter((row) => row.id !== keepSessionId).length;
}

// ─── TOTP ────────────────────────────────────────────────────────────────────

const totpFor = (secret: string, label: string) => new TOTP({ issuer: env().APP_NAME, label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });

/** Begins (or restarts an unconfirmed) enrolment. Returns the otpauth URI for the QR code. */
export async function beginTotpEnrolment(auth: AdminAuth): Promise<{ otpauthUri: string; secretBase32: string }> {
  if (auth.mfaEnrolled) throw new HttpError(409, "conflict", "TOTP already enrolled");
  const secret = new Secret({ size: 20 });
  const db = getDb();
  await db
    .insert(adminTotp)
    .values({ userId: auth.user.id, secretEncrypted: encryptSecret(secret.base32), confirmedAt: null, recoveryCodeHashes: [] })
    .onConflictDoUpdate({ target: adminTotp.userId, set: { secretEncrypted: encryptSecret(secret.base32), confirmedAt: null, recoveryCodeHashes: [] } });
  return { otpauthUri: totpFor(secret.base32, auth.user.email).toString(), secretBase32: secret.base32 };
}

/** Confirms enrolment with a first valid code; returns the recovery codes exactly once. */
export async function confirmTotpEnrolment(auth: AdminAuth, code: string, ctx: RequestContext, now = new Date()): Promise<{ recoveryCodes: string[] }> {
  const db = getDb();
  const rows = await db.select().from(adminTotp).where(eq(adminTotp.userId, auth.user.id)).limit(1);
  const row = rows[0];
  if (!row) throw new HttpError(409, "conflict", "Start enrolment first");
  if (row.confirmedAt) throw new HttpError(409, "conflict", "TOTP already enrolled");
  const delta = totpFor(decryptSecret(row.secretEncrypted), auth.user.email).validate({ token: code.replace(/\s+/g, ""), timestamp: now.getTime(), window: 1 });
  if (delta === null) {
    await audit({ ...ctx, actorType: "admin", actorId: auth.user.id, action: "admin.totp.confirm_failed", success: false });
    throw new HttpError(401, "invalid_credentials");
  }
  const recoveryCodes = generateRecoveryCodes();
  await db.update(adminTotp).set({ confirmedAt: now, recoveryCodeHashes: recoveryCodes.map(sha256) }).where(eq(adminTotp.userId, auth.user.id));
  await db.update(adminSessions).set({ totpVerifiedAt: now }).where(eq(adminSessions.id, auth.session.id));
  await audit({ ...ctx, actorType: "admin", actorId: auth.user.id, action: "admin.totp.enrolled" });
  return { recoveryCodes };
}

/** Second login step: a TOTP code or a recovery code. */
export async function verifyAdminMfa(auth: AdminAuth, code: string, ctx: RequestContext, now = new Date()): Promise<void> {
  const limit = await consumeRateLimit("admin-totp:session", auth.session.id, LIMITS.adminTotpSession.limit, LIMITS.adminTotpSession.window, now);
  if (!limit.allowed) throw new HttpError(429, "rate_limited", undefined, { "Retry-After": String(limit.retryAfterSeconds) });
  const db = getDb();
  const rows = await db.select().from(adminTotp).where(eq(adminTotp.userId, auth.user.id)).limit(1);
  const row = rows[0];
  if (!row?.confirmedAt) throw new HttpError(409, "conflict", "TOTP not enrolled");
  const cleaned = code.replace(/\s+/g, "").toLowerCase();
  const totpOk = /^\d{6}$/.test(cleaned) && totpFor(decryptSecret(row.secretEncrypted), auth.user.email).validate({ token: cleaned, timestamp: now.getTime(), window: 1 }) !== null;
  let recoveryUsed = false;
  if (!totpOk) {
    const hash = sha256(cleaned);
    const index = row.recoveryCodeHashes.findIndex((stored) => safeEqual(stored, hash));
    if (index === -1) {
      await audit({ ...ctx, actorType: "admin", actorId: auth.user.id, action: "admin.totp.failed", success: false });
      throw new HttpError(401, "invalid_credentials");
    }
    recoveryUsed = true;
    const remaining = row.recoveryCodeHashes.filter((_, i) => i !== index);
    await db.update(adminTotp).set({ recoveryCodeHashes: remaining }).where(eq(adminTotp.userId, auth.user.id));
  }
  await db.update(adminSessions).set({ totpVerifiedAt: now }).where(eq(adminSessions.id, auth.session.id));
  await db.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, auth.user.id));
  await resetRateLimit("admin-totp:session", auth.session.id);
  await audit({ ...ctx, actorType: "admin", actorId: auth.user.id, action: "admin.login", metadata: { recoveryCodeUsed: recoveryUsed } });
}

export async function recoveryCodesLeft(userId: string): Promise<number> {
  const rows = await getDb().select({ codes: adminTotp.recoveryCodeHashes }).from(adminTotp).where(eq(adminTotp.userId, userId)).limit(1);
  return rows[0]?.codes.length ?? 0;
}

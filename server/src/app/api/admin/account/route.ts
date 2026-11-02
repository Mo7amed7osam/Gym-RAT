import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { withAdmin } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { recoveryCodesLeft, revokeOtherAdminSessions } from "@/lib/auth/admin-sessions";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { getDb } from "@/lib/db";
import { adminSessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { HttpError, json, parseBody, requestContext } from "@/lib/http";

/** The admin's own account: sessions, recovery codes left, password change, mail status. */
export const GET = withAdmin(async (_request, auth) => {
  const sessions = await getDb()
    .select()
    .from(adminSessions)
    .where(and(eq(adminSessions.userId, auth.user.id), isNull(adminSessions.revokedAt)))
    .orderBy(desc(adminSessions.lastSeenAt));
  return json({
    user: { id: auth.user.id, email: auth.user.email, displayName: auth.user.displayName, lastLoginAt: auth.user.lastLoginAt?.toISOString() ?? null },
    recoveryCodesLeft: await recoveryCodesLeft(auth.user.id),
    mailConfigured: Boolean(env().SMTP_URL),
    publicOrigin: env().PUBLIC_ORIGIN,
    leaseDays: env().OFFLINE_LEASE_DAYS,
    inviteHours: env().INVITE_TTL_HOURS,
    resetMinutes: env().RESET_TTL_MINUTES,
    sessions: sessions
      .filter((row) => row.expiresAt.getTime() > Date.now() && row.idleExpiresAt.getTime() > Date.now())
      .map((row) => ({ id: row.id, current: row.id === auth.session.id, ip: row.ip, userAgent: row.userAgent, createdAt: row.createdAt.toISOString(), lastSeenAt: row.lastSeenAt.toISOString() })),
  });
});

const passwordSchema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(1).max(256) });

export const PATCH = withAdmin(async (request, auth) => {
  const body = await parseBody(request, passwordSchema);
  if (!(await verifyPassword(auth.user.passwordHash, body.currentPassword))) throw new HttpError(401, "invalid_credentials");
  const problems = passwordProblems(body.newPassword, auth.user.email);
  if (problems.length > 0) throw new HttpError(400, "weak_password", problems);
  await getDb().update(users).set({ passwordHash: await hashPassword(body.newPassword), passwordUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, auth.user.id));
  await revokeOtherAdminSessions(auth.user.id, auth.session.id);
  await audit({ ...requestContext(request), actorType: "admin", actorId: auth.user.id, action: "admin.password.changed", targetUserId: auth.user.id });
  return json({ ok: true });
});

/** Signs out every other admin browser session. */
export const DELETE = withAdmin(async (request, auth) => {
  const revoked = await revokeOtherAdminSessions(auth.user.id, auth.session.id);
  await audit({ ...requestContext(request), actorType: "admin", actorId: auth.user.id, action: "admin.sessions.revoked_others", metadata: { revoked } });
  return json({ revoked });
});

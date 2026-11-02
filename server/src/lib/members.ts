import { and, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { audit, type RequestContext } from "@/lib/audit";
import { assertInvitationsDeliverable, issueActionLink, type IssuedLink } from "@/lib/auth/action-tokens";
import { revokeAllMemberSessions, revokeFamily } from "@/lib/auth/member-sessions";
import { getDb } from "@/lib/db";
import { actionTokens, auditEvents, passwordResetRequests, refreshTokens, users, type User } from "@/lib/db/schema";
import { HttpError } from "@/lib/http";

/**
 * Admin account management (ADR-015 §5). Members only: the role column is
 * never written by anything here, so no API can promote a user to admin.
 */

export interface MemberSummary {
  id: string;
  email: string;
  displayName: string;
  status: User["status"];
  role: User["role"];
  lastLoginAt: string | null;
  createdAt: string;
  activeSessions: number;
  /** Latest unused invitation of an invited member: was the email accepted by the mail server? */
  invitation: InvitationState | null;
}

export interface InvitationState {
  emailStatus: "sending" | "sent" | "failed" | null;
  emailError: string | null;
  sentAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface MemberListQuery {
  search?: string;
  status?: User["status"] | "all";
  page?: number;
  pageSize?: number;
}

const toSummary = (row: User, activeSessions: number, invitation: InvitationState | null = null): MemberSummary => ({
  id: row.id,
  email: row.email,
  displayName: row.displayName,
  status: row.status,
  role: row.role,
  lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  activeSessions,
  invitation: row.status === "invited" ? invitation : null,
});

/** Latest unused invitation per invited member (delivery status for the dashboard). */
async function invitationsFor(userIds: string[], now = new Date()): Promise<Map<string, InvitationState>> {
  if (userIds.length === 0) return new Map();
  const rows = await getDb()
    .select()
    .from(actionTokens)
    .where(and(inArray(actionTokens.userId, userIds), eq(actionTokens.kind, "invite"), isNull(actionTokens.usedAt)))
    .orderBy(desc(actionTokens.createdAt));
  const out = new Map<string, InvitationState>();
  for (const row of rows) {
    if (out.has(row.userId)) continue;
    out.set(row.userId, {
      emailStatus: row.emailStatus,
      emailError: row.emailError,
      sentAt: (row.emailAttemptedAt ?? row.createdAt).toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      expired: row.expiresAt.getTime() <= now.getTime(),
    });
  }
  return out;
}

export async function listMembers(query: MemberListQuery): Promise<{ items: MemberSummary[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const search = query.search?.trim();
  const where = and(
    search ? or(ilike(users.email, `%${search}%`), ilike(users.displayName, `%${search}%`)) : undefined,
    query.status && query.status !== "all" ? eq(users.status, query.status) : undefined,
  );
  const rows = await db.select().from(users).where(where).orderBy(desc(users.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const totals = await db.select({ n: count() }).from(users).where(where);
  const sessions = rows.length
    ? await db
        .select({ userId: refreshTokens.userId, n: count() })
        .from(refreshTokens)
        .where(and(isNull(refreshTokens.revokedAt), isNull(refreshTokens.usedAt), gte(refreshTokens.expiresAt, new Date())))
        .groupBy(refreshTokens.userId)
    : [];
  const byUser = new Map(sessions.map((row) => [row.userId, Number(row.n)]));
  const invites = await invitationsFor(rows.filter((row) => row.status === "invited").map((row) => row.id));
  return { items: rows.map((row) => toSummary(row, byUser.get(row.id) ?? 0, invites.get(row.id) ?? null)), total: Number(totals[0]?.n ?? 0), page, pageSize };
}

export interface Stats {
  total: number;
  active: number;
  invited: number;
  disabled: number;
  admins: number;
  activeSessions: number;
  openResetRequests: number;
  recent: MemberSummary[];
  loginsLast7Days: number;
}

export async function stats(now = new Date()): Promise<Stats> {
  const db = getDb();
  const byStatus = await db.select({ status: users.status, role: users.role, n: count() }).from(users).groupBy(users.status, users.role);
  const sum = (predicate: (row: { status: User["status"]; role: User["role"] }) => boolean) => byStatus.filter(predicate).reduce((total, row) => total + Number(row.n), 0);
  const sessions = await db
    .select({ n: count() })
    .from(refreshTokens)
    .where(and(isNull(refreshTokens.revokedAt), isNull(refreshTokens.usedAt), gte(refreshTokens.expiresAt, now)));
  const resets = await db.select({ n: count() }).from(passwordResetRequests).where(isNull(passwordResetRequests.handledAt));
  const logins = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(and(eq(auditEvents.action, "member.login"), gte(auditEvents.at, new Date(now.getTime() - 7 * 86_400_000))));
  const recent = await listMembers({ page: 1, pageSize: 5 });
  return {
    total: sum((row) => row.role === "member"),
    active: sum((row) => row.role === "member" && row.status === "active"),
    invited: sum((row) => row.role === "member" && row.status === "invited"),
    disabled: sum((row) => row.role === "member" && row.status === "disabled"),
    admins: sum((row) => row.role === "admin"),
    activeSessions: Number(sessions[0]?.n ?? 0),
    openResetRequests: Number(resets[0]?.n ?? 0),
    recent: recent.items,
    loginsLast7Days: Number(logins[0]?.n ?? 0),
  };
}

export async function getMember(id: string): Promise<User> {
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) throw new HttpError(404, "not_found");
  return user;
}

export interface MemberDetail {
  member: MemberSummary;
  sessions: { familyId: string; deviceName: string | null; ip: string | null; createdAt: string; lastSeenAt: string; expiresAt: string }[];
  pendingLinks: { kind: string; expiresAt: string; delivery: string; createdAt: string; emailStatus: string | null; emailError: string | null }[];
  audit: { id: number; at: string; action: string; actorType: string; ip: string | null; success: boolean; metadata: Record<string, unknown> }[];
  openResetRequests: number;
}

export async function memberDetail(id: string, now = new Date()): Promise<MemberDetail> {
  const db = getDb();
  const user = await getMember(id);
  const live = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt), isNull(refreshTokens.usedAt), gte(refreshTokens.expiresAt, now)))
    .orderBy(desc(refreshTokens.lastSeenAt));
  const links = await db
    .select()
    .from(actionTokens)
    .where(and(eq(actionTokens.userId, id), isNull(actionTokens.usedAt), gte(actionTokens.expiresAt, now)))
    .orderBy(desc(actionTokens.createdAt));
  const events = await db.select().from(auditEvents).where(eq(auditEvents.targetUserId, id)).orderBy(desc(auditEvents.at)).limit(50);
  const resets = await db.select({ n: count() }).from(passwordResetRequests).where(and(eq(passwordResetRequests.userId, id), isNull(passwordResetRequests.handledAt)));
  return {
    member: toSummary(user, live.length, (await invitationsFor([user.id], now)).get(user.id) ?? null),
    sessions: live.map((row) => ({ familyId: row.familyId, deviceName: row.deviceName, ip: row.ip, createdAt: row.createdAt.toISOString(), lastSeenAt: row.lastSeenAt.toISOString(), expiresAt: row.expiresAt.toISOString() })),
    pendingLinks: links.map((row) => ({ kind: row.kind, expiresAt: row.expiresAt.toISOString(), delivery: row.delivery, createdAt: row.createdAt.toISOString(), emailStatus: row.emailStatus, emailError: row.emailError })),
    audit: events.map((row) => ({ id: row.id, at: row.at.toISOString(), action: row.action, actorType: row.actorType, ip: row.ip, success: row.success, metadata: row.metadata })),
    openResetRequests: Number(resets[0]?.n ?? 0),
  };
}

export async function createMember(input: { email: string; displayName: string }, admin: { id: string }, ctx: RequestContext, now = new Date()): Promise<{ member: MemberSummary; link: IssuedLink }> {
  // Invitations are emailed only: refuse before creating anything when the server cannot send mail.
  assertInvitationsDeliverable();
  const db = getDb();
  const existing = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email.toLowerCase()}`).limit(1);
  if (existing.length > 0) throw new HttpError(409, "conflict", "An account with this email already exists");
  const rows = await db
    .insert(users)
    .values({ email: input.email.toLowerCase(), displayName: input.displayName.trim(), role: "member", status: "invited", createdBy: admin.id, createdAt: now, updatedAt: now })
    .returning();
  const user = rows[0];
  await audit({ ...ctx, actorType: "admin", actorId: admin.id, action: "member.created", targetUserId: user.id, metadata: { email: user.email } });
  const link = await issueActionLink(user, "invite", { id: admin.id, type: "admin" }, ctx, now);
  return { member: toSummary(user, 0), link };
}

export async function updateMember(id: string, patch: { displayName?: string; status?: "active" | "disabled" }, admin: { id: string }, ctx: RequestContext, now = new Date()): Promise<MemberSummary> {
  const user = await getMember(id);
  if (user.role === "admin" && patch.status === "disabled" && user.id === admin.id) throw new HttpError(400, "validation", "You cannot disable your own account");
  if (patch.status && user.status === "invited" && patch.status === "active") throw new HttpError(400, "validation", "An invited member becomes active by setting a password");
  const db = getDb();
  const rows = await db
    .update(users)
    .set({ ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}), ...(patch.status ? { status: patch.status } : {}), updatedAt: now })
    .where(eq(users.id, id))
    .returning();
  if (patch.status === "disabled") {
    const revoked = await revokeAllMemberSessions(id, now);
    await audit({ ...ctx, actorType: "admin", actorId: admin.id, action: "member.disabled", targetUserId: id, metadata: { revokedSessions: revoked } });
  } else if (patch.status === "active") {
    await audit({ ...ctx, actorType: "admin", actorId: admin.id, action: "member.enabled", targetUserId: id });
  }
  if (patch.displayName !== undefined) await audit({ ...ctx, actorType: "admin", actorId: admin.id, action: "member.renamed", targetUserId: id });
  return toSummary(rows[0], 0);
}

export async function deleteMember(id: string, admin: { id: string }, ctx: RequestContext): Promise<void> {
  const user = await getMember(id);
  if (user.id === admin.id) throw new HttpError(400, "validation", "You cannot delete your own account");
  if (user.role === "admin") throw new HttpError(403, "forbidden", "Admins are removed from the server CLI, not the dashboard");
  await getDb().delete(users).where(eq(users.id, id));
  await audit({ ...ctx, actorType: "admin", actorId: admin.id, action: "member.deleted", targetUserId: id, metadata: { email: user.email } });
}

export async function revokeMemberSessions(id: string, admin: { id: string }, ctx: RequestContext, familyId?: string): Promise<number> {
  await getMember(id);
  const revoked = familyId ? await revokeFamily(id, familyId) : await revokeAllMemberSessions(id);
  await audit({ ...ctx, actorType: "admin", actorId: admin.id, action: familyId ? "member.session.revoked" : "member.sessions.revoked_all", targetUserId: id, metadata: { revoked, familyId: familyId ?? null } });
  return revoked;
}

export async function issueMemberLink(id: string, kind: "invite" | "reset", admin: { id: string }, ctx: RequestContext, now = new Date()): Promise<IssuedLink> {
  const user = await getMember(id);
  if (user.role === "admin") throw new HttpError(403, "forbidden");
  if (user.status === "disabled") throw new HttpError(400, "validation", "Enable the account first");
  if (kind === "invite" && user.status !== "invited") throw new HttpError(400, "validation", "This member already has a password; send a reset link instead");
  if (kind === "reset" && user.status === "invited") throw new HttpError(400, "validation", "This member has not set a password yet; send a new invitation instead");
  const link = await issueActionLink(user, kind, { id: admin.id, type: "admin" }, ctx, now);
  if (kind === "reset") {
    await getDb()
      .update(passwordResetRequests)
      .set({ handledAt: now, handledBy: admin.id })
      .where(and(eq(passwordResetRequests.userId, id), isNull(passwordResetRequests.handledAt)));
  }
  return link;
}

export interface SessionRow {
  familyId: string;
  userId: string;
  email: string;
  displayName: string;
  deviceName: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export async function listActiveSessions(now = new Date()): Promise<SessionRow[]> {
  const rows = await getDb()
    .select({ token: refreshTokens, email: users.email, displayName: users.displayName })
    .from(refreshTokens)
    .innerJoin(users, eq(users.id, refreshTokens.userId))
    .where(and(isNull(refreshTokens.revokedAt), isNull(refreshTokens.usedAt), gte(refreshTokens.expiresAt, now)))
    .orderBy(desc(refreshTokens.lastSeenAt))
    .limit(500);
  return rows.map(({ token, email, displayName }) => ({
    familyId: token.familyId,
    userId: token.userId,
    email,
    displayName,
    deviceName: token.deviceName,
    ip: token.ip,
    createdAt: token.createdAt.toISOString(),
    lastSeenAt: token.lastSeenAt.toISOString(),
    expiresAt: token.expiresAt.toISOString(),
  }));
}

export async function listResetRequests(): Promise<{ id: string; email: string; userId: string | null; requestedAt: string; ip: string | null }[]> {
  const rows = await getDb().select().from(passwordResetRequests).where(isNull(passwordResetRequests.handledAt)).orderBy(desc(passwordResetRequests.requestedAt)).limit(200);
  return rows.map((row) => ({ id: row.id, email: row.email, userId: row.userId, requestedAt: row.requestedAt.toISOString(), ip: row.ip }));
}

export async function dismissResetRequest(id: string, admin: { id: string }): Promise<void> {
  await getDb().update(passwordResetRequests).set({ handledAt: new Date(), handledBy: admin.id }).where(eq(passwordResetRequests.id, id));
}

export async function listAudit(query: { page?: number; pageSize?: number; action?: string; targetUserId?: string }): Promise<{ items: { id: number; at: string; actorType: string; actorId: string | null; action: string; targetUserId: string | null; targetEmail: string | null; ip: string | null; success: boolean; metadata: Record<string, unknown> }[]; total: number; page: number; pageSize: number }> {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
  const where = and(query.action ? ilike(auditEvents.action, `${query.action}%`) : undefined, query.targetUserId ? eq(auditEvents.targetUserId, query.targetUserId) : undefined);
  const rows = await db
    .select({ event: auditEvents, targetEmail: users.email })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.targetUserId))
    .where(where)
    .orderBy(desc(auditEvents.at))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totals = await db.select({ n: count() }).from(auditEvents).where(where);
  return {
    items: rows.map(({ event, targetEmail }) => ({
      id: event.id,
      at: event.at.toISOString(),
      actorType: event.actorType,
      actorId: event.actorId,
      action: event.action,
      targetUserId: event.targetUserId,
      targetEmail,
      ip: event.ip,
      success: event.success,
      metadata: event.metadata,
    })),
    total: Number(totals[0]?.n ?? 0),
    page,
    pageSize,
  };
}

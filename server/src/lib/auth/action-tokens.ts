import { and, eq, isNull } from "drizzle-orm";

import { audit, type RequestContext } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { actionTokens, passwordResetRequests, users, type ActionToken, type User } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { MailDeliveryError, mailConfig, sendMail } from "@/lib/mail";

import { randomToken, sha256 } from "./crypto";
import { revokeAllMemberSessions } from "./member-sessions";
import { hashPassword, passwordProblems } from "./password";
import { LIMITS, consumeRateLimit } from "./rate-limit";

/**
 * One-time links (ADR-015): invitations let a new member choose their first
 * password; resets let an existing member replace theirs. The server stores
 * only the SHA-256 of the token. Issuing a new link of the same kind
 * invalidates older unused ones.
 *
 * Invitations are always emailed (owner decision 2026-11-02): without SMTP
 * configuration they are refused, and a failed send is recorded on the link
 * (email_status = failed + reason) for the dashboard; the URL is never handed
 * to the admin instead. Reset links keep the earlier behaviour: emailed when
 * SMTP works, otherwise returned once for the admin to share by hand.
 */

export type ActionKind = ActionToken["kind"];

export interface IssuedLink {
  /** Present only for manual delivery (reset links without working email). Never for invitations. */
  url?: string;
  expiresAt: string;
  delivery: "email" | "manual";
  kind: ActionKind;
  /** For emailed links: whether the SMTP server accepted the message. */
  emailStatus: "sent" | "failed" | null;
  emailError: string | null;
}

/** Refuses an invitation up front when the server cannot email it. */
export function assertInvitationsDeliverable(): void {
  if (!mailConfig()) {
    throw new HttpError(503, "email_not_configured", "Outbound email is not configured on the server (SMTP_HOST, SMTP_FROM). Members are invited by email only; set it up before inviting.");
  }
}

function linkEmail(kind: ActionKind, user: User, url: string, expiresAt: Date): { subject: string; text: string } {
  const app = env().APP_NAME;
  if (kind === "reset") {
    return {
      subject: `${app}: reset your password`,
      text: `Hi ${user.displayName},\n\nUse this link to choose a new ${app} password. It works once and expires at ${expiresAt.toISOString()}.\n\n${url}\n\nIf you did not ask for this, ignore this email.`,
    };
  }
  return {
    subject: `${app}: set up your account`,
    text: `Hi ${user.displayName},\n\nAn account was created for you in ${app}. Open this link to choose your password. It works once and expires at ${expiresAt.toISOString()}.\n\n${url}\n\nNobody else knows or receives your password. If you were not expecting this, ignore this email.`,
  };
}

const ttlMs = (kind: ActionKind): number => {
  const e = env();
  return kind === "reset" ? e.RESET_TTL_MINUTES * 60_000 : e.INVITE_TTL_HOURS * 3_600_000;
};

const pathFor = (kind: ActionKind): string => (kind === "reset" ? "/reset" : kind === "invite" ? "/invite" : "/setup");

export async function issueActionLink(user: User, kind: ActionKind, actor: { id: string | null; type: "admin" | "system" }, ctx: RequestContext, now = new Date()): Promise<IssuedLink> {
  if (kind === "invite") assertInvitationsDeliverable();
  const db = getDb();
  await db
    .update(actionTokens)
    .set({ usedAt: now })
    .where(and(eq(actionTokens.userId, user.id), eq(actionTokens.kind, kind), isNull(actionTokens.usedAt)));
  const raw = randomToken();
  const expiresAt = new Date(now.getTime() + ttlMs(kind));
  const url = `${env().PUBLIC_ORIGIN}${pathFor(kind)}/${raw}`;
  const emailed = kind === "invite" || mailConfig() !== null;
  const inserted = await db
    .insert(actionTokens)
    .values({
      userId: user.id,
      kind,
      tokenHash: sha256(raw),
      createdAt: now,
      expiresAt,
      createdBy: actor.id,
      delivery: emailed ? "email" : "manual",
      emailStatus: emailed ? "sending" : null,
      emailAttemptedAt: emailed ? now : null,
    })
    .returning({ id: actionTokens.id });

  let emailStatus: "sent" | "failed" | null = null;
  let emailError: string | null = null;
  if (emailed) {
    try {
      await sendMail({ to: user.email, ...linkEmail(kind, user, url, expiresAt) });
      emailStatus = "sent";
    } catch (error) {
      emailStatus = "failed";
      emailError = error instanceof MailDeliveryError ? error.message : "Unknown email error";
    }
    await db.update(actionTokens).set({ emailStatus, emailError }).where(eq(actionTokens.id, inserted[0].id));
  }
  // A reset link whose email failed is still shown once to the admin (unchanged behaviour); an invitation never is.
  const delivery: "email" | "manual" = kind !== "invite" && emailStatus !== "sent" ? "manual" : "email";
  if (delivery === "manual" && emailed) await db.update(actionTokens).set({ delivery: "manual" }).where(eq(actionTokens.id, inserted[0].id));
  await audit({
    ...ctx,
    actorType: actor.type,
    actorId: actor.id,
    action: `link.issued.${kind}`,
    targetUserId: user.id,
    success: emailStatus !== "failed" || kind !== "invite",
    metadata: { delivery, emailStatus, emailError, expiresAt: expiresAt.toISOString() },
  });
  return { ...(delivery === "manual" ? { url } : {}), expiresAt: expiresAt.toISOString(), delivery, kind, emailStatus, emailError };
}

export interface TokenPreview {
  kind: ActionKind;
  email: string;
  displayName: string;
  expiresAt: string;
}

async function loadLive(raw: string, now: Date): Promise<{ token: ActionToken; user: User }> {
  const db = getDb();
  const rows = await db.select().from(actionTokens).where(eq(actionTokens.tokenHash, sha256(raw))).limit(1);
  const token = rows[0];
  if (!token || token.usedAt || token.expiresAt.getTime() <= now.getTime()) throw new HttpError(404, "not_found");
  const userRows = await db.select().from(users).where(eq(users.id, token.userId)).limit(1);
  const user = userRows[0];
  if (!user || user.status === "disabled") throw new HttpError(404, "not_found");
  return { token, user };
}

/** What the set-password page shows before the form (no secrets). */
export async function previewActionToken(raw: string, ctx: RequestContext, now = new Date()): Promise<TokenPreview> {
  const limit = await consumeRateLimit("token:ip", ctx.ip ?? "unknown", LIMITS.tokenRedeemIp.limit, LIMITS.tokenRedeemIp.window, now);
  if (!limit.allowed) throw new HttpError(429, "rate_limited", undefined, { "Retry-After": String(limit.retryAfterSeconds) });
  const { token, user } = await loadLive(raw, now);
  return { kind: token.kind, email: user.email, displayName: user.displayName, expiresAt: token.expiresAt.toISOString() };
}

/** Sets the password, activates an invited account, signs every device out and burns the link. */
export async function redeemActionToken(raw: string, password: string, ctx: RequestContext, now = new Date()): Promise<{ kind: ActionKind; email: string }> {
  const limit = await consumeRateLimit("token:ip", ctx.ip ?? "unknown", LIMITS.tokenRedeemIp.limit, LIMITS.tokenRedeemIp.window, now);
  if (!limit.allowed) throw new HttpError(429, "rate_limited", undefined, { "Retry-After": String(limit.retryAfterSeconds) });
  const { token, user } = await loadLive(raw, now);
  const problems = passwordProblems(password, user.email);
  if (problems.length > 0) throw new HttpError(400, "weak_password", problems);

  const db = getDb();
  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, passwordUpdatedAt: now, updatedAt: now, status: user.status === "invited" ? "active" : user.status })
    .where(eq(users.id, user.id));
  await db.update(actionTokens).set({ usedAt: now }).where(eq(actionTokens.id, token.id));
  await revokeAllMemberSessions(user.id, now);
  await db.update(passwordResetRequests).set({ handledAt: now }).where(and(eq(passwordResetRequests.userId, user.id), isNull(passwordResetRequests.handledAt)));
  await audit({ ...ctx, actorType: "member", actorId: user.id, action: `link.redeemed.${token.kind}`, targetUserId: user.id });
  return { kind: token.kind, email: user.email };
}

/**
 * "Forgot password" from the app. Always resolves; the caller answers 202
 * whatever happened. With SMTP a reset link goes out at once; without it the
 * request waits in the dashboard for the admin.
 */
export async function requestPasswordReset(email: string, ctx: RequestContext, now = new Date()): Promise<void> {
  const ipKey = ctx.ip ?? "unknown";
  const byIp = await consumeRateLimit("forgot:ip", ipKey, LIMITS.forgotIp.limit, LIMITS.forgotIp.window, now);
  const byAccount = await consumeRateLimit("forgot:account", email, LIMITS.forgotAccount.limit, LIMITS.forgotAccount.window, now);
  if (!byIp.allowed || !byAccount.allowed) {
    await audit({ ...ctx, actorType: "anonymous", action: "member.forgot.rate_limited", metadata: { email }, success: false });
    return;
  }
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  const user = rows[0];
  const inserted = await db
    .insert(passwordResetRequests)
    .values({ userId: user && user.status === "active" ? user.id : null, email: email.toLowerCase(), requestedAt: now, ip: ctx.ip })
    .returning({ id: passwordResetRequests.id });
  await audit({ ...ctx, actorType: "anonymous", action: "member.forgot.requested", targetUserId: user?.id ?? null, metadata: { email, known: Boolean(user) } });
  if (user && user.status === "active" && mailConfig()) {
    const link = await issueActionLink(user, "reset", { id: null, type: "system" }, ctx, now);
    if (link.delivery === "email") await db.update(passwordResetRequests).set({ handledAt: now }).where(eq(passwordResetRequests.id, inserted[0].id));
  }
}

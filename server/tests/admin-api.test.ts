import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { GET as linkGet, POST as linkPost } from "@/app/api/auth/links/[token]/route";
import { DELETE as accountDelete, GET as accountGet, PATCH as accountPatch } from "@/app/api/admin/account/route";
import { GET as auditGet } from "@/app/api/admin/audit/route";
import { POST as membersPost, GET as membersGet } from "@/app/api/admin/members/route";
import { DELETE as memberDelete, GET as memberGet, PATCH as memberPatch } from "@/app/api/admin/members/[id]/route";
import { POST as memberLinks } from "@/app/api/admin/members/[id]/links/route";
import { DELETE as memberSessions } from "@/app/api/admin/members/[id]/sessions/route";
import { POST as mfaEnrolBegin, PUT as mfaEnrolConfirm } from "@/app/api/admin/mfa/enrol/route";
import { GET as resetRequestsGet } from "@/app/api/admin/reset-requests/route";
import { DELETE as sessionDelete, GET as sessionGet, POST as sessionPost } from "@/app/api/admin/session/route";
import { POST as sessionMfa } from "@/app/api/admin/session/mfa/route";
import { GET as sessionsGet } from "@/app/api/admin/sessions/route";
import { GET as statsGet } from "@/app/api/admin/stats/route";
import { getDb } from "@/lib/db";
import { actionTokens, users } from "@/lib/db/schema";

import { STRONG, body, browserReq, cookieFrom, currentTotp, lastMailedLink, params, req, seedUser } from "./helpers";
import { setEnvForTests, env } from "@/lib/env";
import { setMailSenderForTests } from "@/lib/mail";
import { outbox } from "./helpers";

/**
 * Admin dashboard API: cookie session + mandatory TOTP, CSRF origin check,
 * admin-only authorization (members and anonymous callers are refused),
 * member lifecycle (create → invitation → activate → disable → revoke → delete),
 * password reset initiation, audit, and the rule that nothing can grant admin.
 */

let adminCookie = "";
let adminId = "";

async function loginAdmin(email: string, password: string, ip = "203.0.113.50") {
  const res = await sessionPost(browserReq("/api/admin/session", { body: { email, password }, ip }));
  return res;
}

describe("admin session", () => {
  it("password step sets an HttpOnly Secure SameSite=Strict cookie and reports MFA pending", async () => {
    const admin = await seedUser({ email: "owner@example.com", password: STRONG, role: "admin", displayName: "Owner" });
    adminId = admin.id;
    const res = await loginAdmin("owner@example.com", STRONG);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(await body(res)).toMatchObject({ mfaEnrolled: false, mfaVerified: false });
    adminCookie = cookieFrom(res);
  });

  it("refuses the password step without a matching Origin (CSRF) and a member's credentials", async () => {
    await seedUser({ email: "member@example.com", password: STRONG });
    const csrf = await sessionPost(req("/api/admin/session", { body: { email: "owner@example.com", password: STRONG }, headers: { origin: "https://evil.example" } }));
    expect(csrf.status).toBe(403);
    expect(await body(csrf)).toEqual({ error: "csrf" });
    const member = await sessionPost(browserReq("/api/admin/session", { body: { email: "member@example.com", password: STRONG } }));
    expect(member.status).toBe(401);
    expect(await body(member)).toEqual({ error: "invalid_credentials" });
  });

  it("every admin endpoint is closed before MFA, and to anonymous callers", async () => {
    expect((await statsGet(req("/api/admin/stats"), {})).status).toBe(401);
    const pending = await statsGet(req("/api/admin/stats", { cookie: adminCookie }), {});
    expect(pending.status).toBe(401);
    expect(await body(pending)).toEqual({ error: "mfa_required" });
    expect((await membersGet(req("/api/admin/members", { cookie: "gymrat_admin=forged" }), {})).status).toBe(401);
  });

  it("enrols TOTP (QR + secret), confirms with a live code, returns recovery codes once, and the session is then verified", async () => {
    const begin = await mfaEnrolBegin(browserReq("/api/admin/mfa/enrol", { method: "POST", cookie: adminCookie }));
    expect(begin.status).toBe(200);
    const enrol = await body<{ otpauthUri: string; secretBase32: string; qrDataUrl: string }>(begin);
    expect(enrol.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(enrol.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    const bad = await mfaEnrolConfirm(browserReq("/api/admin/mfa/enrol", { method: "PUT", body: { code: "000000" }, cookie: adminCookie }));
    expect(bad.status).toBe(401);

    const code = await currentTotp(adminId);
    const confirm = await mfaEnrolConfirm(browserReq("/api/admin/mfa/enrol", { method: "PUT", body: { code }, cookie: adminCookie }));
    expect(confirm.status).toBe(200);
    const { recoveryCodes } = await body<{ recoveryCodes: string[] }>(confirm);
    expect(recoveryCodes).toHaveLength(10);

    const who = await sessionGet(req("/api/admin/session", { cookie: adminCookie }));
    expect(await body(who)).toMatchObject({ authenticated: true, mfaEnrolled: true, mfaVerified: true });
    // Enrolment cannot be restarted once confirmed.
    expect((await mfaEnrolBegin(browserReq("/api/admin/mfa/enrol", { method: "POST", cookie: adminCookie }))).status).toBe(409);
  });

  it("a fresh login needs the TOTP step; wrong codes are limited; a recovery code works once", async () => {
    const res = await loginAdmin("owner@example.com", STRONG, "203.0.113.51");
    const cookie = cookieFrom(res);
    expect(await body(res)).toMatchObject({ mfaEnrolled: true, mfaVerified: false });
    expect((await statsGet(req("/api/admin/stats", { cookie }), {})).status).toBe(401);

    const wrong = await sessionMfa(browserReq("/api/admin/session/mfa", { body: { code: "123456" }, cookie }));
    expect(wrong.status).toBe(401);
    const ok = await sessionMfa(browserReq("/api/admin/session/mfa", { body: { code: await currentTotp(adminId) }, cookie }));
    expect(ok.status).toBe(200);
    expect((await statsGet(req("/api/admin/stats", { cookie }), {})).status).toBe(200);

    // Burn through the per-session limit with a third session.
    const third = cookieFrom(await loginAdmin("owner@example.com", STRONG, "203.0.113.52"));
    let last: Response | null = null;
    for (let i = 0; i < 9; i += 1) last = await sessionMfa(browserReq("/api/admin/session/mfa", { body: { code: "000000" }, cookie: third }));
    expect(last!.status).toBe(429);
  });

  it("logout revokes the session and clears the cookie", async () => {
    const cookie = cookieFrom(await loginAdmin("owner@example.com", STRONG, "203.0.113.53"));
    await sessionMfa(browserReq("/api/admin/session/mfa", { body: { code: await currentTotp(adminId) }, cookie }));
    const out = await sessionDelete(browserReq("/api/admin/session", { method: "DELETE", cookie }));
    expect(out.status).toBe(204);
    expect(out.headers.get("set-cookie")).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await statsGet(req("/api/admin/stats", { cookie }), {})).status).toBe(401);
  });
});

describe("member management", () => {
  let memberId = "";
  let inviteToken = "";

  it("creates a member and emails a one-time invitation; the admin never sees the link", async () => {
    const res = await membersPost(browserReq("/api/admin/members", { body: { email: "Nour@Example.com", displayName: "Nour" }, cookie: adminCookie }), {});
    expect(res.status).toBe(201);
    const created = await body<{ member: { id: string; email: string; status: string; role: string }; link: { url?: string; delivery: string; kind: string; emailStatus: string } }>(res);
    expect(created.member).toMatchObject({ email: "nour@example.com", status: "invited", role: "member" });
    expect(created.link).toMatchObject({ delivery: "email", kind: "invite", emailStatus: "sent" });
    expect(created.link.url).toBeUndefined();
    memberId = created.member.id;
    const mail = lastMailedLink("nour@example.com");
    expect(mail.url).toMatch(/^https:\/\/api\.gymrat\.test\/invite\/[A-Za-z0-9_-]{43}$/);
    expect(mail.text).toMatch(/expires in 72 hours/);
    expect(mail.text).not.toMatch(/password:/i);
    inviteToken = mail.token;
    const stored = await getDb().select().from(actionTokens).where(eq(actionTokens.userId, memberId));
    expect(stored[0].tokenHash).not.toContain(inviteToken);
    expect(stored[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored[0]).toMatchObject({ delivery: "email", emailStatus: "sent", emailError: null });

    const dup = await membersPost(browserReq("/api/admin/members", { body: { email: "nour@example.com", displayName: "Dup" }, cookie: adminCookie }), {});
    expect(dup.status).toBe(409);
  });

  it("no request can set the role: the create and patch schemas ignore/refuse it", async () => {
    const res = await membersPost(browserReq("/api/admin/members", { body: { email: "sneaky@example.com", displayName: "Sneaky", role: "admin" }, cookie: adminCookie }), {});
    expect(res.status).toBe(201);
    expect((await body<{ member: { role: string } }>(res)).member.role).toBe("member");
    const id = (await getDb().select().from(users).where(eq(users.email, "sneaky@example.com")))[0].id;
    const patch = await memberPatch(browserReq(`/api/admin/members/${id}`, { method: "PATCH", body: { role: "admin" }, cookie: adminCookie }), params({ id }));
    expect(patch.status).toBe(400);
    expect((await getDb().select().from(users).where(eq(users.id, id)))[0].role).toBe("member");
  });

  it("the invited member activates through the link and then appears active with a login", async () => {
    expect((await linkGet(req(`/api/auth/links/${inviteToken}`), params({ token: inviteToken }))).status).toBe(200);
    expect((await linkPost(req(`/api/auth/links/${inviteToken}`, { body: { password: STRONG } }), params({ token: inviteToken }))).status).toBe(200);
    const session = await login(req("/api/auth/login", { body: { email: "nour@example.com", password: STRONG, deviceName: "Nour's iPhone" } }));
    expect(session.status).toBe(200);
    const list = await membersGet(req("/api/admin/members?q=nour", { cookie: adminCookie }), {});
    const page = await body<{ items: { id: string; status: string; activeSessions: number; lastLoginAt: string | null }[]; total: number }>(list);
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({ id: memberId, status: "active", activeSessions: 1 });
    expect(page.items[0].lastLoginAt).not.toBeNull();
  });

  it("member detail lists devices and audit; a member token cannot read admin endpoints", async () => {
    const detail = await memberGet(req(`/api/admin/members/${memberId}`, { cookie: adminCookie }), params({ id: memberId }));
    expect(detail.status).toBe(200);
    const data = await body<{ sessions: { deviceName: string }[]; audit: { action: string }[] }>(detail);
    expect(data.sessions[0].deviceName).toBe("Nour's iPhone");
    expect(data.audit.map((event) => event.action)).toEqual(expect.arrayContaining(["member.created", "link.issued.invite", "link.redeemed.invite", "member.login"]));

    const memberSession = await body<{ accessToken: string }>(await login(req("/api/auth/login", { body: { email: "nour@example.com", password: STRONG } })));
    const forbidden = await membersGet(req("/api/admin/members", { headers: { authorization: `Bearer ${memberSession.accessToken}` } }), {});
    expect(forbidden.status).toBe(401);
  });

  it("disabling revokes devices and blocks login; enabling restores; invitations/resets follow the state", async () => {
    const memberSession = await body<{ accessToken: string }>(await login(req("/api/auth/login", { body: { email: "nour@example.com", password: STRONG } })));
    const disable = await memberPatch(browserReq(`/api/admin/members/${memberId}`, { method: "PATCH", body: { status: "disabled" }, cookie: adminCookie }), params({ id: memberId }));
    expect(disable.status).toBe(200);
    expect((await meRoute(req("/api/auth/me", { headers: { authorization: `Bearer ${memberSession.accessToken}` } }))).status).toBe(403);
    expect((await login(req("/api/auth/login", { body: { email: "nour@example.com", password: STRONG } }))).status).toBe(403);
    expect((await memberLinks(browserReq(`/api/admin/members/${memberId}/links`, { body: { kind: "reset" }, cookie: adminCookie }), params({ id: memberId }))).status).toBe(400);

    const enable = await memberPatch(browserReq(`/api/admin/members/${memberId}`, { method: "PATCH", body: { status: "active", displayName: "Nour A." }, cookie: adminCookie }), params({ id: memberId }));
    expect(enable.status).toBe(200);
    expect((await login(req("/api/auth/login", { body: { email: "nour@example.com", password: STRONG } }))).status).toBe(200);
    // An active member gets reset links, not invitations.
    expect((await memberLinks(browserReq(`/api/admin/members/${memberId}/links`, { body: { kind: "invite" }, cookie: adminCookie }), params({ id: memberId }))).status).toBe(400);
    const reset = await memberLinks(browserReq(`/api/admin/members/${memberId}/links`, { body: { kind: "reset" }, cookie: adminCookie }), params({ id: memberId }));
    expect(reset.status).toBe(201);
    expect(await body(reset)).toMatchObject({ kind: "reset", delivery: "email", emailStatus: "sent" });
    expect(lastMailedLink("nour@example.com").url).toMatch(/\/reset\//);
  });

  it("revoke sessions (one family, then all) signs devices out", async () => {
    const a = await body<{ accessToken: string }>(await login(req("/api/auth/login", { body: { email: "nour@example.com", password: STRONG }, ip: "203.0.113.60" })));
    const b = await body<{ accessToken: string }>(await login(req("/api/auth/login", { body: { email: "nour@example.com", password: STRONG }, ip: "203.0.113.61" })));
    const detail = await body<{ sessions: { familyId: string; ip: string }[] }>(await memberGet(req(`/api/admin/members/${memberId}`, { cookie: adminCookie }), params({ id: memberId })));
    const familyA = detail.sessions.find((row) => row.ip === "203.0.113.60")!.familyId;
    const one = await memberSessions(browserReq(`/api/admin/members/${memberId}/sessions?familyId=${familyA}`, { method: "DELETE", cookie: adminCookie }), params({ id: memberId }));
    expect(await body(one)).toEqual({ revoked: 1 });
    expect((await meRoute(req("/api/auth/me", { headers: { authorization: `Bearer ${a.accessToken}` } }))).status).toBe(401);
    expect((await meRoute(req("/api/auth/me", { headers: { authorization: `Bearer ${b.accessToken}` } }))).status).toBe(200);
    const all = await memberSessions(browserReq(`/api/admin/members/${memberId}/sessions`, { method: "DELETE", cookie: adminCookie }), params({ id: memberId }));
    expect((await body<{ revoked: number }>(all)).revoked).toBeGreaterThanOrEqual(1);
    expect((await meRoute(req("/api/auth/me", { headers: { authorization: `Bearer ${b.accessToken}` } }))).status).toBe(401);
  });

  it("stats, sessions, reset requests and audit read back; mutations without Origin are refused", async () => {
    const stats = await body<{ total: number; active: number; admins: number }>(await statsGet(req("/api/admin/stats", { cookie: adminCookie }), {}));
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.admins).toBe(1);
    expect((await sessionsGet(req("/api/admin/sessions", { cookie: adminCookie }), {})).status).toBe(200);
    expect((await resetRequestsGet(req("/api/admin/reset-requests", { cookie: adminCookie }), {})).status).toBe(200);
    const audit = await body<{ items: { action: string; metadata: Record<string, unknown> }[] }>(await auditGet(req("/api/admin/audit?action=member.", { cookie: adminCookie }), {}));
    expect(audit.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain(STRONG);

    const noOrigin = await memberPatch(req(`/api/admin/members/${memberId}`, { method: "PATCH", body: { displayName: "x" }, cookie: adminCookie, headers: { "sec-fetch-site": "cross-site" } }), params({ id: memberId }));
    expect(noOrigin.status).toBe(403);
  });

  it("deletes a member (not an admin, not yourself) after which login fails generically", async () => {
    const self = await memberDelete(browserReq(`/api/admin/members/${adminId}`, { method: "DELETE", cookie: adminCookie }), params({ id: adminId }));
    expect(self.status).toBe(400);
    const gone = await memberDelete(browserReq(`/api/admin/members/${memberId}`, { method: "DELETE", cookie: adminCookie }), params({ id: memberId }));
    expect(gone.status).toBe(204);
    expect((await login(req("/api/auth/login", { body: { email: "nour@example.com", password: STRONG } }))).status).toBe(401);
    expect((await memberGet(req(`/api/admin/members/${memberId}`, { cookie: adminCookie }), params({ id: memberId }))).status).toBe(404);
  });

  it("admin account: info, password change with current password, and revoking other browser sessions", async () => {
    const info = await body<{ recoveryCodesLeft: number; mailConfigured: boolean; sessions: { current: boolean }[] }>(await accountGet(req("/api/admin/account", { cookie: adminCookie }), {}));
    expect(info.recoveryCodesLeft).toBe(10);
    expect(info.mailConfigured).toBe(true);
    expect(info.sessions.some((row) => row.current)).toBe(true);

    const wrong = await accountPatch(browserReq("/api/admin/account", { method: "PATCH", body: { currentPassword: "nope-nope-nope", newPassword: "another strong passphrase 7" }, cookie: adminCookie }), {});
    expect(wrong.status).toBe(401);
    const weak = await accountPatch(browserReq("/api/admin/account", { method: "PATCH", body: { currentPassword: STRONG, newPassword: "short" }, cookie: adminCookie }), {});
    expect(weak.status).toBe(400);
    const others = await accountDelete(browserReq("/api/admin/account", { method: "DELETE", cookie: adminCookie }), {});
    expect(others.status).toBe(200);
    // Still signed in on this session.
    expect((await statsGet(req("/api/admin/stats", { cookie: adminCookie }), {})).status).toBe(200);
  });
});

describe("email invitations (owner decision: automatic email, no manual fallback)", () => {
  it("refuses to create or re-invite members when SMTP is not configured, without creating anything", async () => {
    const saved = env();
    setEnvForTests({ ...saved, SMTP_HOST: undefined, SMTP_FROM: undefined });
    try {
      const sentBefore = outbox.length;
      const res = await membersPost(browserReq("/api/admin/members", { body: { email: "nosmtp@example.com", displayName: "No SMTP" }, cookie: adminCookie }), {});
      expect(res.status).toBe(503);
      expect(await body(res)).toMatchObject({ error: "email_not_configured" });
      expect(await getDb().select().from(users).where(eq(users.email, "nosmtp@example.com"))).toHaveLength(0);
      expect(outbox.length).toBe(sentBefore);
      const account = await body<{ mailConfigured: boolean }>(await accountGet(req("/api/admin/account", { cookie: adminCookie }), {}));
      expect(account.mailConfigured).toBe(false);
    } finally {
      setEnvForTests(saved);
    }
  });

  it("records an SMTP failure on the invitation, shows it to the admin, never returns the link, and a resend works", async () => {
    setMailSenderForTests(async () => {
      throw Object.assign(new Error("Invalid login: 535 5.7.8 Authentication failed"), { code: "EAUTH", responseCode: 535 });
    });
    let memberId = "";
    try {
      const res = await membersPost(browserReq("/api/admin/members", { body: { email: "bounce@example.com", displayName: "Bounce" }, cookie: adminCookie }), {});
      expect(res.status).toBe(201);
      const created = await body<{ member: { id: string }; link: { url?: string; emailStatus: string; emailError: string } }>(res);
      memberId = created.member.id;
      expect(created.link.url).toBeUndefined();
      expect(created.link.emailStatus).toBe("failed");
      expect(created.link.emailError).toMatch(/EAUTH · SMTP 535/);

      const detail = await body<{ pendingLinks: { kind: string; delivery: string; emailStatus: string; emailError: string | null }[]; audit: { action: string; success: boolean }[] }>(
        await memberGet(req(`/api/admin/members/${memberId}`, { cookie: adminCookie }), params({ id: memberId })),
      );
      expect(detail.pendingLinks[0]).toMatchObject({ kind: "invite", delivery: "email", emailStatus: "failed" });
      expect(detail.audit.find((event) => event.action === "link.issued.invite")?.success).toBe(false);
      const list = await body<{ items: { id: string; invitation: { emailStatus: string } | null }[] }>(await membersGet(req("/api/admin/members?q=bounce", { cookie: adminCookie }), {}));
      expect(list.items[0].invitation).toMatchObject({ emailStatus: "failed" });
    } finally {
      setMailSenderForTests(async (message) => {
        outbox.push(message);
      });
    }

    const resend = await memberLinks(browserReq(`/api/admin/members/${memberId}/links`, { body: { kind: "invite" }, cookie: adminCookie }), params({ id: memberId }));
    expect(resend.status).toBe(201);
    expect(await body(resend)).toMatchObject({ kind: "invite", delivery: "email", emailStatus: "sent" });
    const { token } = lastMailedLink("bounce@example.com");
    expect((await linkPost(req(`/api/auth/links/${token}`, { body: { password: STRONG } }), params({ token }))).status).toBe(200);
    expect((await getDb().select().from(users).where(eq(users.id, memberId)))[0].status).toBe("active");
  });
});

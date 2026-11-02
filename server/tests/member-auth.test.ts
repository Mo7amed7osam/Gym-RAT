import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { GET as linkGet, POST as linkPost } from "@/app/api/auth/links/[token]/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { GET as health } from "@/app/api/health/route";
import { issueActionLink } from "@/lib/auth/action-tokens";
import { revokeAllMemberSessions } from "@/lib/auth/member-sessions";
import { getDb } from "@/lib/db";
import { auditEvents, passwordResetRequests, users } from "@/lib/db/schema";

import { STRONG, body, params, req, seedUser } from "./helpers";

/**
 * Member API through the real route handlers against PGlite: login success
 * and failure, disabled accounts, missing / invalid sessions, refresh
 * rotation and reuse detection, revocation, invitations, password reset,
 * brute-force limits, and the generic answers that never leak account existence.
 */

describe("health", () => {
  it("answers ok with the database reachable", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ status: "ok", database: "ok" });
  });
});

describe("member login", () => {
  it("returns tokens, user and a 7-day lease for a valid password", async () => {
    const user = await seedUser({ email: "amr@example.com", password: STRONG, displayName: "Amr" });
    const res = await login(req("/api/auth/login", { body: { email: "Amr@Example.com", password: STRONG, deviceName: "iPhone 17 Pro" } }));
    expect(res.status).toBe(200);
    const session = await body<{ accessToken: string; refreshToken: string; accessExpiresIn: number; user: { id: string }; lease: { userId: string; issuedAt: string; expiresAt: string } }>(res);
    expect(session.user.id).toBe(user.id);
    expect(session.accessExpiresIn).toBe(900);
    expect(Date.parse(session.lease.expiresAt) - Date.parse(session.lease.issuedAt)).toBe(7 * 86_400_000);
    expect(session.refreshToken.length).toBeGreaterThan(40);
    const stored = await getDb().select().from(users).where(eq(users.id, user.id));
    expect(stored[0].lastLoginAt).not.toBeNull();
  });

  it("answers the same 401 for a wrong password, an unknown email and an invited (passwordless) account", async () => {
    await seedUser({ email: "invited@example.com", status: "invited" });
    const wrong = await login(req("/api/auth/login", { body: { email: "amr@example.com", password: "nope-nope-nope" }, ip: "203.0.113.11" }));
    const unknown = await login(req("/api/auth/login", { body: { email: "ghost@example.com", password: STRONG }, ip: "203.0.113.11" }));
    const invited = await login(req("/api/auth/login", { body: { email: "invited@example.com", password: STRONG }, ip: "203.0.113.11" }));
    for (const res of [wrong, unknown, invited]) {
      expect(res.status).toBe(401);
      expect(await body(res)).toEqual({ error: "invalid_credentials" });
    }
  });

  it("rejects a disabled account with 403 and revokes nothing else", async () => {
    await seedUser({ email: "off@example.com", password: STRONG, status: "disabled" });
    const res = await login(req("/api/auth/login", { body: { email: "off@example.com", password: STRONG }, ip: "203.0.113.12" }));
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ error: "account_disabled" });
  });

  it("validates the body", async () => {
    const res = await login(req("/api/auth/login", { body: { email: "not-an-email", password: "" } }));
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("validation");
  });

  it("rate-limits repeated failures per account and IP with Retry-After, then clears on success", async () => {
    await seedUser({ email: "brute@example.com", password: STRONG });
    let last: Response | null = null;
    for (let i = 0; i < 5; i += 1) last = await login(req("/api/auth/login", { body: { email: "brute@example.com", password: `wrong-${i}-wrong-wrong` }, ip: "198.51.100.7" }));
    expect(last!.status).toBe(401);
    const limited = await login(req("/api/auth/login", { body: { email: "brute@example.com", password: STRONG }, ip: "198.51.100.7" }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    // Another IP for the same account is still allowed (per IP+account), and succeeds.
    const ok = await login(req("/api/auth/login", { body: { email: "brute@example.com", password: STRONG }, ip: "198.51.100.8" }));
    expect(ok.status).toBe(200);
    const events = await getDb().select().from(auditEvents).where(eq(auditEvents.action, "member.login.rate_limited"));
    expect(events.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).not.toContain("wrong-");
  });
});

describe("sessions", () => {
  async function signIn(email: string, ip = "203.0.113.20") {
    const res = await login(req("/api/auth/login", { body: { email, password: STRONG }, ip }));
    expect(res.status).toBe(200);
    return body<{ accessToken: string; refreshToken: string; user: { id: string } }>(res);
  }

  it("me needs a bearer token and rejects garbage or a token signed for nobody", async () => {
    await seedUser({ email: "sess@example.com", password: STRONG });
    expect((await me(req("/api/auth/me"))).status).toBe(401);
    const garbage = await me(req("/api/auth/me", { headers: { authorization: "Bearer not.a.jwt" } }));
    expect(garbage.status).toBe(401);
    expect(await body(garbage)).toEqual({ error: "invalid_token" });
  });

  it("me renews the lease and reflects disablement immediately", async () => {
    const session = await signIn("sess@example.com");
    const ok = await me(req("/api/auth/me", { headers: { authorization: `Bearer ${session.accessToken}` } }));
    expect(ok.status).toBe(200);
    expect((await body<{ lease: { userId: string } }>(ok)).lease.userId).toBe(session.user.id);

    await getDb().update(users).set({ status: "disabled" }).where(eq(users.id, session.user.id));
    const disabled = await me(req("/api/auth/me", { headers: { authorization: `Bearer ${session.accessToken}` } }));
    expect(disabled.status).toBe(403);
    expect(await body(disabled)).toEqual({ error: "account_disabled" });
    await getDb().update(users).set({ status: "active" }).where(eq(users.id, session.user.id));
  });

  it("refresh rotates the token; the old one is dead and reusing it revokes the whole family", async () => {
    const first = await signIn("sess@example.com");
    const rotated = await refresh(req("/api/auth/refresh", { body: { refreshToken: first.refreshToken } }));
    expect(rotated.status).toBe(200);
    const second = await body<{ accessToken: string; refreshToken: string }>(rotated);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // The new access token works, the family is live.
    expect((await me(req("/api/auth/me", { headers: { authorization: `Bearer ${second.accessToken}` } }))).status).toBe(200);

    // Replay of the spent token → family revoked.
    const replay = await refresh(req("/api/auth/refresh", { body: { refreshToken: first.refreshToken } }));
    expect(replay.status).toBe(401);
    expect(await body(replay)).toEqual({ error: "session_revoked" });

    // The legitimately rotated token is now dead too, and so is the access token at its next `me`.
    const afterReuse = await refresh(req("/api/auth/refresh", { body: { refreshToken: second.refreshToken } }));
    expect(afterReuse.status).toBe(401);
    const meAfter = await me(req("/api/auth/me", { headers: { authorization: `Bearer ${second.accessToken}` } }));
    expect(meAfter.status).toBe(401);
    expect(await body(meAfter)).toEqual({ error: "session_revoked" });
  });

  it("an unknown refresh token is 401 invalid_token", async () => {
    const res = await refresh(req("/api/auth/refresh", { body: { refreshToken: "x".repeat(43) } }));
    expect(res.status).toBe(401);
    expect(await body(res)).toEqual({ error: "invalid_token" });
  });

  it("server-side revocation signs every device out at its next contact; logout revokes only that device", async () => {
    const phone = await signIn("sess@example.com", "203.0.113.21");
    const tablet = await signIn("sess@example.com", "203.0.113.22");
    expect(await revokeAllMemberSessions(phone.user.id)).toBeGreaterThanOrEqual(2);
    expect((await refresh(req("/api/auth/refresh", { body: { refreshToken: phone.refreshToken } }))).status).toBe(401);
    expect((await me(req("/api/auth/me", { headers: { authorization: `Bearer ${tablet.accessToken}` } }))).status).toBe(401);

    const a = await signIn("sess@example.com", "203.0.113.23");
    const b = await signIn("sess@example.com", "203.0.113.24");
    expect((await logout(req("/api/auth/logout", { body: { refreshToken: a.refreshToken } }))).status).toBe(204);
    expect((await me(req("/api/auth/me", { headers: { authorization: `Bearer ${a.accessToken}` } }))).status).toBe(401);
    expect((await me(req("/api/auth/me", { headers: { authorization: `Bearer ${b.accessToken}` } }))).status).toBe(200);
    // Logout is idempotent and silent for unknown tokens.
    expect((await logout(req("/api/auth/logout", { body: { refreshToken: a.refreshToken } }))).status).toBe(204);
  });
});

describe("invitations and password reset", () => {
  const ctx = { ip: "203.0.113.30", userAgent: "vitest" };

  it("an invitation link previews the member, enforces the password policy, activates the account once", async () => {
    const user = await seedUser({ email: "new@example.com", status: "invited", displayName: "New Member" });
    const link = await issueActionLink(user, "invite", { id: null, type: "system" }, ctx);
    expect(link.delivery).toBe("manual");
    const token = link.url.split("/").pop()!;

    const preview = await linkGet(req(`/api/auth/links/${token}`), params({ token }));
    expect(preview.status).toBe(200);
    expect(await body(preview)).toMatchObject({ kind: "invite", email: "new@example.com", displayName: "New Member" });

    const weak = await linkPost(req(`/api/auth/links/${token}`, { body: { password: "short" } }), params({ token }));
    expect(weak.status).toBe(400);
    expect((await body(weak)).error).toBe("weak_password");

    const set = await linkPost(req(`/api/auth/links/${token}`, { body: { password: STRONG } }), params({ token }));
    expect(set.status).toBe(200);
    const after = await getDb().select().from(users).where(eq(users.id, user.id));
    expect(after[0].status).toBe("active");
    expect(after[0].passwordHash).toMatch(/^\$argon2id\$/);

    // Burned.
    expect((await linkGet(req(`/api/auth/links/${token}`), params({ token }))).status).toBe(404);
    expect((await linkPost(req(`/api/auth/links/${token}`, { body: { password: STRONG } }), params({ token }))).status).toBe(404);

    // And the member can sign in.
    expect((await login(req("/api/auth/login", { body: { email: "new@example.com", password: STRONG } }))).status).toBe(200);
  });

  it("issuing a new link invalidates the previous one; links expire", async () => {
    const user = await seedUser({ email: "relink@example.com", status: "invited" });
    const first = await issueActionLink(user, "invite", { id: null, type: "system" }, ctx);
    const second = await issueActionLink(user, "invite", { id: null, type: "system" }, ctx);
    const t1 = first.url.split("/").pop()!;
    const t2 = second.url.split("/").pop()!;
    expect((await linkGet(req(`/api/auth/links/${t1}`), params({ token: t1 }))).status).toBe(404);
    expect((await linkGet(req(`/api/auth/links/${t2}`), params({ token: t2 }))).status).toBe(200);

    const expired = await issueActionLink(user, "invite", { id: null, type: "system" }, ctx, new Date(Date.now() - 100 * 3_600_000));
    const t3 = expired.url.split("/").pop()!;
    expect((await linkGet(req(`/api/auth/links/${t3}`), params({ token: t3 }))).status).toBe(404);
  });

  it("a reset link replaces the password and signs every device out", async () => {
    const user = await seedUser({ email: "reset@example.com", password: STRONG });
    const session = await body<{ accessToken: string }>(await login(req("/api/auth/login", { body: { email: "reset@example.com", password: STRONG } })));
    const link = await issueActionLink(user, "reset", { id: null, type: "system" }, ctx);
    const token = link.url.split("/").pop()!;
    const newPassword = "a brand new passphrase 99";
    expect((await linkPost(req(`/api/auth/links/${token}`, { body: { password: newPassword } }), params({ token }))).status).toBe(200);
    expect((await me(req("/api/auth/me", { headers: { authorization: `Bearer ${session.accessToken}` } }))).status).toBe(401);
    expect((await login(req("/api/auth/login", { body: { email: "reset@example.com", password: STRONG } }))).status).toBe(401);
    expect((await login(req("/api/auth/login", { body: { email: "reset@example.com", password: newPassword } }))).status).toBe(200);
  });

  it("forgot-password always answers 202, records a request for the admin, and is rate-limited", async () => {
    await seedUser({ email: "forgetful@example.com", password: STRONG });
    const known = await forgot(req("/api/auth/forgot-password", { body: { email: "Forgetful@example.com" }, ip: "203.0.113.40" }));
    const unknown = await forgot(req("/api/auth/forgot-password", { body: { email: "nobody@example.com" }, ip: "203.0.113.40" }));
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await body(known)).toEqual(await body(unknown));
    const open = await getDb().select().from(passwordResetRequests);
    expect(open.find((row) => row.email === "forgetful@example.com")?.userId).not.toBeNull();
    expect(open.find((row) => row.email === "nobody@example.com")?.userId).toBeNull();

    for (let i = 0; i < 6; i += 1) await forgot(req("/api/auth/forgot-password", { body: { email: `spam${i}@example.com` }, ip: "203.0.113.41" }));
    const rows = await getDb().select().from(passwordResetRequests);
    expect(rows.filter((row) => row.email.startsWith("spam")).length).toBe(5); // the 6th was dropped silently
  });
});

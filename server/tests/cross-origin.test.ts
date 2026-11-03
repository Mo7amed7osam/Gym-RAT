import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { DELETE as sessionDelete, GET as sessionGet, POST as sessionPost } from "@/app/api/admin/session/route";
import { POST as sessionMfa } from "@/app/api/admin/session/mfa/route";
import { POST as mfaEnrolBegin, PUT as mfaEnrolConfirm } from "@/app/api/admin/mfa/enrol/route";
import { GET as statsGet } from "@/app/api/admin/stats/route";
import { PATCH as memberPatch } from "@/app/api/admin/members/[id]/route";
import { corsHeaders } from "@/lib/cors";
import { loadEnv } from "@/lib/env";
import { proxy, config as proxyConfig } from "@/proxy";

import { API_ORIGIN, DASHBOARD_ORIGIN, STRONG, body, browserReq, cookieFrom, currentTotp, params, req, seedUser } from "./helpers";

/**
 * The dashboard is a separate app on ADMIN_ORIGIN calling this API
 * cross-origin (ADR-018). Exact-origin CORS, the CSRF origin check, and the
 * host-only SameSite=Strict cookie are what keep that safe.
 */

/** Origins that must never get CORS access or pass the CSRF check. */
const HOSTILE = [
  "https://evil.example",
  API_ORIGIN, // the API itself: the old same-origin dashboard is gone
  "http://admin.gymrat.test", // scheme downgrade
  "https://admin.gymrat.test:8443", // other port
  "https://ADMIN.gymrat.test", // not byte-identical
  "https://admin.gymrat.test/", // trailing slash
  "https://admin.gymrat.test.evil.example", // suffix trick
  "https://evil-admin.gymrat.test",
  "https://gym-rat-admin-git-feature-owner.vercel.app", // a Vercel preview
  "null",
  "*",
];

const apiRequest = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) => new NextRequest(`${API_ORIGIN}${path}`, { method: init.method ?? "GET", headers: init.headers });

describe("CORS (proxy on /api/admin/*)", () => {
  it("runs only on the admin API, not on the member API, link pages or health", () => {
    expect(proxyConfig.matcher).toEqual(["/api/admin/:path*"]);
  });

  it("answers a preflight from the dashboard with exactly that origin and credentials", async () => {
    const res = proxy(apiRequest("/api/admin/members", { method: "OPTIONS", headers: { origin: DASHBOARD_ORIGIN, "access-control-request-method": "POST", "access-control-request-headers": "content-type" } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(DASHBOARD_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST, PUT, PATCH, DELETE");
    expect(res.headers.get("access-control-allow-headers")).toBe("Accept, Content-Type");
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it.each(HOSTILE)("refuses a preflight from %s without any CORS header", async (origin) => {
    const res = proxy(apiRequest("/api/admin/members", { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" } }));
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("refuses a preflight without Origin, for an unknown method, or for extra request headers", () => {
    const base = { "access-control-request-method": "POST" };
    expect(proxy(apiRequest("/api/admin/members", { method: "OPTIONS", headers: base })).status).toBe(403);
    expect(proxy(apiRequest("/api/admin/members", { method: "OPTIONS", headers: { origin: DASHBOARD_ORIGIN, "access-control-request-method": "TRACE" } })).status).toBe(403);
    expect(proxy(apiRequest("/api/admin/members", { method: "OPTIONS", headers: { origin: DASHBOARD_ORIGIN, ...base, "access-control-request-headers": "content-type, authorization" } })).status).toBe(403);
  });

  it("adds the CORS headers to real responses only for the dashboard origin, never a wildcard or a reflection", () => {
    const ok = proxy(apiRequest("/api/admin/stats", { headers: { origin: DASHBOARD_ORIGIN } }));
    expect(ok.headers.get("access-control-allow-origin")).toBe(DASHBOARD_ORIGIN);
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
    expect(ok.headers.get("access-control-expose-headers")).toBe("Retry-After");
    for (const origin of HOSTILE) {
      const res = proxy(apiRequest("/api/admin/stats", { headers: { origin } }));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("vary")).toContain("Origin");
    }
    expect(proxy(apiRequest("/api/admin/stats")).headers.get("access-control-allow-origin")).toBeNull();
  });

  it("compares byte for byte (no normalisation of the request's Origin)", () => {
    expect(corsHeaders(DASHBOARD_ORIGIN, DASHBOARD_ORIGIN)).not.toBeNull();
    for (const origin of HOSTILE) expect(corsHeaders(origin, DASHBOARD_ORIGIN)).toBeNull();
    expect(corsHeaders(null, DASHBOARD_ORIGIN)).toBeNull();
  });
});

describe("cross-origin admin session", () => {
  let cookie = "";
  let adminId = "";

  it("sets a host-only, HttpOnly, Secure, SameSite=Strict cookie with no Domain attribute", async () => {
    adminId = (await seedUser({ email: "cors-owner@example.com", password: STRONG, role: "admin" })).id;
    const res = await sessionPost(browserReq("/api/admin/session", { body: { email: "cors-owner@example.com", password: STRONG }, ip: "198.51.100.7" }));
    expect(res.status).toBe(200);
    const header = res.headers.get("set-cookie")!;
    expect(header).toMatch(/^gymrat_admin=[^;]+; Path=\/; Expires=[^;]+; SameSite=Strict; HttpOnly; Secure$/);
    expect(header).not.toMatch(/domain=/i);
    cookie = cookieFrom(res);
  });

  it.each(HOSTILE)("refuses the password step from Origin %s (CSRF)", async (origin) => {
    const res = await sessionPost(req("/api/admin/session", { body: { email: "cors-owner@example.com", password: STRONG }, headers: { origin, "sec-fetch-site": "same-origin" }, ip: "198.51.100.8" }));
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ error: "csrf" });
  });

  it("refuses a state change without Origin, even with same-origin Fetch Metadata or a dashboard Referer", async () => {
    const noOrigin = await sessionPost(req("/api/admin/session", { body: { email: "cors-owner@example.com", password: STRONG }, headers: { "sec-fetch-site": "same-origin", referer: `${DASHBOARD_ORIGIN}/login` }, ip: "198.51.100.9" }));
    expect(noOrigin.status).toBe(403);
    expect((await mfaEnrolBegin(req("/api/admin/mfa/enrol", { method: "POST", cookie }))).status).toBe(403);
  });

  it("completes TOTP from the dashboard origin; the API origin itself can no longer drive it", async () => {
    expect((await mfaEnrolBegin(req("/api/admin/mfa/enrol", { method: "POST", cookie, headers: { origin: API_ORIGIN } }))).status).toBe(403);
    expect((await mfaEnrolBegin(browserReq("/api/admin/mfa/enrol", { method: "POST", cookie }))).status).toBe(200);
    const code = await currentTotp(adminId);
    expect((await mfaEnrolConfirm(req("/api/admin/mfa/enrol", { method: "PUT", body: { code }, cookie, headers: { origin: "https://evil.example" } }))).status).toBe(403);
    const confirm = await mfaEnrolConfirm(browserReq("/api/admin/mfa/enrol", { method: "PUT", body: { code }, cookie }));
    expect(confirm.status).toBe(200);
    expect((await statsGet(browserReq("/api/admin/stats", { cookie }), {})).status).toBe(200);
  });

  it("refuses mutations from any other origin with a valid, MFA-verified cookie", async () => {
    const member = await seedUser({ email: "cors-member@example.com", password: STRONG });
    for (const origin of HOSTILE) {
      const res = await memberPatch(req(`/api/admin/members/${member.id}`, { method: "PATCH", body: { displayName: "Hijacked" }, cookie, headers: { origin } }), params({ id: member.id }));
      expect(res.status).toBe(403);
    }
    const ok = await memberPatch(browserReq(`/api/admin/members/${member.id}`, { method: "PATCH", body: { displayName: "Renamed" }, cookie }), params({ id: member.id }));
    expect(ok.status).toBe(200);
  });

  it("MFA step refuses another origin", async () => {
    const res = await sessionMfa(req("/api/admin/session/mfa", { body: { code: "000000" }, cookie, headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
  });

  it("logout from another origin is refused; from the dashboard it revokes the session server-side and clears the cookie", async () => {
    expect((await sessionDelete(req("/api/admin/session", { method: "DELETE", cookie, headers: { origin: "https://evil.example" } }))).status).toBe(403);
    expect((await sessionGet(req("/api/admin/session", { cookie }))).status).toBe(200);
    const out = await sessionDelete(browserReq("/api/admin/session", { method: "DELETE", cookie }));
    expect(out.status).toBe(204);
    expect(out.headers.get("set-cookie")).toMatch(/^gymrat_admin=; Path=\/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; HttpOnly; Secure$/);
    // The old cookie value is dead on the server even if a browser kept it.
    expect((await sessionGet(req("/api/admin/session", { cookie }))).status).toBe(401);
    expect((await statsGet(browserReq("/api/admin/stats", { cookie }), {})).status).toBe(401);
  });
});

describe("ADMIN_ORIGIN configuration", () => {
  const base = { NODE_ENV: "production", DATABASE_URL: "postgres://x", AUTH_SECRET: "x".repeat(40), PUBLIC_ORIGIN: "https://api.example.org" } as const;

  it("is required", () => {
    expect(() => loadEnv({ ...base })).toThrow(/ADMIN_ORIGIN/);
  });

  it.each(["https://admin.example.org/", "https://admin.example.org/login", "https://admin.example.org?x=1", "not a url"])("rejects %s (origin only)", (value) => {
    expect(() => loadEnv({ ...base, ADMIN_ORIGIN: value })).toThrow(/ADMIN_ORIGIN/);
  });

  it("requires https in production except for local test hosts", () => {
    expect(() => loadEnv({ ...base, ADMIN_ORIGIN: "http://admin.example.org" })).toThrow(/https/);
    expect(loadEnv({ ...base, ADMIN_ORIGIN: "https://admin.example.org" }).ADMIN_ORIGIN).toBe("https://admin.example.org");
    expect(loadEnv({ ...base, ADMIN_ORIGIN: "http://admin.gymrat.localhost:3200" }).ADMIN_ORIGIN).toBe("http://admin.gymrat.localhost:3200");
  });
});

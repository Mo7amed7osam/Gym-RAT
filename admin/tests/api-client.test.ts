import { afterEach, describe, expect, it, vi } from "vitest";

import { parseApiOrigin } from "@/lib/api-origin";

describe("NEXT_PUBLIC_API_ORIGIN", () => {
  it("accepts an https origin and local test origins", () => {
    expect(parseApiOrigin("https://api.example.org")).toBe("https://api.example.org");
    expect(parseApiOrigin("http://api.gymrat.localhost:3100")).toBe("http://api.gymrat.localhost:3100");
    expect(parseApiOrigin(undefined)).toBeNull();
    expect(parseApiOrigin("  ")).toBeNull();
  });

  it.each(["http://api.example.org", "https://api.example.org/", "https://api.example.org/api", "api.example.org", "not a url"])("rejects %s", (value) => {
    expect(() => parseApiOrigin(value)).toThrow(/NEXT_PUBLIC_API_ORIGIN/);
  });
});

describe("api() client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("calls the API origin directly with credentials included and no secrets of its own", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://api.example.org");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("@/lib/client/api");
    await api("/api/admin/members", { body: { email: "a@example.org" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.org/api/admin/members");
    expect(init).toMatchObject({ method: "POST", mode: "cors", credentials: "include", cache: "no-store" });
    expect(Object.keys(init.headers as Record<string, string>).map((name) => name.toLowerCase()).sort()).toEqual(["accept", "content-type"]);
  });

  it("refuses to call anything when the build has no API origin (Preview)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { api, describeError } = await import("@/lib/client/api");
    const error = await api("/api/admin/session").catch((cause: unknown) => cause);
    expect(describeError(error)).toMatch(/no API address/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

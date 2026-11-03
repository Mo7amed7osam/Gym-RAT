/**
 * CORS for the admin API (ADR-018). The dashboard is a separate app on its own
 * origin; it calls /api/admin/* directly with the admin cookie. Exactly one
 * origin, ADMIN_ORIGIN, is allowed: the comparison is byte-for-byte, nothing
 * is ever reflected from the request, and there is no wildcard. CORS only
 * decides who may read responses; the CSRF origin check in every handler and
 * the SameSite=Strict cookie are what stop forged requests.
 */

export const CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const CORS_REQUEST_HEADERS = ["accept", "content-type"];

/** Response headers for a request from `origin`, or null when that origin is not the dashboard. */
export function corsHeaders(origin: string | null, adminOrigin: string): Record<string, string> | null {
  if (origin === null || origin !== adminOrigin) return null;
  return {
    "Access-Control-Allow-Origin": adminOrigin,
    "Access-Control-Allow-Credentials": "true",
    // The dashboard reads Retry-After to show how long a rate limit lasts.
    "Access-Control-Expose-Headers": "Retry-After",
  };
}

/** Answer to an OPTIONS preflight: 204 with the allowed methods and headers, or 403 without any CORS header. */
export function preflight(request: Request, adminOrigin: string): Response {
  const allowed = corsHeaders(request.headers.get("origin"), adminOrigin);
  const method = (request.headers.get("access-control-request-method") ?? "").toUpperCase();
  const headers = (request.headers.get("access-control-request-headers") ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const ok = allowed !== null && (CORS_METHODS as readonly string[]).includes(method) && headers.every((name) => CORS_REQUEST_HEADERS.includes(name));
  if (!ok) return new Response(null, { status: 403, headers: { Vary: "Origin", "Cache-Control": "no-store" } });
  return new Response(null, {
    status: 204,
    headers: {
      ...allowed,
      "Access-Control-Allow-Methods": CORS_METHODS.join(", "),
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
      "Cache-Control": "no-store",
    },
  });
}

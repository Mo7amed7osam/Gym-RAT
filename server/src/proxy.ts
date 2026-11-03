import { NextResponse, type NextRequest } from "next/server";

import { corsHeaders, preflight } from "@/lib/cors";
import { env } from "@/lib/env";

/**
 * Cross-origin access for the admin dashboard (ADR-018): answers preflights
 * and adds the CORS headers for ADMIN_ORIGIN to every /api/admin/* response.
 * Authentication, MFA and the CSRF origin check stay in the route handlers.
 */
export function proxy(request: NextRequest) {
  const adminOrigin = env().ADMIN_ORIGIN;
  if (request.method === "OPTIONS") return preflight(request, adminOrigin);
  const response = NextResponse.next();
  response.headers.append("Vary", "Origin");
  for (const [name, value] of Object.entries(corsHeaders(request.headers.get("origin"), adminOrigin) ?? {})) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: ["/api/admin/:path*"],
};

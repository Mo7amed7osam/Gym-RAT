import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE } from "@/lib/auth/admin-sessions";

/**
 * Cheap gate for dashboard pages: no admin cookie → /login. The real check
 * (live session, MFA) happens in every API handler; this only avoids
 * rendering a dashboard shell for anonymous visitors.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!request.cookies.get(ADMIN_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/members/:path*", "/security", "/audit", "/settings"],
};

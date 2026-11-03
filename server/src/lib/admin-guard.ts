import { ADMIN_COOKIE, requireAdmin, type AdminAuth } from "@/lib/auth/admin-sessions";
import { readCookie } from "@/lib/cookies";
import { assertAdminOrigin, errorResponse } from "@/lib/http";

/**
 * Every admin endpoint goes through here: cookie → live session → MFA done →
 * (for anything but GET/HEAD) dashboard-origin check. The handler receives the
 * authenticated admin; nothing runs before the checks pass.
 */
export function withAdmin<Ctx>(fn: (request: Request, auth: AdminAuth, ctx: Ctx) => Promise<Response>): (request: Request, ctx: Ctx) => Promise<Response> {
  return async (request, ctx) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") assertAdminOrigin(request);
      const auth = await requireAdmin(readCookie(request, ADMIN_COOKIE));
      return await fn(request, auth, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

import { z } from "zod";

import { ADMIN_COOKIE, adminCookieOptions, resolveAdminSession, revokeAdminSession, startAdminSession } from "@/lib/auth/admin-sessions";
import { clearCookie, readCookie, serializeCookie } from "@/lib/cookies";
import { assertAdminOrigin, emailSchema, handler, json, parseBody, requestContext } from "@/lib/http";

const schema = z.object({ email: emailSchema, password: z.string().min(1).max(256) });

/** Step 1 of the admin login: password. Sets the session cookie; MFA follows. */
export const POST = handler(async (request: Request) => {
  assertAdminOrigin(request);
  const body = await parseBody(request, schema);
  const { rawToken, auth } = await startAdminSession(body, requestContext(request));
  return json(
    { user: { id: auth.user.id, email: auth.user.email, displayName: auth.user.displayName }, mfaEnrolled: auth.mfaEnrolled, mfaVerified: false },
    { headers: { "Set-Cookie": serializeCookie(ADMIN_COOKIE, rawToken, adminCookieOptions(auth.session.expiresAt)) } },
  );
});

/** Who am I (also used by the layout to decide between login, MFA and dashboard). */
export const GET = handler(async (request: Request) => {
  const auth = await resolveAdminSession(readCookie(request, ADMIN_COOKIE));
  if (!auth) return json({ authenticated: false }, { status: 401 });
  return json({ authenticated: true, user: { id: auth.user.id, email: auth.user.email, displayName: auth.user.displayName }, mfaEnrolled: auth.mfaEnrolled, mfaVerified: auth.mfaVerified });
});

export const DELETE = handler(async (request: Request) => {
  assertAdminOrigin(request);
  const auth = await resolveAdminSession(readCookie(request, ADMIN_COOKIE));
  if (auth) await revokeAdminSession(auth.session.id);
  const options = adminCookieOptions(new Date(0));
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearCookie(ADMIN_COOKIE, options) } });
});


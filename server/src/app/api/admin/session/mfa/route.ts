import { z } from "zod";

import { ADMIN_COOKIE, resolveAdminSession, verifyAdminMfa } from "@/lib/auth/admin-sessions";
import { readCookie } from "@/lib/cookies";
import { HttpError, assertSameOrigin, handler, json, parseBody, requestContext } from "@/lib/http";

const schema = z.object({ code: z.string().min(6).max(20) });

/** Step 2 of the admin login: TOTP or a recovery code. */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const auth = await resolveAdminSession(readCookie(request, ADMIN_COOKIE));
  if (!auth) throw new HttpError(401, "unauthorized");
  const { code } = await parseBody(request, schema);
  await verifyAdminMfa(auth, code, requestContext(request));
  return json({ mfaVerified: true });
});

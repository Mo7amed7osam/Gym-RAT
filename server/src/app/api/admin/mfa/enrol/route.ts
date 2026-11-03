import QRCode from "qrcode";
import { z } from "zod";

import { ADMIN_COOKIE, beginTotpEnrolment, confirmTotpEnrolment, resolveAdminSession } from "@/lib/auth/admin-sessions";
import { readCookie } from "@/lib/cookies";
import { HttpError, assertAdminOrigin, handler, json, parseBody, requestContext } from "@/lib/http";

/**
 * TOTP enrolment for an admin whose session passed the password step but
 * has no authenticator yet. Deliberately *not* behind `withAdmin` (which
 * requires MFA) — but it refuses once an authenticator is confirmed.
 */
async function pendingAdmin(request: Request) {
  const auth = await resolveAdminSession(readCookie(request, ADMIN_COOKIE));
  if (!auth) throw new HttpError(401, "unauthorized");
  if (auth.mfaEnrolled) throw new HttpError(409, "conflict", "Already enrolled");
  return auth;
}

export const POST = handler(async (request: Request) => {
  assertAdminOrigin(request);
  const auth = await pendingAdmin(request);
  const { otpauthUri, secretBase32 } = await beginTotpEnrolment(auth);
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 });
  return json({ otpauthUri, secretBase32, qrDataUrl });
});

const confirmSchema = z.object({ code: z.string().min(6).max(10) });

export const PUT = handler(async (request: Request) => {
  assertAdminOrigin(request);
  const auth = await pendingAdmin(request);
  const { code } = await parseBody(request, confirmSchema);
  return json(await confirmTotpEnrolment(auth, code, requestContext(request)));
});

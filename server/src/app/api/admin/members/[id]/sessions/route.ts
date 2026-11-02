import { z } from "zod";

import { withAdmin } from "@/lib/admin-guard";
import { json, requestContext } from "@/lib/http";
import { revokeMemberSessions } from "@/lib/members";

type Ctx = { params: Promise<{ id: string }> };

/** Revokes every device (default) or one family (`?familyId=`). */
export const DELETE = withAdmin<Ctx>(async (request, auth, { params }) => {
  const id = z.string().uuid().parse((await params).id);
  const familyId = new URL(request.url).searchParams.get("familyId") ?? undefined;
  const revoked = await revokeMemberSessions(id, { id: auth.user.id }, requestContext(request), familyId ? z.string().uuid().parse(familyId) : undefined);
  return json({ revoked });
});

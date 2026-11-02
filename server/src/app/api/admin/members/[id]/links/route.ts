import { z } from "zod";

import { withAdmin } from "@/lib/admin-guard";
import { json, parseBody, requestContext } from "@/lib/http";
import { issueMemberLink } from "@/lib/members";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ kind: z.enum(["invite", "reset"]) });

/** New invitation or password-reset link. Returned once; stored only as a hash. */
export const POST = withAdmin<Ctx>(async (request, auth, { params }) => {
  const id = z.string().uuid().parse((await params).id);
  const { kind } = await parseBody(request, schema);
  return json(await issueMemberLink(id, kind, { id: auth.user.id }, requestContext(request)), { status: 201 });
});

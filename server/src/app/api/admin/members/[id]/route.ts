import { z } from "zod";

import { withAdmin } from "@/lib/admin-guard";
import { json, noContent, parseBody, requestContext } from "@/lib/http";
import { deleteMember, memberDetail, updateMember } from "@/lib/members";

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export const GET = withAdmin<Ctx>(async (_request, _auth, { params }) => json(await memberDetail(idSchema.parse((await params).id))));

const patchSchema = z.object({ displayName: z.string().trim().min(1).max(80).optional(), status: z.enum(["active", "disabled"]).optional() }).refine((value) => value.displayName !== undefined || value.status !== undefined, { message: "Nothing to update" });

export const PATCH = withAdmin<Ctx>(async (request, auth, { params }) => {
  const id = idSchema.parse((await params).id);
  const patch = await parseBody(request, patchSchema);
  return json(await updateMember(id, patch, { id: auth.user.id }, requestContext(request)));
});

export const DELETE = withAdmin<Ctx>(async (request, auth, { params }) => {
  await deleteMember(idSchema.parse((await params).id), { id: auth.user.id }, requestContext(request));
  return noContent();
});

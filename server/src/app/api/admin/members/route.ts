import { z } from "zod";

import { withAdmin } from "@/lib/admin-guard";
import { emailSchema, json, parseBody, requestContext } from "@/lib/http";
import { createMember, listMembers } from "@/lib/members";

export const GET = withAdmin(async (request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  return json(
    await listMembers({
      search: url.searchParams.get("q") ?? undefined,
      status: status === "active" || status === "invited" || status === "disabled" ? status : "all",
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
    }),
  );
});

const createSchema = z.object({ email: emailSchema, displayName: z.string().trim().min(1).max(80) });

export const POST = withAdmin(async (request, auth) => {
  const body = await parseBody(request, createSchema);
  return json(await createMember(body, { id: auth.user.id }, requestContext(request)), { status: 201 });
});

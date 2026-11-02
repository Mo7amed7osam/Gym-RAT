import { z } from "zod";

import { refreshMemberSession } from "@/lib/auth/member-sessions";
import { handler, json, parseBody, requestContext } from "@/lib/http";

const schema = z.object({ refreshToken: z.string().min(16).max(512) });

export const POST = handler(async (request: Request) => {
  const { refreshToken } = await parseBody(request, schema);
  return json(await refreshMemberSession(refreshToken, requestContext(request)));
});

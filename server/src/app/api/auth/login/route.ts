import { z } from "zod";

import { loginMember } from "@/lib/auth/member-sessions";
import { emailSchema, handler, json, parseBody, requestContext } from "@/lib/http";

const schema = z.object({ email: emailSchema, password: z.string().min(1).max(256), deviceName: z.string().max(120).optional().nullable() });

export const POST = handler(async (request: Request) => {
  const body = await parseBody(request, schema);
  const session = await loginMember(body, requestContext(request));
  return json(session);
});

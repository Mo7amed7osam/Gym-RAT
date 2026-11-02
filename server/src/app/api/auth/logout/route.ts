import { z } from "zod";

import { logoutMember } from "@/lib/auth/member-sessions";
import { handler, noContent, parseBody, requestContext } from "@/lib/http";

const schema = z.object({ refreshToken: z.string().min(16).max(512) });

export const POST = handler(async (request: Request) => {
  const { refreshToken } = await parseBody(request, schema);
  await logoutMember(refreshToken, requestContext(request));
  return noContent();
});

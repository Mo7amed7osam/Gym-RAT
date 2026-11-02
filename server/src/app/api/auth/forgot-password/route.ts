import { z } from "zod";

import { requestPasswordReset } from "@/lib/auth/action-tokens";
import { emailSchema, handler, json, parseBody, requestContext } from "@/lib/http";

const schema = z.object({ email: emailSchema });

/** Always 202: the answer never says whether the email belongs to an account. */
export const POST = handler(async (request: Request) => {
  const { email } = await parseBody(request, schema);
  await requestPasswordReset(email, requestContext(request));
  return json({ accepted: true }, { status: 202 });
});

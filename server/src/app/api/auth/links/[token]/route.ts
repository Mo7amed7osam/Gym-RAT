import { z } from "zod";

import { previewActionToken, redeemActionToken } from "@/lib/auth/action-tokens";
import { handler, json, parseBody, requestContext } from "@/lib/http";

type Ctx = { params: Promise<{ token: string }> };

/** Who the invitation / reset belongs to (so the page can greet the member). 404 for anything not live. */
export const GET = handler(async (request: Request, { params }: Ctx) => {
  const { token } = await params;
  return json(await previewActionToken(token, requestContext(request)));
});

const schema = z.object({ password: z.string().min(1).max(256) });

/** Sets the password and burns the link. */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const { token } = await params;
  const { password } = await parseBody(request, schema);
  return json(await redeemActionToken(token, password, requestContext(request)));
});

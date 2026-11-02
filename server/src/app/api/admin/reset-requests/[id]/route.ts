import { z } from "zod";

import { withAdmin } from "@/lib/admin-guard";
import { noContent } from "@/lib/http";
import { dismissResetRequest } from "@/lib/members";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withAdmin<Ctx>(async (_request, auth, { params }) => {
  await dismissResetRequest(z.string().uuid().parse((await params).id), { id: auth.user.id });
  return noContent();
});

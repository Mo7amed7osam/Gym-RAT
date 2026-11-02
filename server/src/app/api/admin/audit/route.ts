import { withAdmin } from "@/lib/admin-guard";
import { json } from "@/lib/http";
import { listAudit } from "@/lib/members";

export const GET = withAdmin(async (request) => {
  const url = new URL(request.url);
  return json(
    await listAudit({
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 50),
      action: url.searchParams.get("action") ?? undefined,
      targetUserId: url.searchParams.get("user") ?? undefined,
    }),
  );
});

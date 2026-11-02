import { withAdmin } from "@/lib/admin-guard";
import { json } from "@/lib/http";
import { listActiveSessions } from "@/lib/members";

export const GET = withAdmin(async () => json({ items: await listActiveSessions() }));

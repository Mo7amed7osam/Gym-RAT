import { withAdmin } from "@/lib/admin-guard";
import { json } from "@/lib/http";
import { stats } from "@/lib/members";

export const GET = withAdmin(async () => json(await stats()));

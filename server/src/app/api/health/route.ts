import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { json } from "@/lib/http";

/** Liveness + database reachability for Docker, Caddy and uptime monitors. Never reveals configuration. */
export async function GET(): Promise<Response> {
  try {
    await getDb().execute(sql`select 1`);
    return json({ status: "ok", database: "ok", time: new Date().toISOString() });
  } catch {
    return json({ status: "degraded", database: "unreachable", time: new Date().toISOString() }, { status: 503 });
  }
}

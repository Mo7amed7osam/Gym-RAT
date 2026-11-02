import { getDb } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export interface AuditInput extends RequestContext {
  actorType: "admin" | "member" | "system" | "anonymous";
  actorId?: string | null;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
  success?: boolean;
}

/**
 * Structured security log in Postgres (ADR-015). Callers must never pass
 * tokens, passwords or TOTP codes in `metadata`; emails are fine (the admin
 * needs them). Also mirrored to stdout as one JSON line for log shipping.
 */
export async function audit(input: AuditInput): Promise<void> {
  const row = {
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    ip: input.ip,
    userAgent: input.userAgent?.slice(0, 300) ?? null,
    metadata: input.metadata ?? {},
    success: input.success ?? true,
  };
  try {
    await getDb().insert(auditEvents).values(row);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "audit insert failed", error: String(error) }));
  }
  if (process.env.NODE_ENV !== "test") console.log(JSON.stringify({ level: "info", type: "audit", at: new Date().toISOString(), ...row }));
}

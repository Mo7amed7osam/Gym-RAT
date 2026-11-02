import { eq } from "drizzle-orm";
import { TOTP, Secret } from "otpauth";

import { decryptSecret } from "@/lib/auth/crypto";
import { hashPassword } from "@/lib/auth/password";
import { getDb } from "@/lib/db";
import { adminTotp, users } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const ORIGIN = "https://admin.gymrat.test";

export function req(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; cookie?: string | null; ip?: string } = {}): Request {
  const headers: Record<string, string> = { "x-forwarded-for": init.ip ?? "203.0.113.10", "user-agent": "vitest", ...(init.headers ?? {}) };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.cookie) headers.cookie = init.cookie;
  return new Request(`${ORIGIN}${path}`, { method: init.method ?? (init.body !== undefined ? "POST" : "GET"), headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

/** Like `req` but with the headers a browser sends for a same-origin fetch. */
export const browserReq = (path: string, init: Parameters<typeof req>[1] = {}) => req(path, { ...init, headers: { origin: ORIGIN, "sec-fetch-site": "same-origin", ...(init.headers ?? {}) } });

export const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

export async function body<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("no Set-Cookie");
  return header.split(";")[0];
}

export async function seedUser(input: { email: string; password?: string; role?: "member" | "admin"; status?: "invited" | "active" | "disabled"; displayName?: string }) {
  const rows = await getDb()
    .insert(users)
    .values({
      email: input.email,
      displayName: input.displayName ?? input.email.split("@")[0],
      role: input.role ?? "member",
      status: input.status ?? "active",
      passwordHash: input.password ? await hashPassword(input.password) : null,
    })
    .returning();
  return rows[0];
}

export async function currentTotp(userId: string, at = Date.now()): Promise<string> {
  const rows = await getDb().select().from(adminTotp).where(eq(adminTotp.userId, userId)).limit(1);
  const secret = decryptSecret(rows[0].secretEncrypted);
  return new TOTP({ issuer: env().APP_NAME, secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({ timestamp: at });
}

export const STRONG = "correct horse battery staple 2026";

/** Messages "sent" by the server during the tests (captured instead of SMTP). */
export const outbox: { to: string; from: string; subject: string; text: string }[] = [];

/** The one-time link in the latest email to `to`. */
export function lastMailedLink(to: string): { url: string; token: string; text: string } {
  const message = [...outbox].reverse().find((item) => item.to === to);
  if (!message) throw new Error(`no email to ${to}`);
  const url = message.text.match(/https:\/\/\S+\/(invite|reset|setup)\/\S+/)?.[0];
  if (!url) throw new Error("no link in email");
  return { url, token: url.split("/").pop()!, text: message.text };
}

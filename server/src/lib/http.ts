import { z } from "zod";

import { env } from "@/lib/env";

import type { RequestContext } from "./audit";

/** JSON helpers and request plumbing shared by every route handler. */

export type ErrorCode =
  | "invalid_credentials"
  | "account_disabled"
  | "session_revoked"
  | "invalid_token"
  | "token_expired"
  | "rate_limited"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "mfa_required"
  | "weak_password"
  | "csrf"
  | "server_error";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly details?: unknown,
    public readonly headers?: Record<string, string>,
  ) {
    super(code);
  }
}

export const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), { ...init, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(init.headers ?? {}) } });

export const noContent = (): Response => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.code, ...(error.details !== undefined ? { details: error.details } : {}) }, { status: error.status, headers: error.headers });
  }
  console.error(JSON.stringify({ level: "error", msg: "unhandled", error: error instanceof Error ? { name: error.name, message: error.message } : String(error) }));
  return json({ error: "server_error" }, { status: 500 });
}

/** Wraps a handler so thrown HttpErrors become JSON and everything else a 500 without a stack leak. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, "validation", "Body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "validation", parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
  return parsed.data;
}

export function requestContext(request: Request): RequestContext {
  let ip: string | null = null;
  if (env().TRUST_PROXY === "1") {
    const forwarded = request.headers.get("x-forwarded-for");
    ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip");
  }
  return { ip: ip || null, userAgent: request.headers.get("user-agent") };
}

/** For a request authenticated by a cookie, every state change must come from our own origin (CSRF). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const expected = new URL(env().PUBLIC_ORIGIN).origin;
  if (origin) {
    if (origin !== expected) throw new HttpError(403, "csrf");
    return;
  }
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") throw new HttpError(403, "csrf");
  if (!fetchSite) {
    // No Origin and no Fetch Metadata: only accept if the Referer is ours.
    const referer = request.headers.get("referer");
    if (!referer || new URL(referer).origin !== expected) throw new HttpError(403, "csrf");
  }
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

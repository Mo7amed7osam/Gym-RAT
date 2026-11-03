"use client";

import { parseApiOrigin } from "@/lib/api-origin";

/**
 * Browser-side fetch wrapper for the admin API (ADR-018). The API is another
 * origin (NEXT_PUBLIC_API_ORIGIN) on the same site: requests go there
 * directly with `credentials: "include"`, so the API's own HttpOnly
 * SameSite=Strict cookie rides along and this app never handles it. JSON in
 * and out, typed errors with the server's code.
 */
const API_ORIGIN = parseApiOrigin(process.env.NEXT_PUBLIC_API_ORIGIN);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
    public readonly retryAfter: number | null = null,
  ) {
    super(code);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!API_ORIGIN) throw new ApiError(0, "not_configured");
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: { Accept: "application/json", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    mode: "cors",
    credentials: "include",
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const retry = response.headers.get("Retry-After");
    throw new ApiError(response.status, typeof data.error === "string" ? data.error : "server_error", data.details, retry ? Number(retry) : null);
  }
  return data as T;
}

export const ERROR_TEXT: Record<string, string> = {
  invalid_credentials: "That did not match. Check and try again.",
  account_disabled: "This account is disabled.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
  validation: "Some fields are not valid.",
  unauthorized: "Your session has ended. Sign in again.",
  mfa_required: "Finish the two-step verification first.",
  forbidden: "You are not allowed to do that.",
  not_found: "Not found.",
  conflict: "That already exists.",
  weak_password: "Choose a longer, less predictable password.",
  csrf: "Request blocked: open the dashboard from its own address.",
  not_configured: "This dashboard build has no API address (NEXT_PUBLIC_API_ORIGIN is not set).",
  server_error: "Something went wrong on the server.",
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "validation" && Array.isArray(error.details) && error.details[0]?.message) return `${error.details[0].path ? error.details[0].path + ": " : ""}${error.details[0].message}`;
    if (typeof error.details === "string") return error.details;
    if (error.code === "rate_limited" && error.retryAfter) return `Too many attempts. Try again in ${error.retryAfter} s.`;
    return ERROR_TEXT[error.code] ?? ERROR_TEXT.server_error;
  }
  if (error instanceof TypeError) return "Could not reach the server.";
  return ERROR_TEXT.server_error;
}

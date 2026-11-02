/** Minimal cookie helpers so route handlers stay plain functions (testable without a Next request store). */

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  expires: Date;
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`, `Expires=${options.expires.toUTCString()}`, `SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export const clearCookie = (name: string, options: Omit<CookieOptions, "expires">): string => serializeCookie(name, "", { ...options, expires: new Date(0) });

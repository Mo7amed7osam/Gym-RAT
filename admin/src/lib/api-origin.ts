/**
 * The API's public origin (ADR-018), from NEXT_PUBLIC_API_ORIGIN. The value is
 * compiled into the browser bundle, so it is a public URL, never a secret.
 * Unset means "no API" (Preview deployments): the dashboard says so instead
 * of calling anything. Checked at build time by next.config.ts.
 */
export function parseApiOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_ORIGIN is not a URL: ${value}`);
  }
  if (url.origin !== value) throw new Error("NEXT_PUBLIC_API_ORIGIN must be an origin only (scheme, host, optional port), without a path or trailing slash");
  const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) throw new Error("NEXT_PUBLIC_API_ORIGIN must use https");
  return value;
}

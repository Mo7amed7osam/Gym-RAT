/**
 * Where to go after signing in, from the `?next=` parameter. Only a path on
 * this dashboard is accepted; anything that could leave it (absolute URLs,
 * protocol-relative `//host`, backslash tricks browsers turn into `//`,
 * control characters the URL parser strips) falls back to the overview.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return "/";
  const base = "https://dashboard.invalid";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return "/";
  }
  if (url.origin !== base) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

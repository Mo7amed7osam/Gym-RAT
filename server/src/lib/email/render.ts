import { COMMON, type EmailLocale } from "./strings";

/**
 * The GYM RAT email layout (ADR-019): one dark charcoal card with a gold
 * accent, table-based with inline styles so it survives Gmail, Apple Mail and
 * Outlook, 560 px wide and fluid below 600 px. Arabic renders right to left
 * with an Arabic font stack; addresses and links stay left to right inside
 * it. Every email also has a plain-text part with the same content.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailContent {
  locale: EmailLocale;
  subject: string;
  preheader: string;
  heading: string;
  /** Greeting line; omitted when the recipient has no display name. */
  displayName: string | null;
  paragraphs: string[];
  /** Short supporting points under the main text (no action needed). */
  points?: string[];
  cta?: { label: string; url: string };
  /** Expiry line shown in the details box under the button. */
  expiry?: string;
  notRequested: string;
}

/** Brand palette. Contrast on the card (#17171b): text 16.9:1, muted 8.6:1, gold 8.1:1, button text on gold 8.3:1. */
const C = {
  page: "#0b0b0d",
  card: "#17171b",
  border: "#2a2a31",
  box: "#1f1f25",
  text: "#f5f5f7",
  muted: "#b9b9c3",
  faint: "#8a8a95",
  gold: "#d4a54a",
  onGold: "#121214",
};

const FONT = {
  en: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  ar: "'Segoe UI', Tahoma, 'Geeza Pro', 'Noto Sans Arabic', 'Noto Kufi Arabic', Arial, sans-serif",
};

/** Marks a left-to-right value (an address, a link) inside Arabic text. */
export const isolate = (value: string): string => `\u2068${value}\u2069`;

const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Escapes, then turns isolated runs into explicit LTR spans (clients that ignore Unicode isolates still honour dir). */
function inline(value: string): string {
  return escapeHtml(value).replace(/\u2068([^\u2069]*)\u2069/g, '<span dir="ltr" style="unicode-bidi:embed;">$1</span>');
}

export function renderEmail(content: EmailContent): RenderedEmail {
  const { locale } = content;
  const common = COMMON[locale];
  const rtl = locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const font = FONT[locale];
  const lineHeight = rtl ? "1.9" : "1.6";
  const greeting = content.displayName ? common.greeting(content.displayName) : null;

  const p = (text: string, extra = "") => `<p style="margin:0 0 16px;font-family:${font};font-size:16px;line-height:${lineHeight};color:${C.muted};text-align:${align};${extra}">${inline(text)}</p>`;

  const points = content.points?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;">${content.points
        .map(
          (point) =>
            `<tr><td width="18" valign="top" style="padding:9px 0 0;"><div style="width:6px;height:6px;border-radius:3px;background:${C.gold};"></div></td><td style="padding:0 0 10px;font-family:${font};font-size:15px;line-height:${lineHeight};color:${C.muted};text-align:${align};">${inline(point)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const cta = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="${align}" style="margin:12px 0 28px;"><tr><td bgcolor="${C.gold}" style="border-radius:14px;background:${C.gold};">
<a href="${escapeHtml(content.cta.url)}" target="_blank" style="display:inline-block;padding:16px 30px;font-family:${font};font-size:16px;font-weight:700;line-height:1.2;color:${C.onGold};text-decoration:none;border-radius:14px;letter-spacing:${rtl ? "0" : "0.02em"};">${escapeHtml(content.cta.label)}</a>
</td></tr></table>`
    : "";

  const details =
    content.expiry || content.cta
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="clear:both;margin:0 0 24px;"><tr><td style="background:${C.box};border:1px solid ${C.border};border-radius:14px;padding:18px 20px;">
${content.expiry ? `<p style="margin:0 0 ${content.cta ? "14px" : "0"};font-family:${font};font-size:14px;line-height:${lineHeight};color:${C.text};text-align:${align};">${inline(content.expiry)}</p>` : ""}
${
  content.cta
    ? `<p style="margin:0 0 6px;font-family:${font};font-size:13px;line-height:${lineHeight};color:${C.faint};text-align:${align};">${escapeHtml(common.fallbackLabel)}</p>
<p dir="ltr" style="margin:0;font-family:Menlo, Consolas, 'Courier New', monospace;font-size:12px;line-height:1.6;text-align:left;word-break:break-all;"><a href="${escapeHtml(content.cta.url)}" target="_blank" style="color:${C.gold};text-decoration:underline;">${escapeHtml(content.cta.url)}</a></p>`
    : ""
}
</td></tr></table>`
      : "";

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(content.subject)}</title>
<style>
  body { margin:0; padding:0; background:${C.page}; -webkit-text-size-adjust:100%; }
  a { color:${C.gold}; }
  @media (max-width:600px) {
    .gr-container { width:100% !important; }
    .gr-pad { padding-left:24px !important; padding-right:24px !important; }
    .gr-h1 { font-size:27px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" style="padding:36px 12px 40px;">
<table role="presentation" class="gr-container" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;" dir="${dir}">
<tr><td class="gr-pad" style="padding:0 8px 22px;text-align:${align};">
<span dir="ltr" style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:22px;font-weight:800;letter-spacing:0.14em;color:${C.text};">GYM&nbsp;<span style="color:${C.gold};">RAT</span></span>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${C.gold};border-radius:22px 22px 0 0;">&nbsp;</td></tr>
<tr><td class="gr-pad" style="padding:38px 40px 34px;">
<p style="margin:0 0 14px;font-family:${font};font-size:12px;font-weight:700;letter-spacing:${rtl ? "0" : "0.18em"};text-transform:uppercase;color:${C.gold};text-align:${align};">${escapeHtml(common.eyebrow)}</p>
<h1 class="gr-h1" style="margin:0 0 22px;font-family:${font};font-size:32px;font-weight:800;line-height:1.2;letter-spacing:${rtl ? "0" : "-0.01em"};color:${C.text};text-align:${align};">${escapeHtml(content.heading)}</h1>
${greeting ? p(greeting, `color:${C.text};font-weight:600;`) : ""}
${content.paragraphs.map((text) => p(text)).join("\n")}
${points}
${cta}
${details}
<p style="margin:0;padding-top:20px;border-top:1px solid ${C.border};font-family:${font};font-size:13px;line-height:${lineHeight};color:${C.faint};text-align:${align};">${inline(content.notRequested)}</p>
</td></tr>
</table>
</td></tr>
<tr><td class="gr-pad" style="padding:26px 8px 0;text-align:center;">
<p style="margin:0 0 6px;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:13px;font-weight:800;letter-spacing:0.14em;color:${C.muted};" dir="ltr">GYM <span style="color:${C.gold};">RAT</span></p>
<p style="margin:0 0 4px;font-family:${font};font-size:12px;line-height:1.7;color:${C.faint};">${escapeHtml(common.footerTagline)}</p>
<p style="margin:0;font-family:${font};font-size:12px;line-height:1.7;color:${C.faint};">${escapeHtml(common.footerAutomated)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const lines: string[] = ["GYM RAT", "", content.heading, ""];
  if (greeting) lines.push(greeting, "");
  for (const text of content.paragraphs) lines.push(text, "");
  for (const point of content.points ?? []) lines.push(`- ${point}`);
  if (content.points?.length) lines.push("");
  // No colon after the label: "Set my password:" followed by a value would read like a credential.
  if (content.cta) lines.push(content.cta.label, content.cta.url, "");
  if (content.expiry) lines.push(content.expiry, "");
  lines.push(content.notRequested, "", "--", `GYM RAT · ${common.footerTagline}`, common.footerAutomated);
  // Plain text keeps the Unicode isolates for Arabic (they render invisibly) and drops them for English.
  const joined = lines.join("\n");
  const text = rtl ? joined : joined.replace(/[\u2068\u2069]/g, "");
  return { subject: content.subject, html, text };
}

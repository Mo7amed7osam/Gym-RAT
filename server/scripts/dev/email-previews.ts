import fs from "node:fs";
import path from "node:path";

import { invitationEmail, invitationResentEmail, passwordChangedEmail, passwordResetEmail, welcomeEmail, type EmailLocale, type RenderedEmail } from "../../src/lib/email/templates";

/**
 * Writes every transactional email (5 templates × English/Arabic) as .html
 * and .txt plus an index page, with sample data and a fake link (ADR-019).
 *
 *   npm run email:preview -- [outDir]      # default: ./email-previews (git-ignored)
 */
const out = path.resolve(process.argv[2] ?? "email-previews");
fs.mkdirSync(out, { recursive: true });
const origin = process.env.PUBLIC_ORIGIN ?? "https://api.example.com";
const now = new Date("2026-11-03T10:30:00Z");
const names: Record<EmailLocale, string> = { en: "Nour Hassan", ar: "نور حسن" };

const build: Record<string, (locale: EmailLocale) => RenderedEmail> = {
  "1-invitation": (locale) => invitationEmail({ locale, displayName: names[locale], email: "nour@example.com", url: `${origin}/invite/SAMPLE-not-a-real-token-0123456789abcdefghij`, expiresAt: new Date(now.getTime() + 72 * 3_600_000), lifetimeMinutes: 72 * 60 }),
  "2-welcome": (locale) => welcomeEmail({ locale, displayName: names[locale], email: "nour@example.com", at: now }),
  "3-password-reset": (locale) => passwordResetEmail({ locale, displayName: names[locale], email: "nour@example.com", url: `${origin}/reset/SAMPLE-not-a-real-token-0123456789abcdefghij`, expiresAt: new Date(now.getTime() + 60 * 60_000), lifetimeMinutes: 60 }),
  "4-invitation-resent": (locale) => invitationResentEmail({ locale, displayName: names[locale], email: "nour@example.com", url: `${origin}/invite/SAMPLE-not-a-real-token-0123456789abcdefghij`, expiresAt: new Date(now.getTime() + 72 * 3_600_000), lifetimeMinutes: 72 * 60 }),
  "5-password-changed": (locale) => passwordChangedEmail({ locale, displayName: names[locale], email: "nour@example.com", at: now }),
};

const rows: string[] = [];
for (const [name, render] of Object.entries(build)) {
  for (const locale of ["en", "ar"] as const) {
    const email = render(locale);
    fs.writeFileSync(path.join(out, `${name}.${locale}.html`), email.html);
    fs.writeFileSync(path.join(out, `${name}.${locale}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`);
    rows.push(`<li><a href="${name}.${locale}.html">${name} (${locale})</a> · <a href="${name}.${locale}.txt">text</a> — ${email.subject.replace(/</g, "&lt;")}</li>`);
  }
}
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>GYM RAT email previews</title><body style="font-family:system-ui;background:#111;color:#eee;padding:24px"><h1>GYM RAT email previews</h1><ul style="line-height:2">${rows.join("")}</ul></body>`);
console.log(`Wrote ${rows.length} emails to ${out}`);

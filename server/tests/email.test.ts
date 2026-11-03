import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as linkGet } from "@/app/api/auth/links/[token]/route";
import { issueActionLink, redeemActionToken, requestPasswordReset } from "@/lib/auth/action-tokens";
import { invitationEmail, invitationResentEmail, passwordChangedEmail, passwordResetEmail, welcomeEmail, type EmailLocale, type RenderedEmail } from "@/lib/email/templates";
import { env, setEnvForTests, type Env } from "@/lib/env";
import { MailDeliveryError, sendMail, setMailSenderForTests, verifyMail } from "@/lib/mail";
import { createMember, getMember } from "@/lib/members";

import { API_ORIGIN, STRONG, lastMailedLink, outbox, params, req, seedUser } from "./helpers";
import { mimeParts, startFakeSmtp, type FakeSmtp } from "./smtp-server";

/**
 * Transactional emails (ADR-019): the five templates in English and Egyptian
 * Arabic, how the auth flows use them, and the real SMTP path against a local
 * server shaped like Resend (implicit TLS on 465-style, user "resend", API-key
 * password).
 */

const ctx = { ip: "203.0.113.77", userAgent: "vitest" };
const at = new Date("2026-11-03T10:30:00Z");
const link = { url: `${API_ORIGIN}/invite/TOKEN123`, expiresAt: new Date(at.getTime() + 72 * 3_600_000), lifetimeMinutes: 72 * 60 };
const recipient = (locale: EmailLocale) => ({ locale, displayName: "Nour <b>Hassan</b>", email: "nour@example.com" });

const all = (locale: EmailLocale): Record<string, RenderedEmail> => ({
  invitation: invitationEmail({ ...recipient(locale), ...link }),
  resent: invitationResentEmail({ ...recipient(locale), ...link }),
  reset: passwordResetEmail({ ...recipient(locale), ...link, url: `${API_ORIGIN}/reset/TOKEN123`, lifetimeMinutes: 60 }),
  welcome: welcomeEmail({ ...recipient(locale), at }),
  changed: passwordChangedEmail({ ...recipient(locale), at }),
});

describe("templates", () => {
  it.each(["en", "ar"] as const)("render subject, HTML and plain text in %s with the right direction", (locale) => {
    for (const [name, email] of Object.entries(all(locale))) {
      expect(email.subject, name).toContain("GYM RAT");
      expect(email.html, name).toContain(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"`);
      expect(email.html, name).toMatch(/<meta name="viewport"/);
      expect(email.text, name).toContain("GYM RAT");
      // Display names are escaped, never injected.
      expect(email.html, name).not.toContain("<b>Hassan</b>");
      expect(email.html, name).toContain("Nour &lt;b&gt;Hassan&lt;/b&gt;");
      // Western digits only (D8); no Arabic-Indic digits or percent sign.
      expect(email.html + email.text, name).not.toMatch(/[٠-٩۰-۹٪]/);
    }
  });

  it("link emails carry an absolute button URL, the same URL as plain-text fallback, and the expiry", () => {
    for (const locale of ["en", "ar"] as const) {
      const { invitation, reset } = all(locale);
      expect(invitation.html).toContain(`href="${API_ORIGIN}/invite/TOKEN123"`);
      expect(invitation.html).toMatch(/<p dir="ltr"[^>]*><a href="https:\/\/api\.gymrat\.test\/invite\/TOKEN123"/);
      expect(invitation.text).toContain(`\n${API_ORIGIN}/invite/TOKEN123\n`);
      expect(reset.text).toContain(`${API_ORIGIN}/reset/TOKEN123`);
    }
    expect(all("en").invitation.text).toContain("expires in 72 hours, on Friday, 6 November 2026 at 12:30 (Cairo time)");
    expect(all("en").reset.text).toContain("expires in 1 hour");
    expect(all("ar").invitation.text).toContain("وبيخلص بعد 72 ساعة، يوم الجمعة، 6 نوفمبر 2026");
    expect(all("ar").invitation.text).toContain("بتوقيت القاهرة");
    expect(all("ar").reset.text).toContain("بعد ساعة واحدة");
  });

  it("explains what to do when the recipient did not ask for the email", () => {
    expect(all("en").invitation.text).toMatch(/Not expecting this\?/);
    expect(all("en").reset.text).toMatch(/Did not ask for this\? Ignore this email/);
    expect(all("en").changed.text).toMatch(/Was this not you\?/);
    expect(all("ar").reset.text).toMatch(/مش إنت اللي طلبت ده؟/);
    expect(all("ar").changed.text).toMatch(/نسيت كلمة المرور؟/);
  });

  it("keeps addresses left-to-right inside Arabic text", () => {
    const { welcome, changed } = all("ar");
    expect(welcome.html).toContain('<span dir="ltr" style="unicode-bidi:embed;">nour@example.com</span>');
    expect(changed.html).toContain('<span dir="ltr" style="unicode-bidi:embed;">nour@example.com</span>');
    expect(changed.text).toContain("⁨nour@example.com⁩");
    // English plain text has no invisible isolate characters.
    expect(all("en").changed.text).not.toMatch(/[⁨⁩]/);
  });

  it("uses the app's glossary in Arabic and not the undecided terms", () => {
    const text = Object.values(all("ar")).map((email) => email.subject + email.text).join("\n");
    expect(text).toMatch(/كلمة المرور/);
    expect(text).not.toMatch(/المسؤول|المدرب|الكوتش|الهاتف|الموبايل|الخادم|كلمة السر|أرقام قياسية/);
  });
});

describe("auth flows send the right email in the member's language", () => {
  let adminId = "";
  const memberLink = (to: string) => lastMailedLink(to);

  beforeAll(async () => {
    adminId = (await seedUser({ email: "mail-owner@example.com", password: STRONG, role: "admin" })).id;
  });

  it("invites in English by default (MAIL_DEFAULT_LOCALE) with HTML and text", async () => {
    await createMember({ email: "en-member@example.com", displayName: "Omar" }, { id: adminId }, ctx);
    const message = outbox.at(-1)!;
    expect(message.subject).toBe("Your GYM RAT account is ready. Set your password");
    expect(message.html).toContain('lang="en"');
    expect(message.text).toContain(memberLink("en-member@example.com").url);
  });

  it("invites in Arabic when the member's email language is Arabic, and remembers it", async () => {
    const { member } = await createMember({ email: "ar-member@example.com", displayName: "منة", emailLocale: "ar" }, { id: adminId }, ctx);
    expect(member.emailLocale).toBe("ar");
    const message = outbox.at(-1)!;
    expect(message.subject).toBe("حسابك في GYM RAT جاهز. اختار كلمة المرور");
    expect(message.html).toContain('dir="rtl"');
    expect(message.html).toContain("أهلًا منة،");
  });

  it("follows MAIL_DEFAULT_LOCALE for members without a stored language", async () => {
    const original = env();
    setEnvForTests({ ...original, MAIL_DEFAULT_LOCALE: "ar" });
    try {
      await createMember({ email: "default-ar@example.com", displayName: "Hana" }, { id: adminId }, ctx);
      expect(outbox.at(-1)!.subject).toBe("حسابك في GYM RAT جاهز. اختار كلمة المرور");
    } finally {
      setEnvForTests(original);
    }
  });

  it("a resent invitation uses the 'new link' wording and kills the previous link", async () => {
    const first = memberLink("ar-member@example.com");
    const user = await getMember((await seedLookup("ar-member@example.com")).id);
    await issueActionLink(user, "invite", { id: adminId, type: "admin" }, ctx);
    const message = outbox.at(-1)!;
    expect(message.subject).toBe("رابط جديد لتجهيز حسابك في GYM RAT");
    const second = memberLink("ar-member@example.com");
    expect(second.token).not.toBe(first.token);
    expect((await linkGet(req(`/api/auth/links/${first.token}`, { ip: "198.51.100.40" }), params({ token: first.token }))).status).toBe(404);
    expect((await linkGet(req(`/api/auth/links/${second.token}`, { ip: "198.51.100.40" }), params({ token: second.token }))).status).toBe(200);
  });

  it("an expired invitation cannot be used", async () => {
    const { token } = memberLink("en-member@example.com");
    const later = new Date(Date.now() + 73 * 3_600_000);
    await expect(redeemActionToken(token, STRONG, { ...ctx, ip: "198.51.100.41" }, later)).rejects.toMatchObject({ status: 404 });
  });

  it("activation sends exactly one welcome email; a retried redemption sends nothing", async () => {
    const { token } = memberLink("ar-member@example.com");
    const before = outbox.length;
    await redeemActionToken(token, STRONG, { ...ctx, ip: "198.51.100.42" });
    expect(outbox.length).toBe(before + 1);
    expect(outbox.at(-1)!.subject).toBe("أهلًا بيك في GYM RAT. حسابك اتفعّل");
    await expect(redeemActionToken(token, STRONG, { ...ctx, ip: "198.51.100.42" })).rejects.toMatchObject({ status: 404 });
    expect(outbox.length).toBe(before + 1);
  });

  it("a double-submitted 'create member' sends one invitation", async () => {
    const before = outbox.length;
    const results = await Promise.allSettled([1, 2].map(() => createMember({ email: "double@example.com", displayName: "Double" }, { id: adminId }, ctx)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outbox.slice(before).filter((message) => message.to === "double@example.com")).toHaveLength(1);
  });

  it("password reset: reset email, then a password-changed notice after the new password is set", async () => {
    await seedUser({ email: "reset-me@example.com", password: STRONG, displayName: "Reset Me" });
    await requestPasswordReset("reset-me@example.com", { ...ctx, ip: "198.51.100.43" });
    expect(outbox.at(-1)!.subject).toBe("Reset your GYM RAT password");
    const { token } = memberLink("reset-me@example.com");
    expect(lastMailedLink("reset-me@example.com").url).toMatch(/^https:\/\/api\.gymrat\.test\/reset\//);
    await redeemActionToken(token, "another strong passphrase 2026", { ...ctx, ip: "198.51.100.43" });
    const notice = outbox.at(-1)!;
    expect(notice.subject).toBe("Your GYM RAT password was changed");
    expect(notice.text).not.toContain(token);
    expect(notice.text).not.toContain("another strong passphrase 2026");
  });

  it("a failed welcome email never undoes the activation", async () => {
    const { member } = await createMember({ email: "welcome-fails@example.com", displayName: "W" }, { id: adminId }, ctx);
    const { token } = memberLink("welcome-fails@example.com");
    setMailSenderForTests(async () => {
      throw new Error("relay down");
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(redeemActionToken(token, STRONG, { ...ctx, ip: "198.51.100.44" })).resolves.toMatchObject({ kind: "invite" });
      expect((await getMember(member.id)).status).toBe("active");
      expect(errors.mock.calls.flat().join(" ")).not.toContain(token);
    } finally {
      errors.mockRestore();
      setMailSenderForTests(async (message) => {
        outbox.push(message);
      });
    }
  });
});

async function seedLookup(email: string) {
  const { getDb } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  return (await getDb().select().from(users).where(eq(users.email, email)).limit(1))[0];
}

describe("real SMTP transport against a local Resend-shaped relay", () => {
  const key = "re_test_0123456789_not_a_real_key";
  let smtp: FakeSmtp;
  let original: Env;
  let previousTls: string | undefined;

  beforeAll(async () => {
    smtp = await startFakeSmtp({ user: "resend", password: key });
    original = env();
    // The relay uses a self-signed test certificate (tests/fixtures); production verifies certificates normally.
    previousTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  });

  const useRelay = (password = key, port = smtp.port) => {
    setEnvForTests({ ...original, SMTP_HOST: "localhost", SMTP_PORT: port, SMTP_SECURE: "1", SMTP_USER: "resend", SMTP_PASSWORD: password, SMTP_FROM: "GYM RAT <no-reply@send.quantara-eg.test>" });
    setMailSenderForTests(null);
  };

  afterEach(() => {
    smtp.mode = "ok";
    setEnvForTests(original);
    setMailSenderForTests(async (message) => {
      outbox.push(message);
    });
  });

  afterAll(async () => {
    if (previousTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTls;
    await smtp.close();
  });

  it("verifies the connection (TLS + AUTH) without sending anything", async () => {
    useRelay();
    await expect(verifyMail()).resolves.toEqual({ ok: true, host: "localhost", port: smtp.port, secure: true });
    expect(smtp.messages).toHaveLength(0);
    expect(smtp.commands).toContain("AUTH ***");
  });

  it("delivers one multipart message (plain text + HTML, UTF-8) from the configured sender", async () => {
    useRelay();
    const email = invitationEmail({ locale: "ar", displayName: "نور", email: "nour@example.com", ...link });
    const before = smtp.messages.length;
    await sendMail({ to: "nour@example.com", ...email });
    expect(smtp.messages).toHaveLength(before + 1);
    const received = smtp.messages.at(-1)!;
    expect(received.from).toBe("<no-reply@send.quantara-eg.test>");
    expect(received.to).toEqual(["<nour@example.com>"]);
    expect(received.data).toMatch(/^From: GYM RAT <no-reply@send\.quantara-eg\.test>/m);
    expect(received.data).toMatch(/multipart\/alternative/i);
    const parts = mimeParts(received.data);
    expect(parts.map((part) => part.type)).toEqual(["text/plain", "text/html"]);
    expect(parts[0].body).toContain("اختار كلمة المرور");
    expect(parts[1].body).toContain('dir="rtl"');
  });

  it("a wrong API key fails clearly, sends nothing, and never prints the key or the token", async () => {
    useRelay("re_wrong_key_value_123");
    const logs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const before = smtp.messages.length;
    try {
      const verify = await verifyMail();
      expect(verify.ok).toBe(false);
      const error = await sendMail({ to: "nour@example.com", subject: "x", text: `${API_ORIGIN}/invite/SECRET-TOKEN-xyz` }).catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(MailDeliveryError);
      expect((error as MailDeliveryError).code).toBe("send_failed");
      expect((error as MailDeliveryError).message).toMatch(/535/);
      const everything = JSON.stringify([verify, (error as Error).message, logs.mock.calls]);
      expect(everything).not.toContain("re_wrong_key_value_123");
      expect(everything).not.toContain("SECRET-TOKEN-xyz");
      expect(smtp.messages).toHaveLength(before);
    } finally {
      logs.mockRestore();
    }
  });

  it("a temporary relay failure is reported once and not retried; the next send recovers", async () => {
    useRelay();
    smtp.mode = "reject-data";
    const logs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dataBefore = smtp.commands.filter((command) => command === "DATA").length;
    try {
      await expect(sendMail({ to: "nour@example.com", subject: "x", text: "y" })).rejects.toMatchObject({ code: "send_failed" });
      expect(smtp.commands.filter((command) => command === "DATA").length).toBe(dataBefore + 1);
    } finally {
      logs.mockRestore();
    }
    smtp.mode = "ok";
    const before = smtp.messages.length;
    await sendMail({ to: "nour@example.com", subject: "x", text: "y" });
    expect(smtp.messages).toHaveLength(before + 1);
  });

  it("an unreachable relay fails without hanging", async () => {
    useRelay(key, 1);
    const logs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(sendMail({ to: "nour@example.com", subject: "x", text: "y" })).rejects.toMatchObject({ code: "send_failed" });
    } finally {
      logs.mockRestore();
    }
  });
});

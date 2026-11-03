import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { env, loadEnv, setEnvForTests, type Env } from "@/lib/env";
import { MailDeliveryError, mailConfig, sendMail, setMailSenderForTests } from "@/lib/mail";

import { outbox } from "./helpers";

describe("SMTP configuration and failures", () => {
  let original: Env;
  beforeEach(() => {
    original = env();
  });
  afterEach(() => {
    setEnvForTests(original);
    setMailSenderForTests(async (message) => {
      outbox.push(message);
    });
  });

  it("validates the variables: host needs a sender; user and password come together", () => {
    const base = { NODE_ENV: "test", DATABASE_URL: "postgres://x", AUTH_SECRET: "x".repeat(40), PUBLIC_ORIGIN: "https://api.example.org", ADMIN_ORIGIN: "https://admin.example.org" } as const;
    expect(() => loadEnv({ ...base, SMTP_HOST: "smtp.example.org" } as NodeJS.ProcessEnv)).toThrow(/SMTP_FROM is required/);
    expect(() => loadEnv({ ...base, SMTP_HOST: "smtp.example.org", SMTP_FROM: "a@b.c", SMTP_USER: "u" } as NodeJS.ProcessEnv)).toThrow(/SMTP_USER and SMTP_PASSWORD/);
    const ok = loadEnv({ ...base, SMTP_HOST: "smtp.example.org", SMTP_FROM: "Gym RAT <a@b.c>", SMTP_PORT: "465", SMTP_SECURE: "1" } as NodeJS.ProcessEnv);
    expect(ok).toMatchObject({ SMTP_PORT: 465, SMTP_SECURE: "1" });
    expect(loadEnv(base as NodeJS.ProcessEnv).SMTP_HOST).toBeUndefined();
  });

  it("treats blank values (docker-compose passes `${SMTP_HOST:-}` as \"\") as not set instead of failing to start", () => {
    const base = { NODE_ENV: "production", DATABASE_URL: "postgres://x", AUTH_SECRET: "x".repeat(40), PUBLIC_ORIGIN: "https://api.example.org", ADMIN_ORIGIN: "https://admin.example.org" } as const;
    const blank = loadEnv({ ...base, SMTP_HOST: "", SMTP_PORT: "465", SMTP_SECURE: "1", SMTP_USER: "", SMTP_PASSWORD: "", SMTP_FROM: "", MAIL_DEFAULT_LOCALE: "" } as NodeJS.ProcessEnv);
    expect([blank.SMTP_HOST, blank.SMTP_USER, blank.SMTP_PASSWORD, blank.SMTP_FROM, blank.MAIL_DEFAULT_LOCALE]).toEqual([undefined, undefined, undefined, undefined, "en"]);
    // Resend's documented SMTP settings, with the API key still blank, fail loudly rather than half-configured.
    expect(() => loadEnv({ ...base, SMTP_HOST: "smtp.resend.com", SMTP_PORT: "465", SMTP_SECURE: "1", SMTP_USER: "resend", SMTP_PASSWORD: "", SMTP_FROM: "GYM RAT <no-reply@send.quantara-eg.com>" } as NodeJS.ProcessEnv)).toThrow(/SMTP_USER and SMTP_PASSWORD/);
    const resend = loadEnv({ ...base, SMTP_HOST: "smtp.resend.com", SMTP_PORT: "465", SMTP_SECURE: "1", SMTP_USER: "resend", SMTP_PASSWORD: "re_placeholder", SMTP_FROM: "GYM RAT <no-reply@send.quantara-eg.com>", MAIL_DEFAULT_LOCALE: "ar" } as NodeJS.ProcessEnv);
    expect(resend).toMatchObject({ SMTP_HOST: "smtp.resend.com", SMTP_PORT: 465, SMTP_SECURE: "1", SMTP_USER: "resend", MAIL_DEFAULT_LOCALE: "ar" });
  });

  it("reports a send failure without the SMTP credentials", async () => {
    setEnvForTests({ ...original, SMTP_USER: "mailer@example.org", SMTP_PASSWORD: "s3cret-pass" });
    expect(mailConfig()).toMatchObject({ user: "mailer@example.org", secure: false, port: 587 });
    setMailSenderForTests(async () => {
      throw Object.assign(new Error("Invalid login for mailer@example.org with s3cret-pass"), { code: "EAUTH", responseCode: 535 });
    });
    const failure = await sendMail({ to: "m@example.org", subject: "s", text: "t" }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(MailDeliveryError);
    const message = (failure as MailDeliveryError).message;
    expect(message).toMatch(/^EAUTH · SMTP 535 · /);
    expect(message).not.toContain("s3cret-pass");
    expect(message).not.toContain("mailer@example.org");
  });

  it("refuses to send when not configured", async () => {
    setEnvForTests({ ...original, SMTP_HOST: undefined, SMTP_FROM: undefined });
    await expect(sendMail({ to: "m@example.org", subject: "s", text: "t" })).rejects.toMatchObject({ code: "not_configured" });
  });
});

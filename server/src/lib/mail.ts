import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/lib/env";

/**
 * Outbound email over SMTP (owner decision 2026-11-02: invitations are
 * emailed automatically). Configuration comes only from server environment
 * variables (see server/README.md "Email (SMTP)"); nothing here reaches the
 * iOS app. Failures are reported to the caller, never swallowed: the caller
 * records the delivery status so the admin can see it and resend.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailConfig {
  host: string;
  port: number;
  /** true: implicit TLS (usually port 465). false: STARTTLS is required on connect (usually 587). */
  secure: boolean;
  user: string | null;
  password: string | null;
  from: string;
}

/** The SMTP settings, or null when outbound email is not configured. */
export function mailConfig(): MailConfig | null {
  const e = env();
  if (!e.SMTP_HOST || !e.SMTP_FROM) return null;
  return {
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE === "1",
    user: e.SMTP_USER ?? null,
    password: e.SMTP_PASSWORD ?? null,
    from: e.SMTP_FROM,
  };
}

export class MailDeliveryError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "send_failed",
  ) {
    super(message);
  }
}

type Sender = (message: MailMessage & { from: string }) => Promise<void>;

let testSender: Sender | null = null;

/** Test seam: capture or fail outbound mail without a server. `null` restores SMTP. */
export function setMailSenderForTests(sender: Sender | null): void {
  testSender = sender;
}

let cachedTransport: { key: string; transport: Transporter } | null = null;

function transportFor(config: MailConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user ?? ""}`;
  if (cachedTransport?.key === key) return cachedTransport.transport;
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: config.user ? { user: config.user, pass: config.password ?? "" } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  cachedTransport = { key, transport };
  return transport;
}

/** A failure description safe to store and show: no credentials, no server banner dump. */
function describe(error: unknown, config: MailConfig): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : null;
  const response = typeof error === "object" && error && "responseCode" in error ? Number((error as { responseCode: unknown }).responseCode) : null;
  let text = error instanceof Error ? error.message : String(error);
  for (const secret of [config.password, config.user]) if (secret) text = text.split(secret).join("***");
  text = text.replace(/\s+/g, " ").slice(0, 200);
  return [code, response ? `SMTP ${response}` : null, text].filter(Boolean).join(" · ");
}

/** Sends one message. Throws MailDeliveryError when mail is not configured or the server rejects it. */
export async function sendMail(message: MailMessage): Promise<void> {
  const config = mailConfig();
  if (!config) throw new MailDeliveryError("Outbound email is not configured (SMTP_HOST and SMTP_FROM are required).", "not_configured");
  try {
    if (testSender) await testSender({ ...message, from: config.from });
    else await transportFor(config).sendMail({ from: config.from, ...message });
  } catch (error) {
    const reason = describe(error, config);
    console.error(JSON.stringify({ level: "error", msg: "mail failed", to: message.to, reason }));
    throw new MailDeliveryError(reason, "send_failed");
  }
}

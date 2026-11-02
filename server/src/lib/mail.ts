import nodemailer from "nodemailer";

import { env } from "@/lib/env";

/** Optional SMTP delivery. Returns false (and logs) when mail is not configured or fails; callers fall back to manual sharing. */
export async function sendMail(message: { to: string; subject: string; text: string }): Promise<boolean> {
  const e = env();
  if (!e.SMTP_URL) return false;
  try {
    const transport = nodemailer.createTransport(e.SMTP_URL);
    await transport.sendMail({ from: e.SMTP_FROM ?? `${e.APP_NAME} <no-reply@${new URL(e.PUBLIC_ORIGIN).hostname}>`, ...message });
    return true;
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "mail failed", to: message.to, error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

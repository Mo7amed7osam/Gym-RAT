import { renderEmail, isolate, type RenderedEmail } from "./render";
import { INVITATION, INVITATION_RESENT, PASSWORD_CHANGED, PASSWORD_RESET, WELCOME, cairoTime, lifetime, type EmailLocale, type LinkCopy, type NoticeCopy } from "./strings";

/**
 * The five GYM RAT transactional emails (ADR-019). Each returns subject, HTML
 * and plain text in the recipient's language. Links are absolute URLs built
 * by the caller from PUBLIC_ORIGIN; the one-time token inside them is never
 * logged. No template takes or prints a password.
 */

export type { EmailLocale } from "./strings";
export type { RenderedEmail } from "./render";

interface Recipient {
  locale: EmailLocale;
  displayName: string | null;
  email: string;
}

interface LinkInput extends Recipient {
  url: string;
  expiresAt: Date;
  /** Link lifetime in minutes, for the "expires in …" phrase. */
  lifetimeMinutes: number;
}

function linkEmail(copy: Record<EmailLocale, LinkCopy>, input: LinkInput): RenderedEmail {
  const c = copy[input.locale];
  return renderEmail({
    locale: input.locale,
    subject: c.subject,
    preheader: c.preheader,
    heading: c.heading,
    displayName: input.displayName,
    paragraphs: c.body,
    cta: { label: c.cta, url: input.url },
    expiry: c.expiry(lifetime(input.lifetimeMinutes, input.locale), cairoTime(input.expiresAt, input.locale)),
    notRequested: c.notRequested,
  });
}

function noticeEmail(copy: Record<EmailLocale, NoticeCopy>, input: Recipient & { at: Date }): RenderedEmail {
  const c = copy[input.locale];
  return renderEmail({
    locale: input.locale,
    subject: c.subject,
    preheader: c.preheader,
    heading: c.heading,
    displayName: input.displayName,
    paragraphs: c.body(isolate(input.email), cairoTime(input.at, input.locale)),
    points: c.steps,
    notRequested: c.notRequested,
  });
}

/** 1. First invitation of a member created in the dashboard. */
export const invitationEmail = (input: LinkInput): RenderedEmail => linkEmail(INVITATION, input);

/** 4. A later invitation for the same member; the earlier link no longer works. */
export const invitationResentEmail = (input: LinkInput): RenderedEmail => linkEmail(INVITATION_RESENT, input);

/** 3. Password-reset link (from the app's "Forgot password?" or the dashboard). */
export const passwordResetEmail = (input: LinkInput): RenderedEmail => linkEmail(PASSWORD_RESET, input);

/** 2. Sent once an invited member has set a password and the account is active. */
export const welcomeEmail = (input: Recipient & { at: Date }): RenderedEmail => noticeEmail(WELCOME, input);

/** 5. Security notice after a password change through a reset link (every device was signed out). */
export const passwordChangedEmail = (input: Recipient & { at: Date }): RenderedEmail => noticeEmail(PASSWORD_CHANGED, input);

"use client";

import { AlertTriangle, Link2, Mail, MailX } from "lucide-react";

import { CopyButton } from "@/components/ui/copy-button";
import type { IssuedLink } from "@/lib/api-types";
import { formatDateTime } from "@/lib/utils";

/**
 * Result of issuing a one-time link. Invitations are only ever emailed: the
 * panel reports whether the mail server accepted the message (and why not),
 * never the link itself. A reset link without working email is shown once to
 * share by hand.
 */
export function LinkPanel({ link, email }: { link: IssuedLink; email: string }) {
  const kindLabel = link.kind === "reset" ? "password-reset link" : "invitation";
  if (link.emailStatus === "failed" && link.kind === "invite") {
    return (
      <div className="rounded-tile border border-danger/40 bg-danger-muted p-4" role="alert">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-danger text-white">
            <MailX className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">The invitation email to {email} could not be sent.</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">Mail server said: {link.emailError ?? "unknown error"}</p>
            <p className="mt-2 text-[13px] text-fg-muted">The account exists but nobody can activate it yet. Fix the SMTP settings (server/README.md, “Email (SMTP)”), then use “Resend invitation” on the member page. No link is shown here: invitations are delivered by email only.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-tile border border-accent/40 bg-accent-muted/40 p-4" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">{link.delivery === "email" ? <Mail className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{link.delivery === "email" ? `The ${kindLabel} was emailed to ${email}.` : `Share this ${kindLabel} with ${email}.`}</p>
          <p className="mt-0.5 text-[13px] text-fg-muted">Works once · expires {formatDateTime(link.expiresAt)}. Issuing another one cancels this one.</p>
          {link.url ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-row bg-bg px-3 py-2 font-mono text-[12px]">{link.url}</code>
                <CopyButton value={link.url} />
              </div>
              <p className="mt-3 flex items-start gap-2 text-[12px] text-fg-muted">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                <span>
                  {link.emailError ? `Email failed (${link.emailError}). ` : ""}Send it over a channel you trust (in person, a secure message). Anyone who opens it first sets the password. If in doubt, issue a new link, which cancels this one.
                </span>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

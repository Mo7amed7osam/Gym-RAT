"use client";

import { AlertTriangle, Link2, Mail } from "lucide-react";

import { CopyButton } from "@/components/ui/copy-button";
import type { IssuedLink } from "@/lib/auth/action-tokens";
import { formatDateTime } from "@/lib/utils";

/** Shows a freshly issued one-time link exactly once, with the manual-sharing caveat. */
export function LinkPanel({ link, email }: { link: IssuedLink; email: string }) {
  const kindLabel = link.kind === "reset" ? "password-reset link" : "invitation link";
  return (
    <div className="rounded-tile border border-accent/40 bg-accent-muted/40 p-4" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">{link.delivery === "email" ? <Mail className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{link.delivery === "email" ? `The ${kindLabel} was emailed to ${email}.` : `Share this ${kindLabel} with ${email}.`}</p>
          <p className="mt-0.5 text-[13px] text-fg-muted">Works once · expires {formatDateTime(link.expiresAt)}. Issuing another link cancels this one.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-row bg-bg px-3 py-2 font-mono text-[12px]">{link.url}</code>
            <CopyButton value={link.url} />
          </div>
          {link.delivery === "manual" ? (
            <p className="mt-3 flex items-start gap-2 text-[12px] text-fg-muted">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              <span>Send it over a channel you trust (in person, a secure message). Anyone who opens it first sets the password. If in doubt, issue a new link, which cancels this one.</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

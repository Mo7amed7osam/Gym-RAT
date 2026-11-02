"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { LinkPanel } from "@/components/admin/link-panel";
import { PageHeader } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { IssuedLink } from "@/lib/auth/action-tokens";
import { api, describeError } from "@/lib/client/api";
import type { MemberSummary } from "@/lib/members";

export function NewMember() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ member: MemberSummary; link: IssuedLink } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ member: MemberSummary; link: IssuedLink }>("/api/admin/members", { body: { email, displayName } });
      setCreated(result);
      toast.success("Member created", `${result.member.displayName} can set a password with the link.`);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Members" title="New member" description="You create the account; the member chooses the password through a one-time link. You never see or store it." />
      <div className="fade-up grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,560px)_1fr]">
        <Card>
          <CardBody className="pt-5">
            {created ? (
              <div className="flex flex-col gap-5">
                <div>
                  <p className="eyebrow">Created</p>
                  <p className="display mt-1 text-[28px]">{created.member.displayName}</p>
                  <p className="text-[14px] text-fg-muted">{created.member.email}</p>
                </div>
                <LinkPanel link={created.link} email={created.member.email} />
                <div className="flex flex-wrap gap-2">
                  <Button>
                    <Link href={`/members/${created.member.id}`}>Open member</Link>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCreated(null);
                      setEmail("");
                      setDisplayName("");
                    }}
                  >
                    Create another
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <Input label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nour Hassan" autoComplete="off" required autoFocus maxLength={80} />
                <Input label="Email" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nour@example.com" hint="They will sign in with this address." required />
                {error ? (
                  <p role="alert" className="rounded-row bg-danger-muted px-3 py-2 text-[13px] font-semibold text-danger">
                    {error}
                  </p>
                ) : null}
                <div className="flex items-center gap-2 pt-1">
                  <Button type="submit" size="lg" loading={busy} disabled={!email || !displayName.trim()}>
                    Create and get link
                  </Button>
                  <Button variant="ghost" size="lg">
                    <Link href="/members">Cancel</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
        <aside className="text-[13px] text-fg-muted lg:pt-2">
          <h2 className="eyebrow">What the member gets</h2>
          <ul className="mt-3 space-y-2">
            <li>Every feature of the app. There are no tiers.</li>
            <li>Workouts stored only on their iPhone; nothing is uploaded here.</li>
            <li>Seven days of offline use before the app asks them to connect again.</li>
          </ul>
          <h2 className="eyebrow mt-6">Invitation links</h2>
          <ul className="mt-3 space-y-2">
            <li>Valid for 72 hours, usable once, stored only as a hash.</li>
            <li>Without outbound email configured, you share the link yourself.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}

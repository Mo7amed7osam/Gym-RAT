"use client";

import { KeyRound, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, describeError } from "@/lib/client/api";
import { useApi } from "@/lib/client/use-api";
import type { SessionRow } from "@/lib/members";
import { formatDateTime, formatRelative } from "@/lib/utils";

interface ResetRequest {
  id: string;
  email: string;
  userId: string | null;
  requestedAt: string;
  ip: string | null;
}

interface Account {
  sessions: { id: string; current: boolean; ip: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string }[];
}

export function SecurityView() {
  const toast = useToast();
  const sessions = useApi<{ items: SessionRow[] }>("/api/admin/sessions");
  const resets = useApi<{ items: ResetRequest[] }>("/api/admin/reset-requests");
  const account = useApi<Account>("/api/admin/account");
  const [revoke, setRevoke] = useState<SessionRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (key: string, action: () => Promise<void>, success: string, after: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await after();
    } catch (cause) {
      toast.error("That did not work", describeError(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Security" description="Live member devices, password-reset requests from the app, and your own browser sessions." />

      {resets.data && resets.data.items.length > 0 ? (
        <Card className="fade-up mb-4 border-warning/40">
          <CardHeader title="Reset requests" description="Members tapped “Forgot password” in the app. Issue a reset link from their page, or dismiss if you spoke to them." />
          <ul className="divide-y divide-border">
            {resets.data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-[14px]">
                <span className="flex size-9 items-center justify-center rounded-full bg-warning-muted text-warning">
                  <KeyRound className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.email}</p>
                  <p className="text-[13px] text-fg-muted">
                    {formatRelative(item.requestedAt)}
                    {item.ip ? ` · ${item.ip}` : ""}
                    {item.userId ? "" : " · no account with this email"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {item.userId ? (
                    <Button size="sm" variant="tinted">
                      <Link href={`/members/${item.userId}`}>Open member</Link>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" loading={busy === item.id} onClick={() => void act(item.id, async () => { await api(`/api/admin/reset-requests/${item.id}`, { method: "DELETE" }); }, "Request dismissed", resets.refetch)}>
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="fade-up">
        <CardHeader title="Signed-in member devices" description="One row per device. Revoking signs that device out the next time it is online." />
        {sessions.error ? (
          <p role="alert" className="px-5 py-4 text-danger">
            {sessions.error}
          </p>
        ) : sessions.loading && !sessions.data ? (
          <TableSkeleton rows={5} cols={4} />
        ) : !sessions.data || sessions.data.items.length === 0 ? (
          <EmptyState icon={Smartphone} title="No devices signed in" body="Sessions appear here as members sign in to the app." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Member</TH>
                <TH className="hidden sm:table-cell">Device</TH>
                <TH className="hidden md:table-cell">Last seen</TH>
                <TH className="hidden lg:table-cell">Expires</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {sessions.data.items.map((row) => (
                <TR key={row.familyId}>
                  <TD>
                    <Link href={`/members/${row.userId}`} className="font-semibold hover:underline">
                      {row.displayName}
                    </Link>
                    <span className="block text-[13px] text-fg-muted">{row.email}</span>
                  </TD>
                  <TD className="hidden text-fg-muted sm:table-cell">
                    {row.deviceName ?? "Unknown device"}
                    {row.ip ? <span className="block text-[12px]">{row.ip}</span> : null}
                  </TD>
                  <TD className="hidden text-fg-muted md:table-cell" title={formatDateTime(row.lastSeenAt)}>
                    {formatRelative(row.lastSeenAt)}
                  </TD>
                  <TD className="hidden text-fg-muted lg:table-cell">{formatDateTime(row.expiresAt)}</TD>
                  <TD className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setRevoke(row)}>
                      Revoke
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="fade-up mt-4">
        <CardHeader
          title="Your browser sessions"
          description="Dashboard sign-ins for your admin account."
          action={
            account.data && account.data.sessions.length > 1 ? (
              <Button size="sm" variant="destructive" loading={busy === "others"} onClick={() => void act("others", async () => { await api("/api/admin/account", { method: "DELETE" }); }, "Other sessions signed out", account.refetch)}>
                Sign out others
              </Button>
            ) : null
          }
        />
        {!account.data ? (
          <TableSkeleton rows={2} cols={3} />
        ) : (
          <ul className="divide-y divide-border">
            {account.data.sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-3 px-5 py-3.5 text-[14px]">
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-raised text-fg-muted">
                  <Monitor className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {session.current ? "This browser" : (session.userAgent ?? "Browser")}
                    {session.current ? <span className="ml-2 rounded-full bg-success-muted px-2 py-0.5 text-[11px] font-semibold text-success">current</span> : null}
                  </p>
                  <p className="truncate text-[13px] text-fg-muted">
                    Last active {formatRelative(session.lastSeenAt)} · since {formatDateTime(session.createdAt)}
                    {session.ip ? ` · ${session.ip}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={revoke !== null}
        onClose={() => setRevoke(null)}
        title="Sign this device out?"
        description={revoke ? `${revoke.displayName}’s ${revoke.deviceName ?? "device"} will be signed out at its next contact with the server.` : ""}
        confirmLabel="Revoke"
        destructive
        loading={busy === revoke?.familyId}
        onConfirm={async () => {
          if (!revoke) return;
          await act(revoke.familyId, async () => { await api(`/api/admin/members/${revoke.userId}/sessions?familyId=${revoke.familyId}`, { method: "DELETE" }); }, "Device signed out", sessions.refetch);
          setRevoke(null);
        }}
      />
    </>
  );
}

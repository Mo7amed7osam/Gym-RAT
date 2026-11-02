"use client";

import { ArrowLeft, Ban, CheckCircle2, KeyRound, Link2, Pencil, Smartphone, Trash2, UserRoundX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LinkPanel } from "@/components/admin/link-panel";
import { PageHeader } from "@/components/admin/shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import type { IssuedLink } from "@/lib/auth/action-tokens";
import { api, describeError } from "@/lib/client/api";
import { useApi } from "@/lib/client/use-api";
import type { MemberDetail } from "@/lib/members";
import { formatDateTime, formatRelative } from "@/lib/utils";

type Pending = "disable" | "enable" | "revokeAll" | "delete" | "link" | "rename" | null;

export function MemberDetailView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, error, refetch } = useApi<MemberDetail>(`/api/admin/members/${id}`);
  const [confirm, setConfirm] = useState<Exclude<Pending, "link" | "rename">>(null);
  const [busy, setBusy] = useState<Pending>(null);
  const [link, setLink] = useState<IssuedLink | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<void>, success: string) => {
    setBusy(kind);
    try {
      await action();
      toast.success(success);
      await refetch();
    } catch (cause) {
      toast.error("That did not work", describeError(cause));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  if (error) {
    return (
      <>
        <PageHeader title="Member" />
        <EmptyState icon={UserRoundX} title="Member not found" body={error} action={<Button variant="secondary"><Link href="/members">Back to members</Link></Button>} />
      </>
    );
  }

  const member = data?.member;
  const canInvite = member?.status === "invited";
  const canReset = member?.status === "active";

  return (
    <>
      <Link href="/members" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Members
      </Link>
      <div className="fade-up mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          {member ? <Avatar name={member.displayName} className="size-14 text-[20px]" /> : <Skeleton className="size-14 rounded-full" />}
          <div>
            {member ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="display text-[36px] leading-none sm:text-[44px]">{member.displayName}</h1>
                  <StatusBadge status={member.status} />
                  <Button variant="ghost" size="icon" aria-label="Rename" onClick={() => { setName(member.displayName); setRenaming(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                </div>
                <p className="mt-1 text-[14px] text-fg-muted">{member.email}</p>
              </>
            ) : (
              <>
                <Skeleton className="h-9 w-48" />
                <Skeleton className="mt-2 h-4 w-40" />
              </>
            )}
          </div>
        </div>
        {member ? (
          <div className="flex flex-wrap gap-2">
            {canInvite ? (
              <Button variant="tinted" loading={busy === "link"} onClick={() => void run("link", async () => setLink(await api<IssuedLink>(`/api/admin/members/${id}/links`, { body: { kind: "invite" } })), "New invitation link issued")}>
                <Link2 className="size-4" aria-hidden /> New invitation link
              </Button>
            ) : null}
            {canReset ? (
              <Button variant="tinted" loading={busy === "link"} onClick={() => void run("link", async () => setLink(await api<IssuedLink>(`/api/admin/members/${id}/links`, { body: { kind: "reset" } })), "Password-reset link issued")}>
                <KeyRound className="size-4" aria-hidden /> Reset password
              </Button>
            ) : null}
            {member.status === "disabled" ? (
              <Button variant="secondary" onClick={() => setConfirm("enable")}>
                <CheckCircle2 className="size-4" aria-hidden /> Enable
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setConfirm("disable")}>
                <Ban className="size-4" aria-hidden /> Disable
              </Button>
            )}
            <Button variant="destructive" onClick={() => setConfirm("delete")}>
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          </div>
        ) : null}
      </div>

      {member && data.openResetRequests > 0 ? (
        <div className="fade-up mb-4 flex items-center justify-between gap-3 rounded-tile border border-warning/40 bg-warning-muted px-4 py-3 text-[14px]">
          <span>
            <strong>{data.openResetRequests}</strong> open “forgot password” request{data.openResetRequests > 1 ? "s" : ""} from the app. Issuing a reset link resolves them.
          </span>
        </div>
      ) : null}
      {link && member ? (
        <div className="fade-up mb-4">
          <LinkPanel link={link} email={member.email} />
        </div>
      ) : null}

      <div className="fade-up grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Signed-in devices"
              description="Each row is one device’s refresh session. Revoking signs it out at its next contact with the server."
              action={
                data && data.sessions.length > 0 ? (
                  <Button variant="destructive" size="sm" onClick={() => setConfirm("revokeAll")} loading={busy === "revokeAll"}>
                    Revoke all
                  </Button>
                ) : null
              }
            />
            {loading && !data ? (
              <div className="space-y-3 px-5 pb-5">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : !data || data.sessions.length === 0 ? (
              <EmptyState icon={Smartphone} title="No signed-in devices" body={member?.status === "invited" ? "They have not set a password yet." : "Nothing is signed in right now."} />
            ) : (
              <ul className="divide-y divide-border">
                {data.sessions.map((session) => (
                  <li key={session.familyId} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex size-9 items-center justify-center rounded-full bg-surface-raised text-fg-muted">
                      <Smartphone className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 text-[13px]">
                      <p className="font-semibold text-fg">{session.deviceName ?? "Unknown device"}</p>
                      <p className="text-fg-muted">
                        Last seen {formatRelative(session.lastSeenAt)} · since {formatDateTime(session.createdAt)}
                        {session.ip ? ` · ${session.ip}` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => void run("revokeAll", async () => { await api(`/api/admin/members/${id}/sessions?familyId=${session.familyId}`, { method: "DELETE" }); }, "Device signed out")}>
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" description="Security events for this member. Newest first." />
            {loading && !data ? (
              <div className="space-y-3 px-5 pb-5">
                <Skeleton className="h-5" />
                <Skeleton className="h-5" />
                <Skeleton className="h-5" />
              </div>
            ) : !data || data.audit.length === 0 ? (
              <EmptyState icon={KeyRound} title="Nothing yet" />
            ) : (
              <ol className="divide-y divide-border">
                {data.audit.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 px-5 py-3 text-[13px]">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${event.success ? "bg-success" : "bg-danger"}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{describeAction(event.action)}</p>
                      <p className="text-fg-muted">
                        {formatDateTime(event.at)} · {event.actorType}
                        {event.ip ? ` · ${event.ip}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[13px]">
                <dt className="text-fg-muted">Status</dt>
                <dd>{member ? <StatusBadge status={member.status} /> : <Skeleton className="w-16" />}</dd>
                <dt className="text-fg-muted">Last login</dt>
                <dd>{member ? formatDateTime(member.lastLoginAt) : <Skeleton />}</dd>
                <dt className="text-fg-muted">Created</dt>
                <dd>{member ? formatDateTime(member.createdAt) : <Skeleton />}</dd>
                <dt className="text-fg-muted">Devices</dt>
                <dd className="tnum">{member ? member.activeSessions : <Skeleton className="w-6" />}</dd>
                <dt className="text-fg-muted">Member id</dt>
                <dd className="truncate font-mono text-[12px] text-fg-muted" title={id}>
                  {id}
                </dd>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Pending links" description="Unused invitation or reset links." />
            <CardBody>
              {!data ? (
                <Skeleton className="h-5" />
              ) : data.pendingLinks.length === 0 ? (
                <p className="text-[13px] text-fg-muted">None outstanding.</p>
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {data.pendingLinks.map((item) => (
                    <li key={`${item.kind}-${item.createdAt}`} className="flex items-center justify-between gap-2">
                      <Badge tone={item.kind === "reset" ? "info" : "warning"}>{item.kind === "reset" ? "Reset" : "Invitation"}</Badge>
                      <span className="text-fg-muted">expires {formatRelative(item.expiresAt).replace(" ago", "")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Local data" />
            <CardBody>
              <p className="text-[13px] text-fg-muted">Workouts live on the member’s iPhone only. Nothing here can view, export or delete them; disabling or deleting the account leaves the phone’s data in place.</p>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "disable"}
        onClose={() => setConfirm(null)}
        title="Disable this member?"
        description={`${member?.displayName ?? "They"} will be signed out of every device the next time it is online and will not be able to sign in. Their workouts stay on their phone. You can enable the account again later.`}
        confirmLabel="Disable"
        destructive
        loading={busy === "disable"}
        onConfirm={() => run("disable", async () => { await api(`/api/admin/members/${id}`, { method: "PATCH", body: { status: "disabled" } }); }, "Member disabled")}
      />
      <ConfirmDialog
        open={confirm === "enable"}
        onClose={() => setConfirm(null)}
        title="Enable this member?"
        description="They can sign in again with their existing password."
        confirmLabel="Enable"
        loading={busy === "enable"}
        onConfirm={() => run("enable", async () => { await api(`/api/admin/members/${id}`, { method: "PATCH", body: { status: "active" } }); }, "Member enabled")}
      />
      <ConfirmDialog
        open={confirm === "revokeAll"}
        onClose={() => setConfirm(null)}
        title="Sign out every device?"
        description="Each device is signed out the next time it contacts the server; a phone that is offline keeps working for the rest of its 7-day lease. The password stays the same."
        confirmLabel="Revoke all sessions"
        destructive
        loading={busy === "revokeAll"}
        onConfirm={() => run("revokeAll", async () => { await api(`/api/admin/members/${id}/sessions`, { method: "DELETE" }); }, "All devices signed out")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete this account?"
        description={
          <>
            <strong>{member?.email}</strong> is removed permanently with its sessions and pending links. Audit entries stay. Workouts already on their phone are not touched, but the app will sign them out. This cannot be undone.
          </>
        }
        confirmLabel="Delete account"
        destructive
        loading={busy === "delete"}
        onConfirm={() =>
          run("delete", async () => {
            await api(`/api/admin/members/${id}`, { method: "DELETE" });
            router.replace("/members");
          }, "Account deleted")
        }
      />
      <Dialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === "rename"}
              disabled={!name.trim()}
              onClick={() =>
                run("rename", async () => {
                  await api(`/api/admin/members/${id}`, { method: "PATCH", body: { displayName: name.trim() } });
                  setRenaming(false);
                }, "Name updated")
              }
            >
              Save
            </Button>
          </>
        }
      >
        <Input label="Display name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus />
      </Dialog>
    </>
  );
}

const ACTIONS: Record<string, string> = {
  "member.created": "Account created",
  "member.login": "Signed in",
  "member.login.failed": "Failed sign-in attempt",
  "member.login.disabled": "Sign-in refused: account disabled",
  "member.login.rate_limited": "Sign-in rate-limited",
  "member.refresh": "Session refreshed",
  "member.refresh.reuse_detected": "Refresh token reuse: family revoked",
  "member.logout": "Signed out",
  "member.disabled": "Disabled by admin",
  "member.enabled": "Enabled by admin",
  "member.renamed": "Renamed by admin",
  "member.deleted": "Deleted by admin",
  "member.session.revoked": "Device revoked by admin",
  "member.sessions.revoked_all": "All devices revoked by admin",
  "member.forgot.requested": "Forgot-password request",
  "link.issued.invite": "Invitation link issued",
  "link.issued.reset": "Reset link issued",
  "link.redeemed.invite": "Password set via invitation",
  "link.redeemed.reset": "Password reset completed",
  "link.redeemed.admin_setup": "Admin password set",
  "admin.login.password_ok": "Admin password accepted (MFA pending)",
  "admin.login": "Admin signed in",
  "admin.login.failed": "Failed admin sign-in",
  "admin.totp.enrolled": "Authenticator enrolled",
  "admin.totp.failed": "Wrong authenticator code",
  "admin.totp.confirm_failed": "Authenticator enrolment code rejected",
  "admin.password.changed": "Admin password changed",
  "admin.sessions.revoked_others": "Other admin sessions signed out",
};

export const describeAction = (action: string): string => ACTIONS[action] ?? action;

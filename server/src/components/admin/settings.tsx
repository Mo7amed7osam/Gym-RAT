"use client";

import { Globe, KeyRound, Mail, ShieldCheck, Timer } from "lucide-react";
import { useState, type FormEvent } from "react";

import { PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, describeError } from "@/lib/client/api";
import { useApi } from "@/lib/client/use-api";

interface Account {
  user: { email: string; displayName: string; lastLoginAt: string | null };
  recoveryCodesLeft: number;
  mailConfigured: boolean;
  publicOrigin: string;
  leaseDays: number;
  inviteHours: number;
  resetMinutes: number;
}

export function SettingsView() {
  const toast = useToast();
  const { data, loading } = useApi<Account>("/api/admin/account");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (next !== again) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/account", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      toast.success("Password changed", "Other browser sessions were signed out.");
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Your admin account and how this server is configured." />
      <div className="fade-up grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Admin account" />
          <CardBody>
            {loading || !data ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[14px]">
                <dt className="text-fg-muted">Name</dt>
                <dd>{data.user.displayName}</dd>
                <dt className="text-fg-muted">Email</dt>
                <dd>{data.user.email}</dd>
                <dt className="text-fg-muted">Two-step</dt>
                <dd>
                  <Badge tone="success" dot>
                    <ShieldCheck className="size-3" aria-hidden /> Authenticator enrolled
                  </Badge>
                </dd>
                <dt className="text-fg-muted">Recovery codes</dt>
                <dd className={data.recoveryCodesLeft <= 2 ? "text-warning" : ""}>
                  {data.recoveryCodesLeft} left{data.recoveryCodesLeft <= 2 ? " · re-run the bootstrap CLI to re-enrol if you run out" : ""}
                </dd>
              </dl>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Change password" description="Signs out your other browser sessions." />
          <CardBody>
            <form onSubmit={changePassword} className="flex flex-col gap-4" noValidate>
              <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
              <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} hint="At least 12 characters." required />
              <Input label="Repeat new password" type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} required />
              {error ? (
                <p role="alert" className="rounded-row bg-danger-muted px-3 py-2 text-[13px] font-semibold text-danger">
                  {error}
                </p>
              ) : null}
              <div>
                <Button type="submit" loading={busy} disabled={!current || !next || !again}>
                  <KeyRound className="size-4" aria-hidden /> Update password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Server" description="Read from the environment; change it in .env on the VPS and restart." />
          <CardBody>
            {!data ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Fact icon={Globe} label="Public origin" value={data.publicOrigin} />
                <Fact icon={Mail} label="Outbound email" value={data.mailConfigured ? "Configured: invitations are emailed" : "Not configured: members cannot be invited until SMTP is set"} tone={data.mailConfigured ? "success" : "warning"} />
                <Fact icon={Timer} label="Offline lease" value={`${data.leaseDays} days`} />
                <Fact icon={KeyRound} label="Link lifetimes" value={`Invitations ${data.inviteHours} h · resets ${data.resetMinutes} min`} />
              </div>
            )}
            <p className="mt-5 text-[13px] text-fg-muted">
              Members never reach this dashboard. Admin accounts are created only with <code className="font-mono">npm run bootstrap-admin</code> on the server; no API can promote a member.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Fact({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof Globe; label: string; value: string; tone?: "neutral" | "success" | "warning" }) {
  const cls = { neutral: "bg-surface-raised text-fg-muted", success: "bg-success-muted text-success", warning: "bg-warning-muted text-warning" }[tone];
  return (
    <div className="flex items-start gap-3 rounded-tile border border-border p-4">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${cls}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="mt-1 break-words text-[14px]">{value}</p>
      </div>
    </div>
  );
}

"use client";

import { Activity, KeyRound, Smartphone, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/admin/shell";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat";
import { useApi } from "@/lib/client/use-api";
import type { Stats } from "@/lib/members";
import { formatRelative } from "@/lib/utils";

export function Overview() {
  const { data, loading, error } = useApi<Stats>("/api/admin/stats");
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      <PageHeader
        eyebrow={greeting}
        title="Overview"
        description="Who can sign in, who is signed in, and what needs your attention."
        action={
          <Button>
            <Link href="/members/new" className="inline-flex items-center gap-2">
              <UserPlus className="size-4" aria-hidden /> New member
            </Link>
          </Button>
        }
      />
      {error ? (
        <p role="alert" className="mb-6 rounded-tile border border-danger/40 bg-danger-muted px-4 py-3 text-[14px] text-danger">
          {error}
        </p>
      ) : null}
      <section aria-label="Key numbers" className="fade-up grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Members" value={data?.total ?? null} icon={Users} loading={loading} hint="Accounts you created" />
        <StatTile label="Active" value={data?.active ?? null} icon={UserCheck} tone="success" loading={loading} hint="Can sign in to the app" />
        <StatTile label="Invited" value={data?.invited ?? null} icon={UserPlus} tone="warning" loading={loading} hint="Password not set yet" />
        <StatTile label="Disabled" value={data?.disabled ?? null} icon={UserX} tone="danger" loading={loading} hint="Blocked from signing in" />
      </section>
      <section className="fade-up mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Signed-in devices" value={data?.activeSessions ?? null} icon={Smartphone} tone="accent" loading={loading} hint="Live refresh sessions" />
        <StatTile label="Logins · 7 days" value={data?.loginsLast7Days ?? null} icon={Activity} loading={loading} />
        <StatTile label="Reset requests" value={data?.openResetRequests ?? null} icon={KeyRound} tone={data && data.openResetRequests > 0 ? "warning" : "neutral"} loading={loading} hint={data && data.openResetRequests > 0 ? "Waiting for you in Security" : "Nothing pending"} />
      </section>

      <div className="fade-up mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Recently created" description="Newest members first." action={<Link href="/members" className="text-[13px] font-semibold text-accent hover:underline">All members</Link>} />
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data || data.recent.length === 0 ? (
            <EmptyState icon={Users} title="No members yet" body="Create the first account; you will get a one-time link to share." action={<Link href="/members/new" className="text-[14px] font-semibold text-accent hover:underline">Create a member</Link>} />
          ) : (
            <ul className="divide-y divide-border">
              {data.recent.map((member) => (
                <li key={member.id}>
                  <Link href={`/members/${member.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-raised/60">
                    <Avatar name={member.displayName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{member.displayName}</p>
                      <p className="truncate text-[13px] text-fg-muted">{member.email}</p>
                    </div>
                    <div className="hidden text-right text-[12px] text-fg-muted sm:block">
                      <p>Last login</p>
                      <p className="text-fg">{formatRelative(member.lastLoginAt)}</p>
                    </div>
                    <StatusBadge status={member.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="How it works" />
          <CardBody>
            <ol className="space-y-3 text-[13px] text-fg-muted">
              <li className="flex gap-3">
                <span className="display mt-0.5 text-[18px] text-accent">1</span>
                <span>Create a member with their email. You get a one-time invitation link (72 h).</span>
              </li>
              <li className="flex gap-3">
                <span className="display mt-0.5 text-[18px] text-accent">2</span>
                <span>They open it, choose a password and sign in to the app. You never see the password.</span>
              </li>
              <li className="flex gap-3">
                <span className="display mt-0.5 text-[18px] text-accent">3</span>
                <span>Disable, reset or revoke from the member page. Changes reach a phone the next time it is online; offline access lasts at most 7 days.</span>
              </li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

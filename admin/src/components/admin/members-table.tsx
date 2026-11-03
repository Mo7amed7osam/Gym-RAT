"use client";

import { ChevronLeft, ChevronRight, Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/admin/shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { useApi } from "@/lib/client/use-api";
import type { MemberSummary } from "@/lib/api-types";
import { cn, formatDateTime, formatRelative } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "invited", label: "Invited" },
  { id: "disabled", label: "Disabled" },
] as const;

interface Page {
  items: MemberSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export function MembersTable() {
  const router = useRouter();
  const search = useSearchParams();
  const q = search.get("q") ?? "";
  const status = search.get("status") ?? "all";
  const page = Number(search.get("page") ?? 1);
  const [draft, setDraft] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (syncedQ !== q) {
    // The URL changed (back button, filter chip): adopt it during render, the React-sanctioned way.
    setSyncedQ(q);
    setDraft(q);
  }

  const query = new URLSearchParams({ q, status, page: String(page), pageSize: "25" });
  const { data, loading, error } = useApi<Page>(`/api/admin/members?${query.toString()}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const navigate = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ q, status, page: "1", ...patch });
    if (next.get("q") === "") next.delete("q");
    if (next.get("status") === "all") next.delete("status");
    if (next.get("page") === "1") next.delete("page");
    router.replace(`/members${next.toString() ? `?${next}` : ""}`);
  };

  return (
    <>
      <PageHeader
        title="Members"
        description="Everyone who can sign in to the Gym RAT app."
        action={
          <Button>
            <Link href="/members/new" className="inline-flex items-center gap-2">
              <UserPlus className="size-4" aria-hidden /> New member
            </Link>
          </Button>
        }
      />
      <Card className="fade-up">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <form
            role="search"
            className="flex flex-1 items-center gap-2 rounded-full border border-border bg-surface-raised px-3 focus-within:border-accent sm:max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ q: draft.trim() });
            }}
          >
            <Search className="size-4 text-fg-muted" aria-hidden />
            <input aria-label="Search members by name or email" placeholder="Search name or email" value={draft} onChange={(event) => setDraft(event.target.value)} className="h-10 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-faint" />
          </form>
          <div role="radiogroup" aria-label="Filter by status" className="flex gap-1 rounded-full bg-surface-raised p-1">
            {FILTERS.map((filter) => (
              <button key={filter.id} type="button" role="radio" aria-checked={status === filter.id} onClick={() => navigate({ status: filter.id })} className={cn("h-8 rounded-full px-3 text-[13px] font-semibold transition-colors", status === filter.id ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg")}>
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <p role="alert" className="px-5 py-4 text-[14px] text-danger">
            {error}
          </p>
        ) : loading && !data ? (
          <TableSkeleton rows={6} cols={4} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Users} title={q || status !== "all" ? "No matches" : "No members yet"} body={q || status !== "all" ? "Try another name, email or status." : "Create the first account to get an invitation link."} action={q || status !== "all" ? <Button variant="secondary" onClick={() => navigate({ q: "", status: "all" })}>Clear filters</Button> : <Button><Link href="/members/new">Create a member</Link></Button>} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Member</TH>
                <TH>Status</TH>
                <TH className="hidden md:table-cell">Devices</TH>
                <TH className="hidden sm:table-cell">Last login</TH>
                <TH className="hidden lg:table-cell">Created</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.map((member) => (
                <TR key={member.id} className="cursor-pointer" onClick={() => router.push(`/members/${member.id}`)}>
                  <TD>
                    <Link href={`/members/${member.id}`} className="flex items-center gap-3 outline-none" onClick={(event) => event.stopPropagation()}>
                      <Avatar name={member.displayName} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{member.displayName}</span>
                        <span className="block truncate text-[13px] text-fg-muted">{member.email}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={member.status} />
                      {member.invitation?.emailStatus === "failed" ? (
                        <Badge tone="danger" title={member.invitation.emailError ?? undefined}>
                          Invite email failed
                        </Badge>
                      ) : member.invitation?.expired ? (
                        <Badge tone="warning">Invite expired</Badge>
                      ) : null}
                    </span>
                  </TD>
                  <TD className="tnum hidden md:table-cell">{member.activeSessions}</TD>
                  <TD className="hidden text-fg-muted sm:table-cell" title={formatDateTime(member.lastLoginAt)}>
                    {formatRelative(member.lastLoginAt)}
                  </TD>
                  <TD className="hidden text-fg-muted lg:table-cell">{formatDateTime(member.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {data && data.total > data.pageSize ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[13px] text-fg-muted">
            <span className="tnum">
              {(data.page - 1) * data.pageSize + 1}–{Math.min(data.total, data.page * data.pageSize)} of {data.total}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => navigate({ page: String(page - 1) })}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => navigate({ page: String(page + 1) })}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}

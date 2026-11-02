"use client";

import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { describeAction } from "@/components/admin/member-detail";
import { PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { useApi } from "@/lib/client/use-api";
import { cn, formatDateTime } from "@/lib/utils";

const FILTERS = [
  { id: "", label: "Everything" },
  { id: "member.login", label: "Logins" },
  { id: "admin.", label: "Admin" },
  { id: "link.", label: "Links" },
  { id: "member.refresh.reuse", label: "Reuse alerts" },
] as const;

interface AuditPage {
  items: { id: number; at: string; actorType: string; action: string; targetUserId: string | null; targetEmail: string | null; ip: string | null; success: boolean; metadata: Record<string, unknown> }[];
  total: number;
  page: number;
  pageSize: number;
}

export function AuditView() {
  const router = useRouter();
  const search = useSearchParams();
  const action = search.get("action") ?? "";
  const page = Number(search.get("page") ?? 1);
  const query = new URLSearchParams({ page: String(page), pageSize: "50", ...(action ? { action } : {}) });
  const { data, loading, error } = useApi<AuditPage>(`/api/admin/audit?${query}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const navigate = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ action, page: "1", ...patch });
    if (!next.get("action")) next.delete("action");
    if (next.get("page") === "1") next.delete("page");
    router.replace(`/audit${next.toString() ? `?${next}` : ""}`);
  };

  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in, link, admin action and refresh-token reuse alert. Secrets are never recorded." />
      <Card className="fade-up">
        <div role="radiogroup" aria-label="Filter" className="flex flex-wrap gap-1 border-b border-border p-3">
          {FILTERS.map((filter) => (
            <button key={filter.id} type="button" role="radio" aria-checked={action === filter.id} onClick={() => navigate({ action: filter.id })} className={cn("h-8 rounded-full px-3 text-[13px] font-semibold transition-colors", action === filter.id ? "bg-accent-muted text-accent" : "text-fg-muted hover:bg-surface-raised hover:text-fg")}>
              {filter.label}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="px-5 py-4 text-danger">
            {error}
          </p>
        ) : loading && !data ? (
          <TableSkeleton rows={8} cols={4} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nothing recorded" body="Events appear as members and admins act." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Event</TH>
                <TH className="hidden md:table-cell">Who</TH>
                <TH className="hidden lg:table-cell">From</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.map((event) => (
                <TR key={event.id}>
                  <TD className="tnum whitespace-nowrap text-fg-muted">{formatDateTime(event.at)}</TD>
                  <TD>
                    <span className="flex items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${event.success ? "bg-success" : "bg-danger"}`} aria-hidden />
                      <span className="font-medium">{describeAction(event.action)}</span>
                    </span>
                    <span className="block font-mono text-[11px] text-fg-faint">{event.action}</span>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <Badge tone={event.actorType === "admin" ? "accent" : event.actorType === "member" ? "info" : "neutral"}>{event.actorType}</Badge>
                    {event.targetEmail ? (
                      <Link href={`/members/${event.targetUserId}`} className="ml-2 text-[13px] text-fg-muted hover:underline">
                        {event.targetEmail}
                      </Link>
                    ) : typeof event.metadata.email === "string" ? (
                      <span className="ml-2 text-[13px] text-fg-muted">{event.metadata.email}</span>
                    ) : null}
                  </TD>
                  <TD className="hidden font-mono text-[12px] text-fg-muted lg:table-cell">{event.ip ?? "—"}</TD>
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

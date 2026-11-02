import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

export function StatTile({ label, value, icon: Icon, hint, tone = "neutral", loading = false }: { label: string; value: number | string | null; icon: LucideIcon; hint?: string; tone?: "neutral" | "accent" | "success" | "danger" | "warning"; loading?: boolean }) {
  const toneClass = { neutral: "text-fg-muted bg-surface-raised", accent: "text-accent bg-accent-muted", success: "text-success bg-success-muted", danger: "text-danger bg-danger-muted", warning: "text-warning bg-warning-muted" }[tone];
  return (
    <div className="card flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        {loading || value === null ? <Skeleton className="mt-3 h-9 w-20" /> : <p className="display tnum mt-2 text-[40px] leading-none">{value}</p>}
        {hint ? <p className="mt-2 text-[12px] text-fg-muted">{hint}</p> : null}
      </div>
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", toneClass)}>
        <Icon className="size-5" aria-hidden />
      </div>
    </div>
  );
}

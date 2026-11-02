import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold leading-5", {
  variants: {
    tone: {
      neutral: "bg-surface-raised text-fg-muted",
      success: "bg-success-muted text-success",
      warning: "bg-warning-muted text-warning",
      danger: "bg-danger-muted text-danger",
      info: "bg-info-muted text-info",
      accent: "bg-accent-muted text-accent",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

const STATUS: Record<string, { label: string; tone: NonNullable<BadgeProps["tone"]> }> = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invited", tone: "warning" },
  disabled: { label: "Disabled", tone: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Badge tone={entry.tone} dot>
      {entry.label}
    </Badge>
  );
}

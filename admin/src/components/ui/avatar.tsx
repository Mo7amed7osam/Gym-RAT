import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn("display inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[14px] text-accent", className)}>
      {initials(name) || "?"}
    </span>
  );
}

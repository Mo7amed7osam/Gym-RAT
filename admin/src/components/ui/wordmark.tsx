import { cn } from "@/lib/utils";

export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-[22px]", md: "text-[32px]", lg: "text-[64px]" }[size];
  return (
    <span className={cn("display inline-flex items-baseline gap-1 font-extrabold tracking-[0.02em]", sizes, className)} aria-label="Gym RAT">
      <span>GYM</span>
      <span className="text-accent">RAT</span>
    </span>
  );
}

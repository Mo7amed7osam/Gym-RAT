import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,opacity,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:brightness-110",
        tinted: "bg-accent-muted text-accent hover:bg-accent/25",
        secondary: "bg-surface-raised text-fg hover:bg-surface-high",
        ghost: "text-fg-muted hover:bg-surface-raised hover:text-fg",
        destructive: "bg-danger-muted text-danger hover:bg-danger/25",
        danger: "bg-danger text-white hover:brightness-110",
        outline: "border border-border-strong text-fg hover:bg-surface-raised",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-[14px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, loading = false, disabled, children, type = "button", ...props }, ref) {
  return (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export { buttonVariants };

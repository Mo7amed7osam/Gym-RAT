import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, label, hint, error, trailing, id, ...props }, ref) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="eyebrow">
          {label}
        </label>
      ) : null}
      <div className={cn("flex items-center rounded-tile border bg-surface-raised transition-colors focus-within:border-accent", error ? "border-danger" : "border-border")}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn("h-12 w-full flex-1 bg-transparent px-4 text-[15px] text-fg outline-none placeholder:text-fg-faint disabled:opacity-60", className)}
          {...props}
        />
        {trailing ? <div className="pr-2">{trailing}</div> : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[13px] text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

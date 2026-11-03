"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
}

const ToastContext = createContext<{ push: (tone: Tone, title: string, body?: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const counter = useRef(0);
  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const push = useCallback(
    (tone: Tone, title: string, body?: string) => {
      const id = (counter.current += 1);
      setItems((current) => [...current.slice(-3), { id, tone, title, body }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} role="status" className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-tile border border-border bg-bg-elevated px-4 py-3 shadow-card fade-up")}>
            {item.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : item.tone === "error" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{item.title}</p>
              {item.body ? <p className="mt-0.5 text-[13px] text-fg-muted break-words">{item.body}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss" className="rounded-full p-1 text-fg-muted hover:bg-surface-raised hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast outside ToastProvider");
  return {
    success: (title: string, body?: string) => context.push("success", title, body),
    error: (title: string, body?: string) => context.push("error", title, body),
    info: (title: string, body?: string) => context.push("info", title, body),
  };
}

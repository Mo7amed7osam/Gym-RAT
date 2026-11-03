"use client";

import { Activity, LogOut, Menu, Moon, ScrollText, Settings, Shield, Sun, SunMoon, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/members", label: "Members", icon: Users },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type Theme = "dark" | "black" | "light";
const THEMES: { id: Theme; label: string; icon: typeof Moon }[] = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "black", label: "True black", icon: SunMoon },
  { id: "light", label: "Light", icon: Sun },
];

interface Who {
  authenticated: boolean;
  user?: { email: string; displayName: string };
  mfaVerified?: boolean;
}

/** Sidebar + top bar. Verifies the session on mount and whenever the route changes; bounces to /login when it is gone. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [who, setWho] = useState<Who | null>(null);
  const [open, setOpen] = useState(false);
  const [openFor, setOpenFor] = useState(pathname);
  if (openFor !== pathname) {
    // Route changed: close the mobile menu during render (no effect, no extra pass).
    setOpenFor(pathname);
    setOpen(false);
  }
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);

  useEffect(() => {
    let cancelled = false;
    api<Who>("/api/admin/session")
      .then((result) => {
        if (cancelled) return;
        if (!result.mfaVerified) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        else setWho(result);
      })
      .catch(() => router.replace(`/login?next=${encodeURIComponent(pathname)}`));
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const applyTheme = (next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("gymrat-theme", next);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    window.dispatchEvent(new Event("gymrat-theme"));
  };

  const signOut = async () => {
    await api("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
    router.replace("/login");
  };

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-10 items-center gap-3 rounded-row px-3 text-[14px] font-medium transition-colors", active ? "bg-accent-muted text-accent" : "text-fg-muted hover:bg-surface-raised hover:text-fg")}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border bg-bg-elevated px-4 py-6 lg:flex">
        <Link href="/" className="px-2">
          <Wordmark size="sm" />
          <span className="mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-fg-faint">Admin</span>
        </Link>
        <div className="mt-8 flex-1">{nav}</div>
        <div className="flex flex-col gap-3">
          <ThemeSwitch theme={theme} onChange={applyTheme} />
          {who?.user ? (
            <div className="flex items-center gap-3 rounded-tile border border-border bg-surface p-3">
              <Avatar name={who.user.displayName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{who.user.displayName}</p>
                <p className="truncate text-[12px] text-fg-muted">{who.user.email}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signOut()}>
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="skeleton h-16" />
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <Wordmark size="sm" />
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signOut()}>
            <LogOut className="size-4" />
          </Button>
        </header>
        {open ? (
          <div className="border-b border-border bg-bg-elevated p-4 lg:hidden">
            {nav}
            <div className="mt-4">
              <ThemeSwitch theme={theme} onChange={applyTheme} />
            </div>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem("gymrat-theme");
    return stored === "light" || stored === "black" || stored === "dark" ? stored : "dark";
  } catch {
    return "dark";
  }
}

function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener("gymrat-theme", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("gymrat-theme", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function ThemeSwitch({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-tile bg-surface-raised p-1">
      {THEMES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={theme === item.id}
          aria-label={item.label}
          title={item.label}
          onClick={() => onChange(item.id)}
          className={cn("flex h-8 items-center justify-center rounded-row transition-colors", theme === item.id ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
        >
          <item.icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="fade-up mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="display text-[36px] sm:text-[44px]">{title}</h1>
        {description ? <p className="mt-1 max-w-xl text-[14px] text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

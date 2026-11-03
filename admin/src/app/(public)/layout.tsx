import { Wordmark } from "@/components/ui/wordmark";

/** Centered single-card layout for sign-in and the one-time link pages. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="glow relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="fade-up flex w-full max-w-[420px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="eyebrow">Members only</p>
          <Wordmark size="lg" />
          <span aria-hidden className="mt-1 h-1 w-14 rounded-full bg-accent" />
        </div>
        {children}
      </div>
      <p className="mt-10 text-center text-[12px] text-fg-faint">Accounts are created by the administrator. Workouts never leave the member&apos;s iPhone.</p>
    </main>
  );
}

import { Wordmark } from "@/components/ui/wordmark";

/** The API host serves only the member link pages; the dashboard lives in the separate admin app (ADR-018). */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Wordmark />
      <h1 className="display text-[32px]">Nothing here</h1>
      <p className="text-fg-muted">That page does not exist.</p>
    </main>
  );
}

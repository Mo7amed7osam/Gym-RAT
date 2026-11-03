import Link from "next/link";

import { Wordmark } from "@/components/ui/wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Wordmark />
      <h1 className="display text-[32px]">Nothing here</h1>
      <p className="text-fg-muted">That page does not exist.</p>
      <Link href="/" className="font-semibold text-accent hover:underline">
        Back to the dashboard
      </Link>
    </main>
  );
}

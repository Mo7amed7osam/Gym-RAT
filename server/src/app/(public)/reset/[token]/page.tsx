import type { Metadata } from "next";

import { SetPassword } from "@/components/public/set-password";

export const metadata: Metadata = { title: "Reset your password" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SetPassword token={token} />;
}

import type { Metadata } from "next";

import { SetPassword } from "@/components/public/set-password";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Admin setup" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SetPassword token={token} dashboardLoginUrl={`${env().ADMIN_ORIGIN}/login`} />;
}

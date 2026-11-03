import type { Metadata } from "next";

import { SecurityView } from "@/components/admin/security";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return <SecurityView />;
}

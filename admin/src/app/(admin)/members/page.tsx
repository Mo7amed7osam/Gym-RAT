import type { Metadata } from "next";
import { Suspense } from "react";

import { MembersTable } from "@/components/admin/members-table";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <Suspense>
      <MembersTable />
    </Suspense>
  );
}

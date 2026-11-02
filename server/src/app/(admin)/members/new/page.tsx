import type { Metadata } from "next";

import { NewMember } from "@/components/admin/new-member";

export const metadata: Metadata = { title: "New member" };

export default function NewMemberPage() {
  return <NewMember />;
}

import type { Metadata } from "next";

import { MemberDetailView } from "@/components/admin/member-detail";

export const metadata: Metadata = { title: "Member" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberDetailView id={id} />;
}

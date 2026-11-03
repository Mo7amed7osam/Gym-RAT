import type { Metadata } from "next";

import { SettingsView } from "@/components/admin/settings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsView />;
}

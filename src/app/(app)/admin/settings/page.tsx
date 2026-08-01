import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsView } from "@/components/admin/settings-view";
import { getSession } from "@/lib/auth";
import { getBoolFlags, FLAG_BONUS_MODAL, FLAG_SHANGHAI_MODAL } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const flags = await getBoolFlags([FLAG_BONUS_MODAL, FLAG_SHANGHAI_MODAL]);

  return (
    <>
      <PageHeader title="Settings" subtitle="Toggle celebration pop-ups · preview without the ?param hack" />
      <SettingsView initial={flags} />
    </>
  );
}

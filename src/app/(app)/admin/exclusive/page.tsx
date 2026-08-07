import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ExclusiveView } from "@/components/admin/exclusive-view";
import { getSession } from "@/lib/auth";
import { getExclusiveStats, searchExclusiveUsers } from "@/lib/exclusive";

export const dynamic = "force-dynamic";

export default async function ExclusiveNetworkPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const [stats, rows] = await Promise.all([getExclusiveStats(), searchExclusiveUsers()]);

  return (
    <>
      <PageHeader
        title="Exclusive Network 🏆"
        subtitle="Activate NETWORK_ONLY members — no daily %, full network earnings, company save"
      />
      <ExclusiveView initialRows={rows} stats={stats} />
    </>
  );
}

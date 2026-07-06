import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { QxTiersView } from "@/components/tiers/qx-tiers-view";
import { getSession } from "@/lib/auth";
import { getClientPerformance } from "@/lib/data";
import { tierForBalance } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export default async function QxTiersPage() {
  const session = getSession();
  if (!session) redirect("/login");
  // Tiers are a client funding feature; admins manage money via Ledger/Approvals.
  if (session.role === "admin") redirect("/dashboard");

  let currentTier = null;
  if (session.clientId) {
    const perf = await getClientPerformance(session.clientId);
    currentTier = tierForBalance(perf?.kpis.currentBalance ?? 0)?.id ?? null;
  }

  return (
    <>
      <PageHeader
        title="QX Tiers"
        subtitle="Choose a funding package to unlock your QuantumX trading tier."
      />
      <QxTiersView currentTier={currentTier} />
    </>
  );
}

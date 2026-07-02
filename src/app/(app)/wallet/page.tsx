import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { WalletView } from "@/components/wallet/wallet-view";
import { getSession } from "@/lib/auth";
import { getClientPerformance } from "@/lib/data";
import { getDepositWallets, BANK_ENABLED } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = getSession();
  if (!session) redirect("/login");
  // Admins manage money via the Ledger / Approvals; the wallet is client-facing.
  if (session.role === "admin") redirect("/ledger");
  if (!session.clientId) {
    return (
      <>
        <PageHeader title="Deposit / Withdraw" />
        <p className="text-sm text-muted-foreground">
          No trading account is linked to your profile yet.
        </p>
      </>
    );
  }

  const perf = await getClientPerformance(session.clientId);
  const currentBalance = perf?.kpis.currentBalance ?? 0;

  return (
    <>
      <PageHeader
        title="Deposit / Withdraw"
        subtitle="Fund your account with USDT — approved deposits update your balance."
      />
      <WalletView
        currentBalance={currentBalance}
        wallets={getDepositWallets()}
        bankEnabled={BANK_ENABLED}
      />
    </>
  );
}

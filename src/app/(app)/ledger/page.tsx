import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { LedgerView } from "@/components/ledger/ledger-view";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const session = getSession();
  // Clients manage their funds via /wallet; the full ledger is admin-only.
  if (session?.role !== "admin") redirect("/wallet");
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, accountNumber: true },
  });

  return (
    <>
      <PageHeader
        title="Deposit / Withdrawal Ledger"
        subtitle="Approved entries automatically update client balances. CSV import & export supported."
      />
      <LedgerView clients={clients} isAdmin={session?.role === "admin"} />
    </>
  );
}

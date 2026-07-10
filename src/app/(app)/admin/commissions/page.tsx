import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/auth";
import {
  resolveUsers, getDirectCommissions, getIndirectCommissions, getMonthlyBonuses,
  type DirectRow, type IndirectRow, type BonusRow,
} from "@/lib/admin-referrals";
import { CommissionsTabs } from "@/components/admin/commissions-tabs";

export const dynamic = "force-dynamic";

export default async function AdminCommissionsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  let direct: DirectRow[] = [], indirect: IndirectRow[] = [], bonus: BonusRow[] = [];
  try {
    const users = await resolveUsers();
    [direct, indirect, bonus] = await Promise.all([
      getDirectCommissions(users),
      getIndirectCommissions(users),
      getMonthlyBonuses(users),
    ]);
  } catch (err) {
    console.error("[admin/commissions] error:", err);
  }

  return (
    <>
      <PageHeader
        title="Commissions"
        subtitle="Multi-level compensation — direct (1st), indirect (2nd), and monthly bonus payouts."
      />
      <CommissionsTabs direct={direct} indirect={indirect} bonus={bonus} />
    </>
  );
}

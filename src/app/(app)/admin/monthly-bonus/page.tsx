import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/auth";
import { resolveUsers, getMonthlyBonuses, getBonusMonths, type BonusRow } from "@/lib/admin-referrals";
import { MonthlyBonusLog } from "@/components/admin/monthly-bonus-log";

export const dynamic = "force-dynamic";

export default async function AdminMonthlyBonusPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const selected = searchParams.month ?? "";
  let rows: BonusRow[] = [], months: string[] = [];
  try {
    const users = await resolveUsers();
    [rows, months] = await Promise.all([
      getMonthlyBonuses(users, selected || undefined),
      getBonusMonths(),
    ]);
  } catch (err) {
    console.error("[admin/monthly-bonus] error:", err);
  }

  return (
    <>
      <PageHeader
        title="Monthly Bonus Log"
        subtitle="5% of qualifying directs' previous-month Daily P/L, paid to Available Withdrawal."
      />
      <MonthlyBonusLog rows={rows} months={months} selected={selected} />
    </>
  );
}

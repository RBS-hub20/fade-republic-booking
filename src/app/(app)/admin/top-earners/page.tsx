import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TopEarnersView } from "@/components/admin/top-earners-view";
import { getSession } from "@/lib/auth";
import { getTopEarners } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/** Manila (UTC+8) month key for a date, e.g. "2026-08". */
function manilaMonthKey(d: Date): string {
  const m = new Date(d.getTime() + 8 * 3600 * 1000);
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
/** The current month and the 11 before it, newest first. */
function recentMonths(count = 12): string[] {
  const [cy, cm] = manilaMonthKey(new Date()).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(cy, cm - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default async function TopEarnersPage({ searchParams }: { searchParams: { month?: string } }) {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const months = recentMonths();
  const month = searchParams.month && months.includes(searchParams.month) ? searchParams.month : months[0];
  const rows = await getTopEarners(month, 20);

  return (
    <>
      <PageHeader title="Top Earners 💰" subtitle="Grand-total earnings per member · by month" />
      <TopEarnersView
        rows={rows}
        month={month}
        monthLabel={monthLabel(month)}
        monthOptions={months.map((m) => ({ value: m, label: monthLabel(m) }))}
      />
    </>
  );
}

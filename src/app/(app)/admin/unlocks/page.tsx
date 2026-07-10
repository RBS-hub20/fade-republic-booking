import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/auth";
import { resolveUsers, getUnlockView, type UnlockRow } from "@/lib/admin-referrals";
import { UnlocksTable } from "@/components/admin/unlocks-table";

export const dynamic = "force-dynamic";

export default async function AdminUnlocksPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  let rows: UnlockRow[] = [];
  try {
    const users = await resolveUsers();
    rows = await getUnlockView(users);
  } catch (err) {
    console.error("[admin/unlocks] error:", err);
  }

  const unlocked = rows.filter((r) => r.unlocked).length;

  return (
    <>
      <PageHeader
        title="2nd-Level Unlocks"
        subtitle={`${unlocked} unlocked · ${rows.length} referrers. Target users close to 3 active directs.`}
      />
      <UnlocksTable rows={rows} />
    </>
  );
}

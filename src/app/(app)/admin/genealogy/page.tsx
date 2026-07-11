import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/auth";
import { getRootDirectCount } from "@/lib/genealogy-tree";
import { GenealogyTree } from "@/components/admin/genealogy-tree";

export const dynamic = "force-dynamic";

export default async function AdminGenealogyPage() {
  const session = getSession();
  if (!session) redirect("/login");
  // Admin-only — anyone else gets a 404-style bounce.
  if (session.role !== "admin") redirect("/dashboard");

  const rootDirectCount = await getRootDirectCount().catch(() => 0);

  return (
    <>
      <PageHeader
        title="Genealogy Network"
        subtitle="Company downline tree · click to expand, hover for stats, toggle heatmap for P&L."
      />
      <GenealogyTree myUserId={session.userId ?? null} rootDirectCount={rootDirectCount} />
    </>
  );
}

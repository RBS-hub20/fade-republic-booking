import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/auth";
import { GenealogyExplorer } from "@/components/admin/genealogy-explorer";

export const dynamic = "force-dynamic";

export default function AdminGenealogyPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Genealogy / Lineage"
        subtitle="Trace any member's upline to the root sponsor and explore their full downline network."
      />
      <GenealogyExplorer />
    </>
  );
}

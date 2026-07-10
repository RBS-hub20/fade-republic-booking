import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth";
import { resolveUsers, getReferralTree, type TreeNode } from "@/lib/admin-referrals";
import { formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReferralTreePage({
  searchParams,
}: {
  searchParams: { user_id?: string };
}) {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const userId = searchParams.user_id;
  if (!userId) {
    return (
      <>
        <PageHeader title="Referral Tree" subtitle="Open from the Unlocks or Commissions view." />
        <p className="text-sm text-muted-foreground">
          No user selected. Add <code className="rounded bg-secondary px-1 py-0.5">?user_id=…</code> or open a tree from the 2nd-Level Unlocks page.
        </p>
      </>
    );
  }

  const users = await resolveUsers();
  const tree = await getReferralTree(userId, users);

  if (!tree.root) {
    return (
      <>
        <PageHeader title="Referral Tree" />
        <p className="text-sm text-muted-foreground">User not found.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Referral Tree"
        subtitle="Two-level downline · direct referrals and their indirects."
      >
        {tree.unlocked ? (
          <Badge variant="success">✅ 2nd Level Unlocked · {tree.activeDirects} active directs</Badge>
        ) : (
          <Badge variant="outline">🔒 2nd Level Locked · {tree.activeDirects}/3</Badge>
        )}
      </PageHeader>

      {/* Root */}
      <div className="mb-4">
        <NodeCard node={tree.root} accent />
      </div>

      {tree.directs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No direct referrals yet.</p>
      ) : (
        <div className="space-y-4">
          {tree.directs.map(({ node, indirects }) => (
            <div key={node.userId} className="rounded-xl border border-border bg-card/40 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                {/* Direct */}
                <div className="lg:w-72 lg:shrink-0">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Direct (L1)</p>
                  <NodeCard node={node} />
                </div>
                {/* Indirects */}
                <div className="flex-1">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Indirect (L2) · {indirects.length}
                  </p>
                  {indirects.length === 0 ? (
                    <p className="py-3 text-xs text-muted-foreground">No indirect referrals.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {indirects.map((ind) => <NodeCard key={ind.userId} node={ind} />)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function NodeCard({ node, accent }: { node: TreeNode; accent?: boolean }) {
  return (
    <Card className={`p-3 ${accent ? "border-gold-400/50" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{node.name}</p>
        <Badge variant={node.tier === "None" ? "outline" : "gold"}>{node.tier}</Badge>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Active Capital</span>
        <span className="tnum font-medium text-gold-300">{formatUsd(node.activeCapital)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Status</span>
        <span className="capitalize">{node.status.toLowerCase()}</span>
      </div>
      {node.edgeLabel && (
        <p className="mt-2 rounded bg-profit/10 px-2 py-1 text-center text-xs font-medium text-profit">
          {node.edgeLabel}
        </p>
      )}
    </Card>
  );
}

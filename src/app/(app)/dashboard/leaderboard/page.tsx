import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNetworkSalesLeaderboard } from "@/lib/referrals";

export const dynamic = "force-dynamic";

// The Shanghai promo month.
const MONTH = "2026-08";
const MONTH_LABEL = "August 2026";

export default async function LeaderboardPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const [board, me] = await Promise.all([
    getNetworkSalesLeaderboard(MONTH, { limit: 20, meUserId: session.userId }),
    session.userId
      ? prisma.user.findUnique({ where: { id: session.userId }, select: { referralCode: true } }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="🏆 Shanghai Leaderboard" subtitle={`Top network sales · ${MONTH_LABEL} · Goal $5,000`}>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        </Button>
      </PageHeader>
      <LeaderboardView
        top={board.top}
        me={board.me}
        totalRanked={board.totalRanked}
        monthLabel={MONTH_LABEL}
        referralCode={me?.referralCode ?? null}
        origin={process.env.NEXT_PUBLIC_SITE_URL || "https://quantumxglobal.online"}
      />
    </>
  );
}

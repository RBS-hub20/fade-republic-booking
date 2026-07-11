import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { ensureUsernameSchemaOnce, normalizeUsername } from "@/lib/username";
import { getClientPerformance } from "@/lib/data";
import { tierForBalance } from "@/lib/tiers";
import { formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Public profile — no auth required. Shows non-financial signal only
 * (join date, tier, win rate, avg daily %, referral count). No dollar amounts.
 */
export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  const username = normalizeUsername(decodeURIComponent(params.username || ""));
  if (!username) notFound();

  await ensureUsernameSchemaOnce(prisma).catch(() => {});
  const user = await prisma.user
    .findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, createdAt: true, clientId: true },
    })
    .catch(() => null);
  if (!user || !user.username) notFound();

  const [perf, referralCount] = await Promise.all([
    user.clientId ? getClientPerformance(user.clientId).catch(() => null) : Promise.resolve(null),
    prisma.user.count({ where: { referredById: user.id } }).catch(() => 0),
  ]);

  const tier = tierForBalance(perf?.kpis.currentBalance ?? 0);
  const joined = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(user.createdAt);
  const winRate = perf?.kpis.winRate ?? 0;
  const avgDaily = perf?.kpis.avgDailyPercent ?? 0;
  const tradingDays = perf?.kpis.tradingDays ?? 0;

  return (
    <main className="terminal-bg flex min-h-screen flex-col items-center px-4 py-12">
      <Link href="/" className="mb-8">
        <Logo size="md" subtitle />
      </Link>

      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-400/15 text-2xl font-bold text-gold-300">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="mt-4 text-2xl font-bold">@{user.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Joined {joined}
            {tier ? ` · ${tier.name} tier` : ""}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
            <Stat label="Win rate" value={formatPct(winRate, 1)} />
            <Stat label="Avg daily" value={formatPct(avgDaily)} />
            <Stat label="Referrals" value={String(referralCount)} />
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {tradingDays > 0 ? `${tradingDays} trading days on QuantumX` : "New to QuantumX"}
          </p>

          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-1 rounded-md bg-gold-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gold-300"
          >
            Join QuantumX
          </Link>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">
        Performance shown is indicative. Trading involves risk; individual results vary.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-2 py-4">
      <p className="tnum text-lg font-bold text-gold-300">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

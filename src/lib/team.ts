/**
 * Team Transparency — a member's OWN direct downline (privacy: only the people
 * they personally referred, never the whole platform). Shows who signed up,
 * when, who bought a package, and who's still pending, so uplines can follow up.
 *
 * Emails are never returned — only @username + a masked display name (e.g.
 * "Juan D.") — for member privacy.
 */
import { prisma } from "./prisma";
import { ensureReferralSchemaOnce } from "./referral-schema";
import { tierForPackageAmount } from "./packages";
import { exclusivePackagePrice, getPayoutState } from "./payout-cap";
import { tierForBalance } from "./tiers";
import { avatarSrc } from "./avatar";

export type TeamMemberStatus = "PENDING_NO_PACKAGE" | `ACTIVE_${string}`;

export interface TeamMember {
  userId: string;
  username: string | null;
  displayName: string; // masked, e.g. "Juan D."
  avatar: string; // /avatars/*.svg
  signupDate: string; // ISO
  package: string | null; // "Bronze" | "Silver" | "Gold" | "Platinum" | null
  packageBoughtDate: string | null; // ISO
  status: TeamMemberStatus;
  bought: boolean;
  isExclusive: boolean;
  // Earnings cap progress (best-effort; 0 when not funded).
  earned: number;
  cap: number;
  capPct: number;
}

export interface TeamStats {
  total: number;
  bought: number;
  pending: number;
  conversionRate: number; // 0–100
}

export interface TeamPage {
  stats: TeamStats;
  members: TeamMember[];
  page: number;
  pageSize: number;
  totalPages: number;
  referralCode: string | null;
}

/** "Juan Dela Cruz" → "Juan D." · single word → unchanged. Uses the FIRST
 *  surname token's initial (Filipino names often have a two-word surname). */
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Member";
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

interface DirectRow {
  id: string;
  username: string | null;
  name: string;
  createdAt: Date;
  clientId: string | null;
  avatarType: string | null;
  activationType: string;
  exclusivePackage: string | null;
  exclusiveActivatedAt: Date | null;
}

interface PkgInfo {
  package: string | null;
  boughtDate: Date | null;
  bought: boolean;
}

/** Resolve package / bought-date / funded state for a set of directs. */
async function resolvePackages(rows: DirectRow[]): Promise<Map<string, PkgInfo>> {
  const clientIds = rows.map((r) => r.clientId).filter(Boolean) as string[];
  const deposits = clientIds.length
    ? await prisma.transaction
        .groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds }, type: "DEPOSIT", status: "APPROVED" },
          _sum: { amount: true },
          _min: { date: true },
        })
        .catch(() => [] as { clientId: string; _sum: { amount: number | null }; _min: { date: Date | null } }[])
    : [];
  const byClient = new Map(deposits.map((d) => [d.clientId, d]));

  const out = new Map<string, PkgInfo>();
  for (const r of rows) {
    const dep = r.clientId ? byClient.get(r.clientId) : undefined;
    const funded = (dep?._sum.amount ?? 0) > 0;
    if (funded) {
      const tier = tierForPackageAmount(dep!._sum.amount ?? 0);
      out.set(r.id, { package: tier?.name ?? "Package", boughtDate: dep?._min.date ?? null, bought: true });
    } else if (r.activationType === "NETWORK_ONLY" && r.exclusivePackage) {
      // Exclusive (admin-activated) member with no real deposit: use the package.
      const tier = tierForBalance(exclusivePackagePrice(r.exclusivePackage));
      out.set(r.id, { package: tier?.name ?? "Exclusive", boughtDate: r.exclusiveActivatedAt ?? null, bought: true });
    } else {
      out.set(r.id, { package: null, boughtDate: null, bought: false });
    }
  }
  return out;
}

/** Aggregate stats over a member's entire direct downline. */
export async function getTeamStats(userId: string): Promise<TeamStats> {
  await ensureReferralSchemaOnce(prisma).catch(() => {});
  const directs = await prisma.user.findMany({
    where: { referredById: userId },
    select: {
      id: true, username: true, name: true, createdAt: true, clientId: true,
      avatarType: true, activationType: true, exclusivePackage: true, exclusiveActivatedAt: true,
    },
  });
  const pkgs = await resolvePackages(directs);
  const total = directs.length;
  const bought = directs.filter((d) => pkgs.get(d.id)?.bought).length;
  const pending = total - bought;
  return {
    total,
    bought,
    pending,
    conversionRate: total > 0 ? Math.round((bought / total) * 100) : 0,
  };
}

/**
 * Paginated team list for a member. Filter/search are applied over the FULL
 * downline; cap progress is computed only for the returned page (bounded cost).
 */
export async function getMyTeam(
  userId: string,
  opts: { page?: number; pageSize?: number; filter?: "all" | "bought" | "pending"; q?: string } = {}
): Promise<TeamPage> {
  await ensureReferralSchemaOnce(prisma).catch(() => {});
  const pageSize = opts.pageSize ?? 20;
  const page = Math.max(1, opts.page ?? 1);
  const filter = opts.filter ?? "all";
  const q = (opts.q ?? "").trim().toLowerCase();

  const [me, directs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } }).catch(() => null),
    prisma.user.findMany({
      where: { referredById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, username: true, name: true, createdAt: true, clientId: true,
        avatarType: true, activationType: true, exclusivePackage: true, exclusiveActivatedAt: true,
      },
    }),
  ]);

  const pkgs = await resolvePackages(directs);

  const total = directs.length;
  const boughtCount = directs.filter((d) => pkgs.get(d.id)?.bought).length;
  const stats: TeamStats = {
    total,
    bought: boughtCount,
    pending: total - boughtCount,
    conversionRate: total > 0 ? Math.round((boughtCount / total) * 100) : 0,
  };

  // Apply filter + search over the full set.
  let filtered = directs.filter((d) => {
    const p = pkgs.get(d.id);
    if (filter === "bought" && !p?.bought) return false;
    if (filter === "pending" && p?.bought) return false;
    if (q) {
      const hay = `${d.username ?? ""} ${d.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  // Cap progress only for the current page.
  const states = await Promise.all(
    pageRows.map((d) => (d.clientId ? getPayoutState(d.id, d.clientId).catch(() => null) : Promise.resolve(null)))
  );

  const members: TeamMember[] = pageRows.map((d, i) => {
    const p = pkgs.get(d.id)!;
    const st = states[i];
    return {
      userId: d.id,
      username: d.username ?? null,
      displayName: maskName(d.name),
      avatar: avatarSrc(d.avatarType),
      signupDate: d.createdAt.toISOString(),
      package: p.package,
      packageBoughtDate: p.boughtDate ? p.boughtDate.toISOString() : null,
      status: p.bought ? (`ACTIVE_${(p.package ?? "PACKAGE").toUpperCase()}` as TeamMemberStatus) : "PENDING_NO_PACKAGE",
      bought: p.bought,
      isExclusive: d.activationType === "NETWORK_ONLY",
      earned: st?.totalEarnedAll ?? 0,
      cap: st?.maxPayoutCap ?? 0,
      capPct: st?.pct ?? 0,
    };
  });

  return { stats, members, page, pageSize, totalPages, referralCode: me?.referralCode ?? null };
}

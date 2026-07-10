/**
 * Admin-side aggregations for the multi-level compensation plan. Node only.
 * Resolves user ids to display info and reads the referral tables
 * (ReferralCommission, Level2Commission, MonthlyBonus, UserUnlock).
 */
import { prisma } from "./prisma";
import { tierForBalance } from "./tiers";
import { ensureReferralSchemaOnce } from "./referral-schema";

export interface UserInfo {
  userId: string;
  name: string;
  account: string;
  status: string;
  activeCapital: number;
  tier: string;
}

const DIRECTS_REQUIRED = 3;
const MIN_CAPITAL = 50;

/** Map every user id → display info (name, account, status, capital, tier). */
export async function resolveUsers(): Promise<Map<string, UserInfo>> {
  const [users, clients] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, clientId: true } }),
    prisma.client.findMany({ select: { id: true, name: true, accountNumber: true, status: true } }),
  ]);
  const clientIds = users.map((u) => u.clientId).filter(Boolean) as string[];
  const deps = clientIds.length
    ? await prisma.transaction.groupBy({
        by: ["clientId"],
        where: { clientId: { in: clientIds }, type: "DEPOSIT", status: "APPROVED" },
        _sum: { amount: true },
      })
    : [];
  const capByClient = new Map(deps.map((d) => [d.clientId, d._sum.amount ?? 0]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const map = new Map<string, UserInfo>();
  for (const u of users) {
    const c = u.clientId ? clientById.get(u.clientId) : null;
    const cap = u.clientId ? capByClient.get(u.clientId) ?? 0 : 0;
    map.set(u.id, {
      userId: u.id,
      name: c?.name ?? u.name,
      account: c?.accountNumber ?? "—",
      status: c?.status ?? "—",
      activeCapital: cap,
      tier: tierForBalance(cap)?.name ?? "None",
    });
  }
  return map;
}

export interface DirectRow {
  id: string; date: string; earner: string; source: string; packageLabel: string; amount: number; status: string;
}
export async function getDirectCommissions(users: Map<string, UserInfo>): Promise<DirectRow[]> {
  const rows = await prisma.referralCommission
    .findMany({ orderBy: { createdAt: "desc" }, take: 500 })
    .catch(() => []);
  return rows.map((r) => ({
    id: r.id,
    date: r.createdAt.toISOString(),
    earner: users.get(r.referrerId)?.name ?? "—",
    source: r.referredName,
    packageLabel: r.packageLabel,
    amount: r.commission,
    status: r.status,
  }));
}

export interface IndirectRow {
  id: string; date: string; earner: string; source: string; directUpline: string; deposit: number; rate: number; amount: number; tier: string;
}
export async function getIndirectCommissions(users: Map<string, UserInfo>): Promise<IndirectRow[]> {
  const rows = await prisma.level2Commission
    .findMany({ orderBy: { createdAt: "desc" }, take: 500 })
    .catch(() => []);
  return rows.map((r) => ({
    id: r.id,
    date: r.createdAt.toISOString(),
    earner: users.get(r.earnerId)?.name ?? "—",
    source: users.get(r.sourceUserId)?.name ?? "—",
    directUpline: r.directUplineId ? users.get(r.directUplineId)?.name ?? "—" : "—",
    deposit: r.depositAmount,
    rate: r.commissionRate,
    amount: r.commissionAmount,
    tier: r.uplineTierAtTime ?? "—",
  }));
}

export interface BonusRow {
  id: string; user: string; monthYear: string; directsCount: number; totalDirectsPl: number; rate: number; amount: number; paidAt: string;
}
export async function getMonthlyBonuses(users: Map<string, UserInfo>, monthYear?: string): Promise<BonusRow[]> {
  const rows = await prisma.monthlyBonus
    .findMany({
      where: monthYear ? { monthYear } : undefined,
      orderBy: [{ monthYear: "desc" }, { bonusAmount: "desc" }],
      take: 1000,
    })
    .catch(() => []);
  return rows.map((r) => ({
    id: r.id,
    user: users.get(r.userId)?.name ?? "—",
    monthYear: r.monthYear,
    directsCount: r.directsCount,
    totalDirectsPl: r.totalDirectsPl,
    rate: r.bonusRate,
    amount: r.bonusAmount,
    paidAt: r.paidAt.toISOString(),
  }));
}

export async function getBonusMonths(): Promise<string[]> {
  const rows = await prisma.monthlyBonus
    .findMany({ distinct: ["monthYear"], select: { monthYear: true }, orderBy: { monthYear: "desc" } })
    .catch(() => []);
  return rows.map((r) => r.monthYear);
}

export interface UnlockRow {
  userId: string; name: string; tier: string; activeCapital: number; activeDirects: number; totalDirects: number; unlocked: boolean; unlockedAt: string | null;
}
/**
 * Live read-only unlock view for every user who has referred someone. Computes
 * qualifying directs (Active Capital ≥ $50 + ACTIVE client) without writing.
 */
export async function getUnlockView(users: Map<string, UserInfo>): Promise<UnlockRow[]> {
  await ensureReferralSchemaOnce(prisma);
  const referrers = await prisma.user.findMany({
    where: { referrals: { some: {} } },
    select: { id: true, referrals: { select: { clientId: true } } },
  });
  const allDirectClientIds = Array.from(
    new Set(referrers.flatMap((r) => r.referrals.map((d) => d.clientId).filter(Boolean)))
  ) as string[];

  const [activeClients, deps, unlockRows] = await Promise.all([
    allDirectClientIds.length
      ? prisma.client.findMany({ where: { id: { in: allDirectClientIds }, status: "ACTIVE" }, select: { id: true } })
      : Promise.resolve([]),
    allDirectClientIds.length
      ? prisma.transaction.groupBy({
          by: ["clientId"],
          where: { clientId: { in: allDirectClientIds }, type: "DEPOSIT", status: "APPROVED" },
          _sum: { amount: true },
        })
      : Promise.resolve([] as { clientId: string; _sum: { amount: number | null } }[]),
    prisma.userUnlock.findMany().catch(() => []),
  ]);
  const activeSet = new Set(activeClients.map((c) => c.id));
  const capByClient = new Map(deps.map((d) => [d.clientId, d._sum.amount ?? 0]));
  const unlockAt = new Map(unlockRows.map((u) => [u.userId, u.unlockedAt]));

  return referrers
    .map((r) => {
      const dcids = r.referrals.map((d) => d.clientId).filter(Boolean) as string[];
      let qualifying = 0;
      for (const cid of dcids) {
        if (activeSet.has(cid) && (capByClient.get(cid) ?? 0) >= MIN_CAPITAL) qualifying += 1;
      }
      const info = users.get(r.id);
      const at = unlockAt.get(r.id);
      return {
        userId: r.id,
        name: info?.name ?? "—",
        tier: info?.tier ?? "None",
        activeCapital: info?.activeCapital ?? 0,
        activeDirects: qualifying,
        totalDirects: dcids.length,
        unlocked: qualifying >= DIRECTS_REQUIRED,
        unlockedAt: at ? at.toISOString() : null,
      };
    })
    .sort((a, b) => b.activeDirects - a.activeDirects);
}

/** Build a 2-level referral tree for one user. */
export interface TreeNode {
  userId: string; name: string; tier: string; activeCapital: number; status: string;
  edgeLabel?: string; // commission % / $ on the edge from parent
}
export interface ReferralTree {
  root: TreeNode | null;
  unlocked: boolean;
  activeDirects: number;
  directs: { node: TreeNode; indirects: TreeNode[] }[];
}
export async function getReferralTree(userId: string, users: Map<string, UserInfo>): Promise<ReferralTree> {
  await ensureReferralSchemaOnce(prisma);
  const rootInfo = users.get(userId);
  const [directs, unlock, l2] = await Promise.all([
    prisma.user.findMany({ where: { referredById: userId }, select: { id: true } }),
    prisma.userUnlock.findUnique({ where: { userId } }).catch(() => null),
    prisma.level2Commission.findMany({ where: { earnerId: userId } }).catch(() => []),
  ]);
  const l2BySource = new Map(l2.map((c) => [c.sourceUserId, c]));

  // Level-1 commissions this user earned, keyed by the referred (source) name.
  const l1 = await prisma.referralCommission.findMany({ where: { referrerId: userId } }).catch(() => []);
  const l1BySource = new Map(l1.map((c) => [c.referredUserId, c]));

  const directNodes = await Promise.all(
    directs.map(async (d) => {
      const di = users.get(d.id);
      const indirects = await prisma.user.findMany({ where: { referredById: d.id }, select: { id: true } });
      const l1c = l1BySource.get(d.id);
      return {
        node: {
          userId: d.id,
          name: di?.name ?? "—",
          tier: di?.tier ?? "None",
          activeCapital: di?.activeCapital ?? 0,
          status: di?.status ?? "—",
          edgeLabel: l1c ? `L1 ${formatPctAmt(l1c.commission)}` : undefined,
        } as TreeNode,
        indirects: indirects.map((ind) => {
          const ii = users.get(ind.id);
          const l2c = l2BySource.get(ind.id);
          return {
            userId: ind.id,
            name: ii?.name ?? "—",
            tier: ii?.tier ?? "None",
            activeCapital: ii?.activeCapital ?? 0,
            status: ii?.status ?? "—",
            edgeLabel: l2c ? `L2 ${l2c.commissionRate}% · ${formatPctAmt(l2c.commissionAmount)}` : undefined,
          } as TreeNode;
        }),
      };
    })
  );

  return {
    root: rootInfo
      ? { userId, name: rootInfo.name, tier: rootInfo.tier, activeCapital: rootInfo.activeCapital, status: rootInfo.status }
      : null,
    unlocked: unlock?.level2Unlocked ?? false,
    activeDirects: unlock?.activeDirectsCount ?? 0,
    directs: directNodes,
  };
}

function formatPctAmt(n: number): string {
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`;
}

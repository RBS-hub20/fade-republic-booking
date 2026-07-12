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
  email: string;
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
    prisma.user.findMany({ select: { id: true, name: true, email: true, clientId: true } }),
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
      email: u.email,
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
  // Commissions are unlimited (repeat per purchase/renewal), so SUM per source
  // to show the total each downline has generated on the edge label.
  const l2BySource = new Map<string, { total: number; rate: number }>();
  for (const c of l2) {
    const prev = l2BySource.get(c.sourceUserId);
    l2BySource.set(c.sourceUserId, {
      total: (prev?.total ?? 0) + c.commissionAmount,
      rate: c.commissionRate,
    });
  }

  // Level-1 commissions this user earned, summed per referred (source) user.
  const l1 = await prisma.referralCommission.findMany({ where: { referrerId: userId } }).catch(() => []);
  const l1BySource = new Map<string, number>();
  for (const c of l1) l1BySource.set(c.referredUserId, (l1BySource.get(c.referredUserId) ?? 0) + c.commission);

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
          edgeLabel: l1c !== undefined ? `L1 ${formatPctAmt(l1c)}` : undefined,
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
            edgeLabel: l2c ? `L2 ${l2c.rate}% · ${formatPctAmt(l2c.total)}` : undefined,
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

export interface DownlineLedgerRow {
  userId: string;
  downline: string;
  account: string;
  totalPurchases: number;
  totalRenews: number;
  lifetimeCommission: number;
  active: boolean;
}

/**
 * Per-downline lifetime commission ledger. Since commissions now repeat on
 * every purchase/renewal, this rolls each downline up to one row: how many
 * packages they've purchased vs renewed, the TOTAL commission their activity
 * has generated across the network (L1 + L2), and whether they're currently
 * ACTIVE (remaining locked principal > $0, net of withdrawals). Newest earners
 * on top by lifetime commission.
 */
export async function getDownlineLedger(users: Map<string, UserInfo>): Promise<DownlineLedgerRow[]> {
  await ensureReferralSchemaOnce(prisma);
  const [l1, l2] = await Promise.all([
    prisma.referralCommission
      .findMany({ where: { status: "PAID" }, select: { referredUserId: true, commission: true } })
      .catch(() => [] as { referredUserId: string; commission: number }[]),
    prisma.level2Commission
      .findMany({ select: { sourceUserId: true, commissionAmount: true } })
      .catch(() => [] as { sourceUserId: string; commissionAmount: number }[]),
  ]);

  // Lifetime commission each downline generated (their L1 + any L2 above them).
  const lifetime = new Map<string, number>();
  for (const r of l1) lifetime.set(r.referredUserId, (lifetime.get(r.referredUserId) ?? 0) + r.commission);
  for (const r of l2) lifetime.set(r.sourceUserId, (lifetime.get(r.sourceUserId) ?? 0) + r.commissionAmount);

  const ids = Array.from(lifetime.keys());
  if (ids.length === 0) return [];

  const downUsers = await prisma.user
    .findMany({ where: { id: { in: ids } }, select: { id: true, clientId: true } })
    .catch(() => [] as { id: string; clientId: string | null }[]);
  const clientIds = downUsers.map((u) => u.clientId).filter(Boolean) as string[];

  // Actual activity counts + capital, straight from the ledger (independent of
  // which events happened to pay a commission).
  const [purchaseGroups, renewGroups, depSums, withdrawnActions] = await Promise.all([
    clientIds.length
      ? prisma.transaction.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds }, type: "DEPOSIT", status: "APPROVED" },
          _count: { _all: true },
        })
      : [],
    clientIds.length
      ? prisma.capitalAction
          .groupBy({ by: ["clientId"], where: { clientId: { in: clientIds }, action: "renewed" }, _count: { _all: true } })
          .catch(() => [] as { clientId: string | null; _count: { _all: number } }[])
      : [],
    clientIds.length
      ? prisma.transaction.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds }, type: "DEPOSIT", status: "APPROVED" },
          _sum: { amount: true },
        })
      : [],
    clientIds.length
      ? prisma.capitalAction
          .findMany({ where: { clientId: { in: clientIds }, action: "withdrawn" }, select: { clientId: true, amount: true } })
          .catch(() => [] as { clientId: string | null; amount: number }[])
      : [],
  ]);

  const purchasesByClient = new Map(purchaseGroups.map((g) => [g.clientId, g._count._all]));
  const renewsByClient = new Map(renewGroups.map((g) => [g.clientId, g._count._all]));
  const grossByClient = new Map(depSums.map((g) => [g.clientId, g._sum.amount ?? 0]));
  const withdrawnByClient = new Map<string, number>();
  for (const w of withdrawnActions) {
    if (w.clientId) withdrawnByClient.set(w.clientId, (withdrawnByClient.get(w.clientId) ?? 0) + w.amount);
  }
  const clientByUser = new Map(downUsers.map((u) => [u.id, u.clientId]));

  const rows: DownlineLedgerRow[] = ids.map((id) => {
    const cid = clientByUser.get(id) ?? null;
    const remaining = cid ? (grossByClient.get(cid) ?? 0) - (withdrawnByClient.get(cid) ?? 0) : 0;
    return {
      userId: id,
      downline: users.get(id)?.name ?? "—",
      account: users.get(id)?.account ?? "—",
      totalPurchases: cid ? purchasesByClient.get(cid) ?? 0 : 0,
      totalRenews: cid ? renewsByClient.get(cid) ?? 0 : 0,
      lifetimeCommission: Math.round((lifetime.get(id) ?? 0) * 100) / 100,
      active: remaining > 0,
    };
  });
  rows.sort((a, b) => b.lifetimeCommission - a.lifetimeCommission);
  return rows;
}

export interface CompensationSummary {
  l1: number;
  l2: number;
  bonus: number;
  grandTotal: number;
  feeRevenue: number;
  net: number;
}

/** Platform-wide compensation totals for the Commissions KPI header. */
export async function getCompensationSummary(): Promise<CompensationSummary> {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const [l1Agg, l2Agg, bonusAgg, feeAgg] = await Promise.all([
    prisma.referralCommission
      .aggregate({ where: { status: "PAID" }, _sum: { commission: true } })
      .catch(() => ({ _sum: { commission: 0 } })),
    prisma.level2Commission
      .aggregate({ _sum: { commissionAmount: true } })
      .catch(() => ({ _sum: { commissionAmount: 0 } })),
    prisma.monthlyBonus
      .aggregate({ _sum: { bonusAmount: true } })
      .catch(() => ({ _sum: { bonusAmount: 0 } })),
    prisma.withdrawal
      .aggregate({ where: { status: "completed" }, _sum: { fee: true } })
      .catch(() => ({ _sum: { fee: 0 } })),
  ]);
  const l1 = round2(l1Agg._sum.commission ?? 0);
  const l2 = round2(l2Agg._sum.commissionAmount ?? 0);
  const bonus = round2(bonusAgg._sum.bonusAmount ?? 0);
  const grandTotal = round2(l1 + l2 + bonus);
  const feeRevenue = round2(feeAgg._sum.fee ?? 0);
  return { l1, l2, bonus, grandTotal, feeRevenue, net: round2(feeRevenue - grandTotal) };
}

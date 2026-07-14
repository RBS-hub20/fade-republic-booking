/**
 * Read-only genealogy network-tree queries for the admin visualizer. Uses the
 * existing referredById graph + materialized referralPath — NO changes to any
 * referral/commission/genealogy calc logic. Server (Node) only.
 */
import { prisma } from "./prisma";
import { tierForBalance } from "./tiers";
import { ensureReferralSchemaOnce } from "./referral-schema";
import { ensureUsernameSchemaOnce } from "./username";
import { ensureAvatarSchemaOnce, avatarTypeFor } from "./avatar";

export const PAGE_SIZE = 20;

export interface TreeNode {
  id: string;
  username: string | null;
  tier: string;
  avatarType: string | null;
  directCount: number;
  teamCount: number;
  teamVolume: number; // total approved deposits across the downline
  totalPnlPercent: number;
  joinedAt: string;
  status: string;
  hasChildren: boolean;
}

export interface ChildrenPage {
  parentId: string;
  nodes: TreeNode[];
  total: number;
  offset: number;
  hasMore: boolean;
}

let treeHealed = false;
export async function ensureTreeSchemaOnce(): Promise<void> {
  if (treeHealed) return;
  await ensureReferralSchemaOnce(prisma); // referralPath / referredById
  await ensureUsernameSchemaOnce(prisma); // username
  await ensureAvatarSchemaOnce(prisma); // avatarType / referredById index (retires gender)
  treeHealed = true;
}

/** Fill avatarType for any user missing one (idempotent). */
export async function backfillAvatars(): Promise<{ filled: number }> {
  await ensureTreeSchemaOnce();
  const pending = await prisma.user.findMany({ where: { avatarType: null }, select: { id: true } });
  let filled = 0;
  for (const u of pending) {
    await prisma.user
      .update({ where: { id: u.id }, data: { avatarType: avatarTypeFor(u.id) } })
      .catch(() => {});
    filled += 1;
  }
  return { filled };
}
let avatarsBackfilled = false;
export async function ensureAvatarsBackfilledOnce(): Promise<void> {
  if (avatarsBackfilled) return;
  try {
    await backfillAvatars();
    avatarsBackfilled = true;
  } catch (e) {
    console.error("[genealogy-tree] avatar backfill failed:", e);
  }
}

type UserRow = {
  id: string;
  username: string | null;
  avatarType: string | null;
  createdAt: Date;
  clientId: string | null;
  referralPath: string | null;
};

/** Batch-enrich a page of users with counts, tier, pnl% and status. */
async function enrich(users: UserRow[]): Promise<TreeNode[]> {
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const clientIds = users.map((u) => u.clientId).filter(Boolean) as string[];

  const [directGroups, clients, depGroups, pnlGroups, teamCounts, teamVolumes] = await Promise.all([
    prisma.user.groupBy({ by: ["referredById"], where: { referredById: { in: ids } }, _count: { _all: true } }),
    clientIds.length
      ? prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, status: true } })
      : Promise.resolve([] as { id: string; status: string }[]),
    clientIds.length
      ? prisma.transaction.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds }, type: "DEPOSIT", status: "APPROVED" },
          _sum: { amount: true },
        })
      : Promise.resolve([] as { clientId: string; _sum: { amount: number | null } }[]),
    clientIds.length
      ? prisma.dailyPerformance.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds } }, _sum: { pnlUsd: true } })
      : Promise.resolve([] as { clientId: string; _sum: { pnlUsd: number | null } }[]),
    // Per-node subtree (team) count via the materialized path prefix (indexed).
    Promise.all(
      users.map((u) => {
        const prefix = u.referralPath ? `${u.referralPath}/${u.id}` : u.id;
        return prisma.user.count({
          where: { OR: [{ referralPath: prefix }, { referralPath: { startsWith: `${prefix}/` } }] },
        });
      })
    ),
    // Per-node team VOLUME: sum of approved deposits across the same downline.
    Promise.all(
      users.map((u) => {
        const prefix = u.referralPath ? `${u.referralPath}/${u.id}` : u.id;
        return prisma.transaction
          .aggregate({
            where: {
              type: "DEPOSIT",
              status: "APPROVED",
              client: { user: { OR: [{ referralPath: prefix }, { referralPath: { startsWith: `${prefix}/` } }] } },
            },
            _sum: { amount: true },
          })
          .then((r) => r._sum.amount ?? 0);
      })
    ),
  ]);

  const directBy = new Map(directGroups.map((g) => [g.referredById as string, g._count._all]));
  const statusBy = new Map(clients.map((c) => [c.id, c.status]));
  const capBy = new Map(depGroups.map((g) => [g.clientId, g._sum.amount ?? 0]));
  const pnlBy = new Map(pnlGroups.map((g) => [g.clientId, g._sum.pnlUsd ?? 0]));

  return users.map((u, i) => {
    const cap = u.clientId ? capBy.get(u.clientId) ?? 0 : 0;
    const pnlUsd = u.clientId ? pnlBy.get(u.clientId) ?? 0 : 0;
    const pnlPct = cap > 0 ? (pnlUsd / cap) * 100 : 0;
    const direct = directBy.get(u.id) ?? 0;
    return {
      id: u.id,
      username: u.username,
      tier: tierForBalance(cap)?.name ?? "None",
      avatarType: u.avatarType,
      directCount: direct,
      teamCount: teamCounts[i],
      teamVolume: Math.round(teamVolumes[i]),
      totalPnlPercent: Math.round(pnlPct * 10) / 10,
      joinedAt: u.createdAt.toISOString(),
      status: u.clientId && statusBy.get(u.clientId) === "ACTIVE" ? "Active" : "Inactive",
      hasChildren: direct > 0,
    };
  });
}

const CHILD_SELECT = {
  id: true,
  username: true,
  avatarType: true,
  createdAt: true,
  clientId: true,
  referralPath: true,
} as const;

/**
 * Direct children of `parentId`, paginated. `parentId === "root"` returns the
 * top-level members (no sponsor) — the synthetic QuantumX company root.
 */
export async function getChildren(parentId: string, offset = 0, limit = PAGE_SIZE): Promise<ChildrenPage> {
  await ensureTreeSchemaOnce();
  const where = parentId === "root" ? { referredById: null } : { referredById: parentId };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "asc" }, skip: offset, take: limit, select: CHILD_SELECT }),
  ]);
  const nodes = await enrich(users as UserRow[]);
  return { parentId, nodes, total, offset, hasMore: offset + users.length < total };
}

/** Total members under the company root (for the "N Direct Members" header). */
export async function getRootDirectCount(): Promise<number> {
  await ensureTreeSchemaOnce();
  return prisma.user.count({ where: { referredById: null } });
}

/** Root → user id/username chain for search-jump + breadcrumb. */
export async function resolvePath(
  username: string
): Promise<{ found: boolean; path: { id: string; username: string | null }[] }> {
  await ensureTreeSchemaOnce();
  const target = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, referralPath: true },
  });
  if (!target) return { found: false, path: [] };

  const ancestorIds = target.referralPath ? target.referralPath.split("/") : [];
  const chainIds = [...ancestorIds, target.id];
  const users = await prisma.user.findMany({ where: { id: { in: chainIds } }, select: { id: true, username: true } });
  const byId = new Map(users.map((u) => [u.id, u.username]));
  return {
    found: true,
    path: [
      { id: "root", username: null },
      ...chainIds.map((id) => ({ id, username: byId.get(id) ?? null })),
    ],
  };
}

/**
 * Genealogy / lineage tracking (materialized-path model). Node runtime only.
 *
 * Each user carries three denormalized fields, maintained at signup and
 * repairable via backfill:
 *   - referralPath   slash-joined ancestor ids, root → direct sponsor
 *                    (EXCLUDES self). null for a root user. e.g. "id1/id5/id23".
 *   - referralDepth  number of ancestors (0 for a root).
 *   - rootSponsorId  the topmost ancestor id (null for a root).
 *
 * This makes upline (split the path), downline (prefix scan), and whole-tree
 * (rootSponsorId / prefix) queries index-friendly and O(matches).
 */
import { prisma } from "./prisma";
import { ensureReferralSchemaOnce } from "./referral-schema";
import { resolveUsers, type UserInfo } from "./admin-referrals";

/** Hard cap to prevent runaway/cyclic chains from ballooning. */
export const MAX_DEPTH = 15;

export interface GenealogyFields {
  referralPath: string | null;
  referralDepth: number;
  rootSponsorId: string | null;
}

const ROOT_FIELDS: GenealogyFields = { referralPath: null, referralDepth: 0, rootSponsorId: null };

/**
 * Walk the referredById chain up from `sponsorId`, returning ancestor ids
 * ordered root → sponsor (inclusive of the sponsor). Cycle-safe, depth-capped.
 * Used as a fallback when a sponsor's own path isn't materialized yet.
 */
async function ancestorChainFromSponsor(sponsorId: string): Promise<string[]> {
  const rev: string[] = []; // sponsor .. root
  const seen = new Set<string>();
  let cur: string | null = sponsorId;
  while (cur && rev.length <= MAX_DEPTH + 1) {
    if (seen.has(cur)) break; // cycle guard
    seen.add(cur);
    const u: { id: string; referredById: string | null } | null = await prisma.user.findUnique({
      where: { id: cur },
      select: { id: true, referredById: true },
    });
    if (!u) break;
    rev.push(u.id);
    cur = u.referredById;
  }
  return rev.reverse(); // root .. sponsor
}

/**
 * Compute lineage fields for a NEW user given their sponsor id (or null for a
 * root signup). Fast path uses the sponsor's materialized path; falls back to a
 * chain walk if the sponsor predates backfill.
 */
export async function computeGenealogyForSponsor(sponsorId: string | null): Promise<GenealogyFields> {
  if (!sponsorId) return { ...ROOT_FIELDS };
  const sponsor = await prisma.user.findUnique({
    where: { id: sponsorId },
    select: { id: true, referredById: true, referralPath: true, referralDepth: true, rootSponsorId: true },
  });
  if (!sponsor) return { ...ROOT_FIELDS };

  const sponsorMaterialized = sponsor.referralPath !== null || sponsor.referredById === null;
  if (sponsorMaterialized) {
    return {
      referralPath: sponsor.referralPath ? `${sponsor.referralPath}/${sponsor.id}` : sponsor.id,
      referralDepth: (sponsor.referralDepth ?? 0) + 1,
      rootSponsorId: sponsor.rootSponsorId ?? sponsor.id,
    };
  }
  // Fallback: sponsor not yet materialized — derive from the live chain.
  const chain = await ancestorChainFromSponsor(sponsor.id); // root .. sponsor = the child's ancestors
  return {
    referralPath: chain.length ? chain.join("/") : null,
    referralDepth: chain.length,
    rootSponsorId: chain[0] ?? null,
  };
}

/**
 * Recompute referralPath/depth/rootSponsorId for EVERY user from the
 * referredById graph. Idempotent — only writes rows whose values changed.
 * Cycle-safe (a detected cycle truncates that node's chain) and depth-capped.
 */
export async function backfillGenealogy(): Promise<{
  scanned: number;
  updated: number;
  cycles: number;
  maxDepth: number;
}> {
  const users = await prisma.user.findMany({
    select: { id: true, referredById: true, referralPath: true, referralDepth: true, rootSponsorId: true },
  });
  const parent = new Map<string, string | null>();
  for (const u of users) parent.set(u.id, u.referredById ?? null);

  const cache = new Map<string, string[]>(); // id → ancestors [root .. directSponsor]
  let cycles = 0;

  function ancestorsOf(id: string): string[] {
    const cached = cache.get(id);
    if (cached) return cached;
    const rev: string[] = []; // directSponsor .. root
    const seen = new Set<string>([id]);
    let cur = parent.get(id) ?? null;
    while (cur && rev.length <= MAX_DEPTH + 1) {
      if (seen.has(cur)) {
        cycles += 1;
        break;
      }
      seen.add(cur);
      rev.push(cur);
      cur = parent.get(cur) ?? null;
    }
    const chain = rev.reverse();
    cache.set(id, chain);
    return chain;
  }

  let updated = 0;
  let maxDepth = 0;
  for (const u of users) {
    const chain = ancestorsOf(u.id);
    const path = chain.length ? chain.join("/") : null;
    const depth = chain.length;
    const root = chain[0] ?? null;
    if (depth > maxDepth) maxDepth = depth;
    if (u.referralPath !== path || u.referralDepth !== depth || u.rootSponsorId !== root) {
      await prisma.user
        .update({ where: { id: u.id }, data: { referralPath: path, referralDepth: depth, rootSponsorId: root } })
        .catch(() => {});
      updated += 1;
    }
  }
  return { scanned: users.length, updated, cycles, maxDepth };
}

// Self-heal: after a deploy that adds these columns, existing referred users
// have referralPath = null. The first genealogy request backfills them once.
let genealogyBackfilled = false;
export async function ensureGenealogyBackfilledOnce(): Promise<void> {
  if (genealogyBackfilled) return;
  await ensureReferralSchemaOnce(prisma);
  try {
    const pending = await prisma.user.count({
      where: { referredById: { not: null }, referralPath: null },
    });
    if (pending > 0) await backfillGenealogy();
    genealogyBackfilled = true;
  } catch (e) {
    console.error("[genealogy] backfill self-heal failed:", e);
  }
}

// ---- Query helpers (enriched with tier/name/email via resolveUsers) --------

export interface LineageNode {
  level: number; // 0 = root, increasing toward the target user
  userId: string;
  name: string;
  email: string;
  account: string;
  tier: string;
  activeCapital: number;
  isTarget: boolean;
}

function nodeFrom(id: string, level: number, info: Map<string, UserInfo>, isTarget: boolean): LineageNode {
  const u = info.get(id);
  return {
    level,
    userId: id,
    name: u?.name ?? "(unknown)",
    email: u?.email ?? "—",
    account: u?.account ?? "—",
    tier: u?.tier ?? "None",
    activeCapital: u?.activeCapital ?? 0,
    isTarget,
  };
}

/** Resolve a user by id OR email (case-insensitive). */
export async function findUserByIdOrEmail(query: string): Promise<{ id: string } | null> {
  const q = query.trim();
  if (!q) return null;
  return prisma.user.findFirst({
    where: { OR: [{ id: q }, { email: { equals: q, mode: "insensitive" } }] },
    select: { id: true },
  });
}

/** Full upline chain from root → the user (inclusive). */
export async function getUpline(userId: string): Promise<LineageNode[] | null> {
  await ensureGenealogyBackfilledOnce();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, referralPath: true } });
  if (!user) return null;
  const ancestorIds = user.referralPath ? user.referralPath.split("/") : [];
  const chain = [...ancestorIds, user.id]; // root .. user
  const info = await resolveUsers();
  return chain.map((id, i) => nodeFrom(id, i, info, id === user.id));
}

export interface DownlineMember extends LineageNode {
  relativeLevel: number; // 1 = direct, 2 = 2nd level, …
}
export interface DownlineResult {
  userId: string;
  totalTeam: number;
  levels: number;
  totalVolume: number;
  byLevel: { level: number; count: number; volume: number }[];
  members: DownlineMember[];
}

/** Every downline under `userId`, any depth, with per-level counts + volume. */
export async function getDownlines(userId: string): Promise<DownlineResult | null> {
  await ensureGenealogyBackfilledOnce();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, referralPath: true, referralDepth: true },
  });
  if (!user) return null;
  const prefix = user.referralPath ? `${user.referralPath}/${user.id}` : user.id;

  const rows = await prisma.user.findMany({
    where: { OR: [{ referralPath: prefix }, { referralPath: { startsWith: `${prefix}/` } }] },
    select: { id: true, referralDepth: true },
  });
  const info = await resolveUsers();

  const members: DownlineMember[] = rows
    .map((r) => ({
      ...nodeFrom(r.id, r.referralDepth, info, false),
      relativeLevel: r.referralDepth - user.referralDepth,
    }))
    .sort((a, b) => a.relativeLevel - b.relativeLevel || a.name.localeCompare(b.name));

  const byLevelMap = new Map<number, { count: number; volume: number }>();
  for (const m of members) {
    const e = byLevelMap.get(m.relativeLevel) ?? { count: 0, volume: 0 };
    e.count += 1;
    e.volume += m.activeCapital;
    byLevelMap.set(m.relativeLevel, e);
  }
  const byLevel = Array.from(byLevelMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, v]) => ({ level, count: v.count, volume: v.volume }));

  return {
    userId,
    totalTeam: members.length,
    levels: byLevel.length,
    totalVolume: members.reduce((s, m) => s + m.activeCapital, 0),
    byLevel,
    members,
  };
}

export interface TreeNode {
  userId: string;
  name: string;
  email: string;
  tier: string;
  activeCapital: number;
  depth: number;
  children: TreeNode[];
}

/** Whole subtree under `rootId` (works for any node, not just true roots). */
export async function getGenealogyTree(rootId: string): Promise<TreeNode | null> {
  await ensureGenealogyBackfilledOnce();
  const root = await prisma.user.findUnique({
    where: { id: rootId },
    select: { id: true, referralPath: true, referralDepth: true },
  });
  if (!root) return null;
  const prefix = root.referralPath ? `${root.referralPath}/${root.id}` : root.id;

  const all = await prisma.user.findMany({
    where: {
      OR: [{ id: rootId }, { referralPath: prefix }, { referralPath: { startsWith: `${prefix}/` } }],
    },
    select: { id: true, referredById: true },
  });
  const info = await resolveUsers();
  const childrenByParent = new Map<string, string[]>();
  for (const u of all) {
    if (u.referredById) {
      const arr = childrenByParent.get(u.referredById) ?? [];
      arr.push(u.id);
      childrenByParent.set(u.referredById, arr);
    }
  }

  const build = (id: string, depth: number): TreeNode => {
    const u = info.get(id);
    const kids = (childrenByParent.get(id) ?? [])
      .map((cid) => build(cid, depth + 1))
      .sort((a, b) => b.activeCapital - a.activeCapital || a.name.localeCompare(b.name));
    return {
      userId: id,
      name: u?.name ?? "(unknown)",
      email: u?.email ?? "—",
      tier: u?.tier ?? "None",
      activeCapital: u?.activeCapital ?? 0,
      depth,
      children: kids,
    };
  };
  return build(rootId, 0);
}

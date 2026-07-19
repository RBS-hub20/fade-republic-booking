import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * Single source of truth for the surgical single-user re-parent used by BOTH
 * the CLI (scripts/fix-reparent-elisa.ts) and the admin HTTP route
 * (app/api/admin/fix-elisa). Keeping ONE implementation guarantees the two
 * paths can never diverge on money-adjacent logic.
 *
 * Guarantees:
 *   - Touches ONLY the downline row (updateMany guarded by id AND lower(email);
 *     asserts exactly 1 row or the transaction rolls back).
 *   - Never reads/writes passwordHash, email, referralCode, username, or any
 *     Client / Transaction row — the ledger is out of scope entirely.
 *   - Dry-run unless `confirm === true`.
 *   - Idempotent (no-op if already correctly parented).
 *   - Cycle-safe (refuses if the upline sits at/under the downline).
 *   - Scoped subtree recompute for the downline's OWN descendants only — never
 *     the global backfill (which is a bulk write over every user).
 */

const LINEAGE_SELECT = {
  id: true,
  email: true,
  username: true,
  referralCode: true,
  referredById: true,
  referralPath: true,
  referralDepth: true,
  rootSponsorId: true,
  createdAt: true,
} as const;

export type Lineage = {
  id: string;
  referralPath: string | null;
  referralDepth: number;
  rootSponsorId: string | null;
};

export interface ReparentInput {
  downlineEmail: string;
  uplineEmail: string;
  confirm?: boolean;
}

export interface ReparentResult {
  ok: boolean;
  dryRun: boolean;
  applied: boolean;
  status:
    | "DRY_RUN"
    | "APPLIED"
    | "IDEMPOTENT_NOOP"
    | "DOWNLINE_NOT_FOUND"
    | "UPLINE_NOT_FOUND"
    | "SAME_USER"
    | "CYCLE_REFUSED"
    | "ERROR";
  message: string;
  before?: Record<string, unknown>;
  after?: { referredById: string; referralPath: string; referralDepth: number; rootSponsorId: string };
  descendants: number;
  verification?: { visibleUnderUpline: boolean; uplineDirectCount: number };
}

/** Exactly the fast-path formula from src/lib/genealogy.ts computeGenealogyForSponsor. */
export function childFields(sponsor: Lineage) {
  return {
    referredById: sponsor.id,
    referralPath: sponsor.referralPath ? `${sponsor.referralPath}/${sponsor.id}` : sponsor.id,
    referralDepth: (sponsor.referralDepth ?? 0) + 1,
    rootSponsorId: sponsor.rootSponsorId ?? sponsor.id,
  };
}

export async function reparent(db: PrismaClient, input: ReparentInput): Promise<ReparentResult> {
  const downlineEmail = input.downlineEmail.toLowerCase().trim();
  const uplineEmail = input.uplineEmail.toLowerCase().trim();
  const confirm = input.confirm === true;

  const [down, up] = await Promise.all([
    db.user.findFirst({ where: { email: { equals: downlineEmail, mode: "insensitive" } }, select: LINEAGE_SELECT }),
    db.user.findFirst({ where: { email: { equals: uplineEmail, mode: "insensitive" } }, select: LINEAGE_SELECT }),
  ]);

  if (!down) return { ok: false, dryRun: !confirm, applied: false, status: "DOWNLINE_NOT_FOUND", message: `Downline not found: ${downlineEmail}`, descendants: 0 };
  if (!up) return { ok: false, dryRun: !confirm, applied: false, status: "UPLINE_NOT_FOUND", message: `Upline not found: ${uplineEmail}`, descendants: 0 };
  if (down.id === up.id) return { ok: false, dryRun: !confirm, applied: false, status: "SAME_USER", message: "Downline and upline are the same user.", descendants: 0 };

  // Cycle guard: the upline must not sit at/under the downline in the tree.
  const upAncestors = new Set((up.referralPath ?? "").split("/").filter(Boolean));
  if (up.rootSponsorId === down.id || upAncestors.has(down.id)) {
    return { ok: false, dryRun: !confirm, applied: false, status: "CYCLE_REFUSED", message: "Cycle guard: upline is a descendant of the downline — refusing.", descendants: 0 };
  }

  const proposed = childFields(up);
  const before = {
    id: down.id,
    email: down.email,
    username: down.username,
    referralCode: down.referralCode,
    referredById: down.referredById,
    referralPath: down.referralPath,
    referralDepth: down.referralDepth,
    rootSponsorId: down.rootSponsorId,
  };

  const alreadyCorrect =
    down.referredById === proposed.referredById &&
    down.referralPath === proposed.referralPath &&
    down.referralDepth === proposed.referralDepth &&
    down.rootSponsorId === proposed.rootSponsorId;
  if (alreadyCorrect) {
    return { ok: true, dryRun: !confirm, applied: false, status: "IDEMPOTENT_NOOP", message: "Downline is already correctly parented. Nothing to do.", before, after: proposed, descendants: 0 };
  }

  // Scoped descendant recompute plan (expected 0 for a leaf).
  const descendantUpdates: { id: string; fields: ReturnType<typeof childFields> }[] = [];
  {
    const newDown: Lineage = { id: down.id, referralPath: proposed.referralPath, referralDepth: proposed.referralDepth, rootSponsorId: proposed.rootSponsorId };
    const queue: Lineage[] = [newDown];
    const seen = new Set<string>([down.id]);
    while (queue.length) {
      const sponsor = queue.shift()!;
      const kids = await db.user.findMany({ where: { referredById: sponsor.id }, select: { id: true } });
      for (const kid of kids) {
        if (seen.has(kid.id)) continue;
        seen.add(kid.id);
        const f = childFields(sponsor);
        descendantUpdates.push({ id: kid.id, fields: f });
        queue.push({ id: kid.id, referralPath: f.referralPath, referralDepth: f.referralDepth, rootSponsorId: f.rootSponsorId });
      }
    }
  }

  if (!confirm) {
    return { ok: true, dryRun: true, applied: false, status: "DRY_RUN", message: "Dry-run — nothing written. Send confirm=true to apply.", before, after: proposed, descendants: descendantUpdates.length };
  }

  // Apply — transactional, guarded, all-or-nothing.
  await db.$transaction(async (tx) => {
    const res = await tx.user.updateMany({
      where: { id: down.id, email: { equals: downlineEmail, mode: "insensitive" } },
      data: { ...proposed, updatedAt: new Date() },
    });
    if (res.count !== 1) throw new Error(`Expected to update exactly 1 row, updated ${res.count} — rolling back.`);
    for (const d of descendantUpdates) {
      const r = await tx.user.updateMany({ where: { id: d.id }, data: { ...d.fields, updatedAt: new Date() } });
      if (r.count !== 1) throw new Error(`Descendant ${d.id} update touched ${r.count} rows — rolling back.`);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const [visible, uplineDirectCount] = await Promise.all([
    db.user.findFirst({ where: { id: down.id, referredById: up.id }, select: { id: true } }),
    db.user.count({ where: { referredById: up.id } }),
  ]);

  return {
    ok: true,
    dryRun: false,
    applied: true,
    status: "APPLIED",
    message: `Committed: 1 downline row + ${descendantUpdates.length} descendant row(s).`,
    before,
    after: proposed,
    descendants: descendantUpdates.length,
    verification: { visibleUnderUpline: !!visible, uplineDirectCount },
  };
}

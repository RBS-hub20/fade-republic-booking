/**
 * SURGICAL single-user re-parent: move a downline under an upline by fixing ONLY
 * the four genealogy columns on the downline's own row. Idempotent. Dry-run by
 * default — writes ONLY when CONFIRM=true is passed explicitly.
 *
 * P0 guarantees:
 *   - Touches ONLY the downline row (updateMany guarded by id AND lower(email));
 *     asserts exactly 1 row matched or the transaction rolls back.
 *   - Never touches Client / Transaction / balances / P/L (ledger untouched).
 *   - Never changes email / referralCode / username / passwordHash.
 *   - Wrapped in a transaction; any error rolls the whole thing back.
 *   - Cycle-safe: refuses if the upline is at/under the downline in the tree.
 *   - Uses a SCOPED subtree recompute for the downline's own descendants
 *     (expected 0) instead of the global backfillGenealogy() — the global one
 *     is a bulk write over every user and would violate the no-bulk-update rule.
 *
 * Usage:
 *   Dry-run (default):
 *     DOWNLINE=asilehsarem@gmail.com UPLINE=alejandro152@gmail.com \
 *       pnpm tsx scripts/fix-reparent-elisa.ts
 *   Apply (only after dry-run approved):
 *     DOWNLINE=asilehsarem@gmail.com UPLINE=alejandro152@gmail.com CONFIRM=true \
 *       pnpm tsx scripts/fix-reparent-elisa.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DOWNLINE = (process.env.DOWNLINE || "asilehsarem@gmail.com").toLowerCase();
const UPLINE = (process.env.UPLINE || "alejandro152@gmail.com").toLowerCase();
const CONFIRM = process.env.CONFIRM === "true";

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

type Lineage = {
  id: string;
  referralPath: string | null;
  referralDepth: number;
  rootSponsorId: string | null;
};

// Exactly the fast-path formula from src/lib/genealogy.ts computeGenealogyForSponsor.
function childFields(sponsor: Lineage) {
  return {
    referredById: sponsor.id,
    referralPath: sponsor.referralPath ? `${sponsor.referralPath}/${sponsor.id}` : sponsor.id,
    referralDepth: (sponsor.referralDepth ?? 0) + 1,
    rootSponsorId: sponsor.rootSponsorId ?? sponsor.id,
  };
}

function print(label: string, u: any) {
  console.log(`  ${label}`);
  console.log(`    id            = ${u.id}`);
  console.log(`    email         = ${u.email}`);
  console.log(`    username      = ${u.username ?? "(null)"}   [never modified]`);
  console.log(`    referralCode  = ${u.referralCode ?? "(null)"}   [never modified]`);
  console.log(`    referredById  = ${u.referredById ?? "(null)"}`);
  console.log(`    referralPath  = ${u.referralPath ?? "(null)"}`);
  console.log(`    referralDepth = ${u.referralDepth}`);
  console.log(`    rootSponsorId = ${u.rootSponsorId ?? "(null)"}`);
}

async function main() {
  console.log(`=== SURGICAL RE-PARENT ${CONFIRM ? "(APPLY / CONFIRM=true)" : "(DRY-RUN)"} ===\n`);

  const [down, up] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: DOWNLINE, mode: "insensitive" } }, select: LINEAGE_SELECT }),
    prisma.user.findFirst({ where: { email: { equals: UPLINE, mode: "insensitive" } }, select: LINEAGE_SELECT }),
  ]);

  // --- Guards --------------------------------------------------------------
  if (!down) throw new Error(`DOWNLINE not found: ${DOWNLINE}`);
  if (!up) throw new Error(`UPLINE not found: ${UPLINE}`);
  if (down.id === up.id) throw new Error("DOWNLINE and UPLINE are the same user — refusing.");
  // Cycle guard: the upline must not sit at/under the downline in the tree.
  const upAncestors = new Set((up.referralPath ?? "").split("/").filter(Boolean));
  if (up.rootSponsorId === down.id || upAncestors.has(down.id)) {
    throw new Error("CYCLE GUARD: upline is a descendant of the downline — refusing to re-parent.");
  }

  console.log("BEFORE (from DB):\n");
  print("DOWNLINE", down);
  console.log();
  print("UPLINE", up);
  console.log();

  const proposed = childFields(up);
  console.log("AFTER (proposed — 4 columns only, derived from UPLINE lineage):");
  console.log(`    referredById  = ${down.referredById ?? "(null)"}  ->  ${proposed.referredById}`);
  console.log(`    referralPath  = ${down.referralPath ?? "(null)"}  ->  ${proposed.referralPath}`);
  console.log(`    referralDepth = ${down.referralDepth}  ->  ${proposed.referralDepth}`);
  console.log(`    rootSponsorId = ${down.rootSponsorId ?? "(null)"}  ->  ${proposed.rootSponsorId}`);
  console.log("    (email, username, referralCode, passwordHash, clientId, ledger — UNCHANGED)\n");

  // --- Idempotency ---------------------------------------------------------
  const alreadyCorrect =
    down.referredById === proposed.referredById &&
    down.referralPath === proposed.referralPath &&
    down.referralDepth === proposed.referralDepth &&
    down.rootSponsorId === proposed.rootSponsorId;
  if (alreadyCorrect) {
    console.log("IDEMPOTENT NO-OP: downline is already correctly parented. Nothing to do.");
    return;
  }

  // --- Scoped descendant recompute plan (expected: none) -------------------
  // Walk the downline's own subtree via referredById so we can fix their paths
  // too. For a leaf orphan this is empty. Computed against the downline's NEW
  // fields so children/grandchildren stay consistent.
  const descendantUpdates: { id: string; fields: ReturnType<typeof childFields> }[] = [];
  {
    const newDown: Lineage = { id: down.id, referralPath: proposed.referralPath, referralDepth: proposed.referralDepth, rootSponsorId: proposed.rootSponsorId };
    const queue: Lineage[] = [newDown];
    const seen = new Set<string>([down.id]);
    while (queue.length) {
      const sponsor = queue.shift()!;
      const kids = await prisma.user.findMany({ where: { referredById: sponsor.id }, select: { id: true } });
      for (const kid of kids) {
        if (seen.has(kid.id)) continue; // cycle guard
        seen.add(kid.id);
        const f = childFields(sponsor);
        descendantUpdates.push({ id: kid.id, fields: f });
        queue.push({ id: kid.id, referralPath: f.referralPath, referralDepth: f.referralDepth, rootSponsorId: f.rootSponsorId });
      }
    }
  }
  console.log(`Descendants of downline to recompute: ${descendantUpdates.length}` +
    (descendantUpdates.length ? " (scoped subtree only)" : " (leaf — none)") + "\n");

  // --- Dry-run stop --------------------------------------------------------
  if (!CONFIRM) {
    console.log("DRY-RUN OK — pass CONFIRM=true to apply. Nothing was written.");
    return;
  }

  // --- Apply (transactional) ----------------------------------------------
  await prisma.$transaction(async (tx) => {
    // Guarded single-row update: id AND lower(email) must both match.
    const res = await tx.user.updateMany({
      where: { id: down.id, email: { equals: DOWNLINE, mode: "insensitive" } },
      data: {
        referredById: proposed.referredById,
        referralPath: proposed.referralPath,
        referralDepth: proposed.referralDepth,
        rootSponsorId: proposed.rootSponsorId,
        updatedAt: new Date(),
      },
    });
    if (res.count !== 1) throw new Error(`Expected to update exactly 1 row, updated ${res.count} — rolling back.`);

    // Scoped descendants (each by id; expected 0 for a leaf).
    for (const d of descendantUpdates) {
      const r = await tx.user.updateMany({ where: { id: d.id }, data: { ...d.fields, updatedAt: new Date() } });
      if (r.count !== 1) throw new Error(`Descendant ${d.id} update touched ${r.count} rows — rolling back.`);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log(`COMMITTED: 1 downline row + ${descendantUpdates.length} descendant row(s) updated.\n`);

  // --- Verify from DB ------------------------------------------------------
  const after = await prisma.user.findUnique({ where: { id: down.id }, select: LINEAGE_SELECT });
  console.log("AFTER (re-read from DB):\n");
  print("DOWNLINE", after);
  console.log();

  const directCount = await prisma.user.count({ where: { referredById: up.id } });
  const nowVisible = await prisma.user.findFirst({ where: { id: down.id, referredById: up.id }, select: { id: true } });
  console.log("VERIFICATION:");
  console.log(`   downline appears in UPLINE directs (referredById=${up.id.slice(0, 8)}…)? ${nowVisible ? "YES ✅" : "NO ❌"}`);
  console.log(`   UPLINE total direct count now: ${directCount}`);
  console.log("   (Ledger untouched — Client/Transaction/balance/P-L were never in scope.)");
}

main()
  .catch((e) => { console.error("\nERROR (no partial write — transaction rolled back):", e?.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

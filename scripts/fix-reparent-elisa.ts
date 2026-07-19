/**
 * SURGICAL single-user re-parent (CLI wrapper). All logic lives in
 * src/lib/reparent.ts — the SAME code the admin HTTP route uses, so the two
 * paths can never diverge. Dry-run by default; writes only on CONFIRM=true.
 *
 * Usage:
 *   Dry-run (default):
 *     DOWNLINE=asilehsarem@gmail.com UPLINE=alejandro152@gmail.com \
 *       pnpm tsx scripts/fix-reparent-elisa.ts
 *   Apply (only after dry-run approved):
 *     DOWNLINE=asilehsarem@gmail.com UPLINE=alejandro152@gmail.com CONFIRM=true \
 *       pnpm tsx scripts/fix-reparent-elisa.ts
 */
import { PrismaClient } from "@prisma/client";
import { reparent } from "../src/lib/reparent";

const prisma = new PrismaClient();
const DOWNLINE = process.env.DOWNLINE || "asilehsarem@gmail.com";
const UPLINE = process.env.UPLINE || "alejandro152@gmail.com";
const CONFIRM = process.env.CONFIRM === "true";

async function main() {
  console.log(`=== SURGICAL RE-PARENT ${CONFIRM ? "(APPLY / CONFIRM=true)" : "(DRY-RUN)"} ===\n`);
  const result = await reparent(prisma, { downlineEmail: DOWNLINE, uplineEmail: UPLINE, confirm: CONFIRM });

  console.log(`status : ${result.status}`);
  console.log(`message: ${result.message}\n`);

  if (result.before) {
    const b = result.before as any;
    console.log("BEFORE (downline):");
    console.log(`  referredById  = ${b.referredById ?? "(null)"}`);
    console.log(`  referralPath  = ${b.referralPath ?? "(null)"}`);
    console.log(`  referralDepth = ${b.referralDepth}`);
    console.log(`  rootSponsorId = ${b.rootSponsorId ?? "(null)"}`);
    console.log(`  (email=${b.email} username=${b.username ?? "(null)"} referralCode=${b.referralCode ?? "(null)"} — never modified)\n`);
  }
  if (result.after) {
    console.log("AFTER (proposed — 4 columns only):");
    console.log(`  referredById  = ${result.after.referredById}`);
    console.log(`  referralPath  = ${result.after.referralPath}`);
    console.log(`  referralDepth = ${result.after.referralDepth}`);
    console.log(`  rootSponsorId = ${result.after.rootSponsorId}\n`);
  }
  console.log(`Descendants to recompute (scoped subtree): ${result.descendants}\n`);

  if (result.status === "DRY_RUN") {
    console.log("DRY-RUN OK — pass CONFIRM=true to apply. Nothing was written.");
  } else if (result.status === "APPLIED" && result.verification) {
    console.log("VERIFICATION:");
    console.log(`  downline now appears under upline? ${result.verification.visibleUnderUpline ? "YES ✅" : "NO ❌"}`);
    console.log(`  upline total direct count now: ${result.verification.uplineDirectCount}`);
    console.log("  (Ledger untouched — Client/Transaction/balance/P-L were never in scope.)");
  }

  if (!result.ok && result.status !== "IDEMPOTENT_NOOP") process.exitCode = 1;
}

main()
  .catch((e) => { console.error("\nERROR (no partial write — transaction rolled back):", e?.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

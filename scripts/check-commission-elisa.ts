/**
 * READ-ONLY: did the upline ever get the referral commission for the downline's
 * package activation? Reports only — creates nothing.
 *
 * Schema mapping (this app has no `sourceUserId`/`beneficiaryId` columns):
 *   L1 direct commission  -> ReferralCommission { referrerId (beneficiary),
 *                                                  referredUserId (source) }
 *   L2 indirect commission-> Level2Commission   { earnerId (beneficiary),
 *                                                  sourceUserId (source) }
 *
 * Usage (needs the production DATABASE_URL in env):
 *   DOWNLINE=asilehsarem@gmail.com UPLINE=alejandro152@gmail.com \
 *     pnpm tsx scripts/check-commission-elisa.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DOWNLINE = (process.env.DOWNLINE || "asilehsarem@gmail.com").toLowerCase();
const UPLINE = (process.env.UPLINE || "alejandro152@gmail.com").toLowerCase();

async function main() {
  console.log("=== READ-ONLY COMMISSION CHECK (creates nothing) ===\n");

  const [down, up] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: DOWNLINE, mode: "insensitive" } },
      select: { id: true, email: true, name: true, clientId: true },
    }),
    prisma.user.findFirst({
      where: { email: { equals: UPLINE, mode: "insensitive" } },
      select: { id: true, email: true, name: true },
    }),
  ]);

  if (!down) { console.log(`DOWNLINE ${DOWNLINE} not found — aborting.`); return; }
  if (!up) { console.log(`UPLINE ${UPLINE} not found — aborting.`); return; }
  console.log(`DOWNLINE (source)     : ${down.name} <${down.email}>  id=${down.id}`);
  console.log(`UPLINE (beneficiary)  : ${up.name} <${up.email}>  id=${up.id}\n`);

  // Context: her approved deposits (the "$50 activation").
  let approvedTotal = 0;
  if (down.clientId) {
    const deps = await prisma.transaction.findMany({
      where: { clientId: down.clientId, type: "DEPOSIT", status: "APPROVED" },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    approvedTotal = deps.reduce((s, d) => s + d.amount, 0);
    console.log(`Downline approved deposits: ${deps.length} totaling $${approvedTotal.toFixed(2)}`);
    for (const d of deps) console.log(`   - ${d.createdAt.toISOString()}  $${d.amount.toFixed(2)}`);
    console.log();
  }

  // L1 — did THIS upline get a direct commission for THIS downline's activation?
  const l1All = await prisma.referralCommission.findMany({
    where: { referredUserId: down.id },
    select: { id: true, referrerId: true, status: true, commission: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const l1ToUpline = l1All.filter((c) => c.referrerId === up.id);
  console.log("L1 (ReferralCommission) for downline's activation:");
  console.log(`   rows to THIS upline (referrerId=${up.id.slice(0, 8)}…): ${l1ToUpline.length}`);
  console.log(`   rows to ANY referrer for this downline               : ${l1All.length}`);
  for (const c of l1All) {
    const who = c.referrerId === up.id ? "UPLINE" : `other:${c.referrerId.slice(0, 8)}…`;
    console.log(`     - ${c.createdAt.toISOString()}  ${who}  ${c.status}  $${c.commission.toFixed(2)}`);
  }
  console.log();

  // L2 — indirect commissions sourced from the downline (for completeness).
  const l2 = await prisma.level2Commission.findMany({
    where: { sourceUserId: down.id },
    select: { earnerId: true, commissionAmount: true, createdAt: true },
  }).catch(() => []);
  console.log(`L2 (Level2Commission) sourced from downline: ${l2.length} row(s)`);
  console.log();

  // Verdict
  console.log("=== VERDICT ===");
  if (l1ToUpline.length === 0) {
    console.log("L1 commission MISSING for the $50 package — the upline never received a");
    console.log("direct commission for this downline. NEEDS A SEPARATE CORRECTION.");
    console.log("(Not auto-created here — report only, per instructions.)");
  } else {
    const paid = l1ToUpline.filter((c) => c.status === "PAID").length;
    console.log(`L1 commission present: ${l1ToUpline.length} row(s) to the upline (${paid} PAID).`);
    console.log("No commission correction needed for the re-parent.");
  }
}

main()
  .catch((e) => { console.error("CHECK ERROR:", e?.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

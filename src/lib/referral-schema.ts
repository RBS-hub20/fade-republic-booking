/**
 * Idempotent DDL that provisions the referral schema. Kept as plain statements
 * so it can run either at build time (scripts/db-deploy.mjs) or at RUNTIME via
 * /api/referrals/migrate — the latter uses the app's live DATABASE_URL, which is
 * reachable even when the build environment can't reach the DB over DIRECT_URL.
 *
 * Every statement uses IF NOT EXISTS, so running it repeatedly is a safe no-op.
 */
export const REFERRAL_DDL: string[] = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionBalance" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode")`,
  `CREATE TABLE IF NOT EXISTS "ReferralCommission" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "referrerId" TEXT NOT NULL,
     "referredUserId" TEXT NOT NULL,
     "referredName" TEXT NOT NULL,
     "packageLabel" TEXT NOT NULL,
     "packageAmount" DOUBLE PRECISION NOT NULL,
     "commission" DOUBLE PRECISION NOT NULL,
     "status" TEXT NOT NULL DEFAULT 'PENDING',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "paidAt" TIMESTAMP(3)
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommission_referredUserId_key" ON "ReferralCommission"("referredUserId")`,
  `CREATE INDEX IF NOT EXISTS "ReferralCommission_referrerId_idx" ON "ReferralCommission"("referrerId")`,
  `CREATE TABLE IF NOT EXISTS "CommissionWithdrawal" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "userId" TEXT NOT NULL,
     "amount" DOUBLE PRECISION NOT NULL,
     "address" TEXT NOT NULL,
     "network" TEXT NOT NULL,
     "status" TEXT NOT NULL DEFAULT 'PENDING',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "CommissionWithdrawal_userId_idx" ON "CommissionWithdrawal"("userId")`,
];

type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

/**
 * Apply the referral DDL over the given Prisma client. Returns a per-statement
 * report; individual failures are captured rather than thrown so one hiccup
 * doesn't abort the rest.
 */
export async function applyReferralSchema(
  db: RawRunner
): Promise<{ applied: number; failures: { sql: string; error: string }[] }> {
  let applied = 0;
  const failures: { sql: string; error: string }[] = [];
  for (const sql of REFERRAL_DDL) {
    try {
      await db.$executeRawUnsafe(sql);
      applied += 1;
    } catch (e: any) {
      failures.push({ sql: sql.split("\n")[0].trim(), error: e?.message?.split("\n")[0] ?? "failed" });
    }
  }
  return { applied, failures };
}

// One-time-per-process runtime self-heal guard. If the build-time migration
// never reached the DB (e.g. Vercel build can't connect over DIRECT_URL), the
// first request that touches the User/referral schema applies the idempotent
// DDL over the app's live connection. Shared so signup, the dashboard, and any
// other entry point converge on the same guarantee.
let schemaHealed = false;
export async function ensureReferralSchemaOnce(db: RawRunner): Promise<void> {
  if (schemaHealed) return;
  const { failures } = await applyReferralSchema(db);
  // Only latch as healed when everything applied cleanly; otherwise a later
  // request retries (covers transient DB errors / partial application).
  if (failures.length === 0) {
    schemaHealed = true;
  } else {
    console.error("[referral-schema] self-heal incomplete:", failures);
  }
}

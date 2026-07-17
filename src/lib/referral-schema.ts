/**
 * Idempotent DDL that provisions the referral schema. Kept as plain statements
 * so it can run either at build time (scripts/db-deploy.mjs) or at RUNTIME via
 * /api/referrals/migrate — the latter uses the app's live DATABASE_URL, which is
 * reachable even when the build environment can't reach the DB over DIRECT_URL.
 *
 * Every statement uses IF NOT EXISTS, so running it repeatedly is a safe no-op.
 */
import { runDdlBatch, type RawRunner } from "./schema-ddl";

export const REFERRAL_DDL: string[] = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionBalance" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode")`,
  // Genealogy / lineage (materialized-path). text_pattern_ops lets the btree
  // serve fast prefix scans for downline queries (referralPath LIKE 'a/b/%').
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralPath" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralDepth" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rootSponsorId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "User_referralPath_idx" ON "User"("referralPath" text_pattern_ops)`,
  `CREATE INDEX IF NOT EXISTS "User_referralDepth_idx" ON "User"("referralDepth")`,
  `CREATE INDEX IF NOT EXISTS "User_rootSponsorId_idx" ON "User"("rootSponsorId")`,
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
  // Commissions are UNLIMITED (repeat on every purchase/renewal), so the old
  // one-per-referred-user unique index must be dropped; a plain index replaces it.
  `DROP INDEX IF EXISTS "ReferralCommission_referredUserId_key"`,
  `CREATE INDEX IF NOT EXISTS "ReferralCommission_referredUserId_idx" ON "ReferralCommission"("referredUserId")`,
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
  `CREATE TABLE IF NOT EXISTS "UserUnlock" (
     "userId" TEXT NOT NULL PRIMARY KEY,
     "level2Unlocked" BOOLEAN NOT NULL DEFAULT false,
     "unlockedAt" TIMESTAMP(3),
     "activeDirectsCount" INTEGER NOT NULL DEFAULT 0,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS "Level2Commission" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "earnerId" TEXT NOT NULL,
     "sourceUserId" TEXT NOT NULL,
     "directUplineId" TEXT,
     "depositAmount" DOUBLE PRECISION NOT NULL,
     "commissionRate" DOUBLE PRECISION NOT NULL,
     "commissionAmount" DOUBLE PRECISION NOT NULL,
     "uplineTierAtTime" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  // 2nd-level commissions are UNLIMITED too — drop the one-per-source unique
  // index in favour of a plain index.
  `DROP INDEX IF EXISTS "Level2Commission_sourceUserId_key"`,
  `CREATE INDEX IF NOT EXISTS "Level2Commission_sourceUserId_idx" ON "Level2Commission"("sourceUserId")`,
  `CREATE INDEX IF NOT EXISTS "Level2Commission_earnerId_idx" ON "Level2Commission"("earnerId")`,
  `CREATE TABLE IF NOT EXISTS "MonthlyBonus" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "userId" TEXT NOT NULL,
     "monthYear" TEXT NOT NULL,
     "totalDirectsPl" DOUBLE PRECISION NOT NULL,
     "bonusRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
     "bonusAmount" DOUBLE PRECISION NOT NULL,
     "directsCount" INTEGER NOT NULL,
     "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyBonus_userId_monthYear_key" ON "MonthlyBonus"("userId", "monthYear")`,
  `CREATE INDEX IF NOT EXISTS "MonthlyBonus_userId_idx" ON "MonthlyBonus"("userId")`,
];

/**
 * Apply the referral DDL over the given Prisma client. Returns a per-statement
 * report; individual failures are captured rather than thrown so one hiccup
 * doesn't abort the rest. Batched into a single round trip (see runDdlBatch).
 */
export async function applyReferralSchema(
  db: RawRunner
): Promise<{ applied: number; failures: { sql: string; error: string }[] }> {
  return runDdlBatch(db, REFERRAL_DDL);
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

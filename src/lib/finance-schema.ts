/**
 * Idempotent DDL for the capital-lock / withdrawal tables, applied at RUNTIME
 * over the app's live DATABASE_URL. Mirrors the referral/chat self-heal: the
 * Vercel build can't always reach the DB over DIRECT_URL, so build-time
 * migrations may not apply. The first finance request ensures these exist.
 */
import { runDdlBatch, type RawRunner } from "./schema-ddl";

export const FINANCE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "Withdrawal" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "userId" TEXT NOT NULL,
     "clientId" TEXT,
     "amount" DOUBLE PRECISION NOT NULL,
     "fee" DOUBLE PRECISION NOT NULL,
     "receiveAmount" DOUBLE PRECISION NOT NULL,
     "network" TEXT NOT NULL,
     "address" TEXT NOT NULL,
     "status" TEXT NOT NULL DEFAULT 'pending',
     "txHash" TEXT,
     "rejectReason" TEXT,
     "adminId" TEXT,
     "processedAt" TIMESTAMP(3),
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "Withdrawal_userId_status_idx" ON "Withdrawal"("userId", "status")`,
  `CREATE INDEX IF NOT EXISTS "Withdrawal_status_idx" ON "Withdrawal"("status")`,
  `CREATE TABLE IF NOT EXISTS "CapitalAction" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "transactionId" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "clientId" TEXT,
     "action" TEXT NOT NULL,
     "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "CapitalAction_transactionId_idx" ON "CapitalAction"("transactionId")`,
  `CREATE INDEX IF NOT EXISTS "CapitalAction_userId_idx" ON "CapitalAction"("userId")`,
];

let schemaHealed = false;
export async function ensureFinanceSchemaOnce(db: RawRunner): Promise<void> {
  if (schemaHealed) return;
  const { failures } = await runDdlBatch(db, FINANCE_DDL);
  if (failures.length === 0) schemaHealed = true;
  else console.error("[finance-schema] self-heal incomplete:", failures);
}

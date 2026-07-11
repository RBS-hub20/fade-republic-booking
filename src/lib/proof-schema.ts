/**
 * Idempotent runtime DDL for the ProofFile table (Vercel Blob proof audit).
 * Mirrors the other self-heal guards: the first request that touches proofs
 * ensures the table exists over the live DATABASE_URL.
 */
type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

export const PROOF_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "ProofFile" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "kind" TEXT NOT NULL,
     "refId" TEXT NOT NULL,
     "uploaderId" TEXT,
     "clientId" TEXT,
     "network" TEXT,
     "txHash" TEXT,
     "url" TEXT NOT NULL,
     "pathname" TEXT NOT NULL,
     "contentType" TEXT NOT NULL,
     "size" INTEGER NOT NULL DEFAULT 0,
     "originalName" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "ProofFile_kind_refId_idx" ON "ProofFile"("kind", "refId")`,
  `CREATE INDEX IF NOT EXISTS "ProofFile_createdAt_idx" ON "ProofFile"("createdAt")`,
];

let healed = false;
export async function ensureProofSchemaOnce(db: RawRunner): Promise<void> {
  if (healed) return;
  let allOk = true;
  for (const sql of PROOF_DDL) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e) {
      allOk = false;
      console.error("[proof-schema] statement failed:", e);
    }
  }
  if (allOk) healed = true;
}

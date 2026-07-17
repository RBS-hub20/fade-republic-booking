/**
 * Idempotent runtime DDL for the ProofFile table (Vercel Blob proof audit).
 * Mirrors the other self-heal guards: the first request that touches proofs
 * ensures the table exists over the live DATABASE_URL.
 */
import { runDdlBatch, type RawRunner } from "./schema-ddl";

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
  const { failures } = await runDdlBatch(db, PROOF_DDL);
  if (failures.length === 0) healed = true;
  else console.error("[proof-schema] self-heal incomplete:", failures);
}

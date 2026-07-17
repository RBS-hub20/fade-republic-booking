/**
 * Idempotent DDL for the AI support chat log, applied at RUNTIME over the app's
 * live DATABASE_URL. Mirrors the referral-schema self-heal: the Vercel build
 * can't always reach the DB over DIRECT_URL, so build-time migrations may not
 * apply. The first chat request ensures the table exists.
 */
import { runDdlBatch, type RawRunner } from "./schema-ddl";

export const CHAT_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "ChatMessage" (
     "id" TEXT NOT NULL PRIMARY KEY,
     "userId" TEXT NOT NULL,
     "clientId" TEXT,
     "role" TEXT NOT NULL,
     "content" TEXT NOT NULL,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "ChatMessage_userId_idx" ON "ChatMessage"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt")`,
];

let schemaHealed = false;
export async function ensureChatSchemaOnce(db: RawRunner): Promise<void> {
  if (schemaHealed) return;
  const { failures } = await runDdlBatch(db, CHAT_DDL);
  if (failures.length === 0) schemaHealed = true;
  else console.error("[chat-schema] self-heal incomplete:", failures);
}

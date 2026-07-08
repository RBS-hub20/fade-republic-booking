/**
 * Idempotent DDL for the AI support chat log, applied at RUNTIME over the app's
 * live DATABASE_URL. Mirrors the referral-schema self-heal: the Vercel build
 * can't always reach the DB over DIRECT_URL, so build-time migrations may not
 * apply. The first chat request ensures the table exists.
 */
type RawRunner = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

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
  let allOk = true;
  for (const sql of CHAT_DDL) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e) {
      allOk = false;
      console.error("[chat-schema] statement failed:", e);
    }
  }
  if (allOk) schemaHealed = true;
}

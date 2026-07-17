/**
 * EmailLog: a lightweight delivery log for transactional emails, provisioned by
 * a runtime self-heal (the build can't always reach the DB). Writes are
 * best-effort — logging must never break a send.
 */
import { prisma } from "./prisma";
import { runDdlBatch } from "./schema-ddl";

const EMAILLOG_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "EmailLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "type" TEXT NOT NULL,
      "resendId" TEXT,
      "to" TEXT,
      "subject" TEXT,
      "status" TEXT NOT NULL DEFAULT 'sent',
      "error" TEXT,
      "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  `CREATE INDEX IF NOT EXISTS "EmailLog_userId_idx" ON "EmailLog"("userId")`,
  `CREATE INDEX IF NOT EXISTS "EmailLog_type_idx" ON "EmailLog"("type")`,
];

let schemaHealed = false;
export async function ensureEmailLogSchemaOnce(): Promise<void> {
  if (schemaHealed) return;
  const { failures } = await runDdlBatch(prisma, EMAILLOG_DDL);
  if (failures.length === 0) schemaHealed = true;
  else console.error("[email-log] self-heal incomplete:", failures);
}

export interface LogEmailEntry {
  userId?: string | null;
  type: string;
  to: string;
  subject: string;
  status: "sent" | "failed";
  resendId?: string;
  error?: string;
}

/** Record a send. Never throws. */
export async function logEmail(entry: LogEmailEntry): Promise<void> {
  try {
    await ensureEmailLogSchemaOnce();
    await prisma.emailLog.create({
      data: {
        userId: entry.userId ?? null,
        type: entry.type,
        to: entry.to,
        subject: entry.subject,
        status: entry.status,
        resendId: entry.resendId ?? null,
        error: entry.error ?? null,
      },
    });
  } catch (e) {
    console.error("[email-log] write failed:", e);
  }
}

/** Admin: most recent email log rows (newest first). */
export async function getEmailLogs(limit = 200) {
  await ensureEmailLogSchemaOnce();
  return prisma.emailLog
    .findMany({ orderBy: { sentAt: "desc" }, take: limit })
    .catch(() => [] as Awaited<ReturnType<typeof prisma.emailLog.findMany>>);
}

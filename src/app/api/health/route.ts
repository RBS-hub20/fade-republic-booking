import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FROM_EMAIL, emailConfigured } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sanitized health/diagnostics endpoint. Reports whether the environment is
 * wired correctly WITHOUT leaking any secrets or connection strings — only
 * booleans, counts, and short error codes. Useful for verifying a deployment.
 *
 *   GET /api/health
 */
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    EMAIL_FROM: FROM_EMAIL,
    emailConfigured: emailConfigured(),
  };

  const db: {
    connected: boolean;
    userTable: boolean;
    userCount?: number;
    clientCount?: number;
    error?: string;
  } = { connected: false, userTable: false };

  try {
    // Connectivity check.
    await prisma.$queryRaw`SELECT 1`;
    db.connected = true;

    // Schema check (does the app's tables exist?).
    try {
      db.userCount = await prisma.user.count();
      db.clientCount = await prisma.client.count();
      db.userTable = true;
    } catch (e: any) {
      db.userTable = false;
      // e.g. P2021 = table does not exist → schema not pushed.
      db.error = e?.code ? `${e.code}: schema not initialized (run prisma db push / redeploy)` : "schema check failed";
    }
  } catch (e: any) {
    // Don't leak host/credentials — report the Prisma code + a friendly hint.
    const code = e?.code as string | undefined;
    const hint =
      code === "P1001"
        ? "cannot reach database server"
        : code === "P1000"
        ? "authentication failed"
        : !process.env.DATABASE_URL
        ? "DATABASE_URL is not set"
        : "database connection failed";
    db.error = code ? `${code}: ${hint}` : hint;
  }

  const ok = db.connected && db.userTable;
  return NextResponse.json(
    { ok, db, env, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}

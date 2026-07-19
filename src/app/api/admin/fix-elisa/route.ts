import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { reparent } from "@/lib/reparent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-off maintenance endpoint to re-parent an orphaned affiliate from within
 * the deployed environment (which has DB access), as an alternative to the CLI
 * scripts/fix-reparent-elisa.ts. Same single source of truth (src/lib/reparent).
 *
 * SECURITY — this MUTATES real-money affiliate data, so unlike the fail-OPEN
 * cron endpoints it FAILS CLOSED: a caller must present the ADMIN_SECRET via the
 * `x-admin-secret` header OR be an authenticated admin session. If ADMIN_SECRET
 * is unset AND there is no admin session, every write is refused.
 *
 * DRY-RUN by default. The POST only writes when the body/query says
 * confirm=true. Remove this route after the fix is applied — it should not be a
 * standing backdoor.
 *
 *   GET  /api/admin/fix-elisa                      -> health check (no writes)
 *   POST /api/admin/fix-elisa   (x-admin-secret)   -> dry-run plan
 *   POST /api/admin/fix-elisa?confirm=true         -> apply (guarded, transactional)
 */

const DEFAULT_DOWNLINE = "asilehsarem@gmail.com";
const DEFAULT_UPLINE = "alejandro152@gmail.com";

function authorize(req: Request): { ok: boolean; via: string } {
  const secret = process.env.ADMIN_SECRET;
  const provided = req.headers.get("x-admin-secret");
  // Constant-ish check; require a non-empty configured secret to match.
  if (secret && provided && provided === secret) return { ok: true, via: "x-admin-secret" };
  if (getSession()?.role === "admin") return { ok: true, via: "admin-session" };
  return { ok: false, via: "none" };
}

export async function GET() {
  const adminSecretPresent = Boolean(process.env.ADMIN_SECRET);
  // Log presence only — never the value.
  console.log("[fix-elisa] GET health check; ADMIN_SECRET present:", adminSecretPresent);
  return NextResponse.json({
    status: "fix-elisa route alive",
    method: "use POST with x-admin-secret (dry-run by default; add ?confirm=true to apply)",
    adminSecretConfigured: adminSecretPresent,
  });
}

export async function POST(req: Request) {
  const adminSecretPresent = Boolean(process.env.ADMIN_SECRET);
  console.log("[fix-elisa] POST; ADMIN_SECRET present:", adminSecretPresent);

  const auth = authorize(req);
  if (!auth.ok) {
    console.warn("[fix-elisa] REJECT: unauthorized (need x-admin-secret or admin session)");
    return NextResponse.json(
      { error: "Unauthorized — provide a valid x-admin-secret header or sign in as admin.", adminSecretConfigured: adminSecretPresent },
      { status: 401 }
    );
  }

  // Params: JSON body OR query string. confirm must be an explicit true.
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as any));
  const downlineEmail = String(body.downline ?? url.searchParams.get("downline") ?? DEFAULT_DOWNLINE);
  const uplineEmail = String(body.upline ?? url.searchParams.get("upline") ?? DEFAULT_UPLINE);
  const confirm = body.confirm === true || url.searchParams.get("confirm") === "true";

  try {
    const result = await reparent(prisma, { downlineEmail, uplineEmail, confirm });
    console.log(`[fix-elisa] via=${auth.via} status=${result.status} applied=${result.applied}`);
    // Guard/no-op outcomes that aren't "ok" map to 422 so callers notice.
    const httpStatus = result.ok ? 200 : 422;
    return NextResponse.json(result, { status: httpStatus });
  } catch (err: any) {
    console.error("[fix-elisa] ERROR (transaction rolled back):", err?.message ?? err);
    return NextResponse.json(
      { ok: false, status: "ERROR", message: err?.message?.split("\n")[0] ?? "re-parent failed", applied: false },
      { status: 500 }
    );
  }
}

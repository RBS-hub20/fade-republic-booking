import { NextResponse } from "next/server";
import { enforce } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import {
  normalizeUsername,
  validateUsernameFormat,
  isUsernameAvailable,
  ensureUsernameSchemaOnce,
} from "@/lib/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Real-time username availability for the signup / claim forms.
 *   GET /api/auth/username-available?u=<name>
 * Rate limited to 10/min per IP to deter enumeration.
 */
export async function GET(req: Request) {
  const limited = enforce(req, "username-check", 10, 60_000);
  if (limited) return limited;

  const u = normalizeUsername(new URL(req.url).searchParams.get("u") || "");
  const fmt = validateUsernameFormat(u);
  if (!fmt.ok) return NextResponse.json({ available: false, reason: fmt.error });

  try {
    await ensureUsernameSchemaOnce(prisma);
    const available = await isUsernameAvailable(u);
    return NextResponse.json({ available, reason: available ? undefined : "Username already taken" });
  } catch {
    // Never surface internals; treat as indeterminate.
    return NextResponse.json({ available: false, reason: "Could not check right now." });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { enforce } from "@/lib/rate-limit";
import {
  normalizeUsername,
  validateUsernameFormat,
  isUsernameAvailable,
  ensureUsernameSchemaOnce,
} from "@/lib/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Claim/change the username — allowed ONCE (until usernameSet becomes true). */
export async function POST(req: Request) {
  const limited = enforce(req, "username-claim", 10, 60_000);
  if (limited) return limited;

  const session = getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to set your username." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const username = normalizeUsername(String(body?.username ?? ""));
  const fmt = validateUsernameFormat(username);
  if (!fmt.ok) return NextResponse.json({ error: fmt.error }, { status: 400 });

  try {
    await ensureUsernameSchemaOnce(prisma);

    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { usernameSet: true },
    });
    if (!me) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (me.usernameSet) {
      return NextResponse.json({ error: "Your username is already set and can't be changed." }, { status: 403 });
    }

    if (!(await isUsernameAvailable(username, session.userId))) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { username, usernameSet: true },
    });
    return NextResponse.json({ ok: true, username });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    console.error("[username claim] error:", e);
    return NextResponse.json({ error: "Could not set username. Please try again." }, { status: 500 });
  }
}

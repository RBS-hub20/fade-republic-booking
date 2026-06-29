import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-config";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

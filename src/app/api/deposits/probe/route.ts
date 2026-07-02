import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDepositWallets } from "@/lib/payments";
import { probeBep20, fetchTrc20TransfersTo } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only live diagnostic: makes a real call to the configured chain APIs and
 * reports whether BEP20 (Etherscan V2 / BscScan) and TRC20 (TronGrid) auto-verify
 * are actually working. No secrets are returned.
 *
 *   GET /api/deposits/probe   (admin session)
 */
export async function GET() {
  const session = getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const wallets = getDepositWallets();
  const bep20Addr = wallets.find((w) => w.method === "USDT_BEP20")?.address ?? "";
  const trc20Addr = wallets.find((w) => w.method === "USDT_TRC20")?.address ?? "";

  const bep20 = await probeBep20(bep20Addr);

  let trc20: { ok: boolean; count: number; message: string };
  try {
    const m = await fetchTrc20TransfersTo(trc20Addr);
    trc20 = { ok: true, count: m.size, message: "OK" };
  } catch (e: any) {
    trc20 = { ok: false, count: 0, message: e?.message ?? "request failed" };
  }

  return NextResponse.json({ bep20, trc20, at: new Date().toISOString() });
}

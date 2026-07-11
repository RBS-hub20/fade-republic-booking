import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isValidTxid } from "@/lib/tx-validation";
import { verifyTxOnChain } from "@/lib/tx-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client-facing on-chain lookup for the deposit proof UI (same engine as the
 * admin withdrawal check). Convenience only — crediting still happens through
 * the server verification in /api/deposits/txid + status polling.
 *
 *   GET /api/deposits/verify-tx?network=USDT_TRC20|USDT_BEP20&hash=<txid>
 */
export async function GET(req: Request) {
  const session = getSession();
  if (!session?.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const network = url.searchParams.get("network") || "";
  const hash = (url.searchParams.get("hash") || "").trim();

  if (!isValidTxid(network, hash)) {
    return NextResponse.json({ status: "not_found", confirmations: 0, error: "Invalid hash format" }, { status: 400 });
  }
  return NextResponse.json(await verifyTxOnChain(network, hash));
}

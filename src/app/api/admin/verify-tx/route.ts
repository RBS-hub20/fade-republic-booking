import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isValidTxid } from "@/lib/tx-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Best-effort on-chain lookup of a single USDT transaction hash, used by the
 * admin proof modal for the "✓ Verified / ⏳ Pending / ⚠️ Not found" hint.
 *
 *   GET /api/admin/verify-tx?network=USDT_TRC20|USDT_BEP20&hash=<txid>
 *
 * Returns { status: "verified"|"pending"|"not_found"|"unknown", confirmations }.
 * "unknown" (degraded) when the explorer can't be reached or a key is missing —
 * the modal still lets the admin submit; this is only a convenience.
 */
async function fetchWithTimeout(url: string, ms = 8000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: Request) {
  if (getSession()?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const network = url.searchParams.get("network") || "";
  const hash = (url.searchParams.get("hash") || "").trim();

  if (!isValidTxid(network, hash)) {
    return NextResponse.json({ status: "not_found", confirmations: 0, error: "Invalid hash format" }, { status: 400 });
  }

  try {
    if (network === "USDT_TRC20") {
      const res = await fetchWithTimeout(
        `https://apilist.tronscan.org/api/transaction-info?hash=${hash}`
      );
      if (!res || !res.ok) return NextResponse.json({ status: "unknown", confirmations: 0 });
      const data: any = await res.json().catch(() => ({}));
      if (!data || !data.hash) return NextResponse.json({ status: "not_found", confirmations: 0 });
      const confirmed = data.confirmed === true || data.contractRet === "SUCCESS";
      const confirmations = Number(data.confirmations ?? (confirmed ? 20 : 0)) || (confirmed ? 20 : 0);
      return NextResponse.json({ status: confirmed ? "verified" : "pending", confirmations });
    }

    // BEP20 via BSCScan proxy (needs a key for reliable access).
    const key = process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
    const base = process.env.BSCSCAN_API_URL || "https://api.bscscan.com/api";
    if (!key) return NextResponse.json({ status: "unknown", confirmations: 0 });

    const txRes = await fetchWithTimeout(
      `${base}?module=proxy&action=eth_getTransactionByHash&txhash=${hash}&apikey=${key}`
    );
    if (!txRes || !txRes.ok) return NextResponse.json({ status: "unknown", confirmations: 0 });
    const tx: any = await txRes.json().catch(() => ({}));
    const result = tx?.result;
    if (!result) return NextResponse.json({ status: "not_found", confirmations: 0 });
    if (!result.blockNumber) return NextResponse.json({ status: "pending", confirmations: 0 });

    // Confirmations = current block − tx block.
    const blkRes = await fetchWithTimeout(`${base}?module=proxy&action=eth_blockNumber&apikey=${key}`);
    let confirmations = 1;
    if (blkRes && blkRes.ok) {
      const blk: any = await blkRes.json().catch(() => ({}));
      const cur = parseInt(blk?.result ?? "0x0", 16);
      const txb = parseInt(result.blockNumber, 16);
      if (cur > 0 && txb > 0) confirmations = Math.max(0, cur - txb + 1);
    }
    return NextResponse.json({ status: "verified", confirmations });
  } catch {
    return NextResponse.json({ status: "unknown", confirmations: 0 });
  }
}

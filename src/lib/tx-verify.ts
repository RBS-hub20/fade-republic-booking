/**
 * Best-effort on-chain lookup of a single USDT transaction hash (TRC20/BEP20).
 * Node runtime only (uses fetch to public explorers). Shared by the admin
 * withdrawal-proof endpoint and the client deposit-proof endpoint.
 *
 * Returns "unknown" (degraded, still actionable) when the explorer can't be
 * reached or a BEP20 key isn't configured — verification is a convenience, not
 * a gate.
 */
import { isValidTxid } from "./tx-validation";

export type TxVerifyStatus = "verified" | "pending" | "not_found" | "unknown";
export interface TxVerifyResult {
  status: TxVerifyStatus;
  confirmations: number;
}

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

export async function verifyTxOnChain(network: string, hash: string): Promise<TxVerifyResult> {
  const h = hash.trim();
  if (!isValidTxid(network, h)) return { status: "not_found", confirmations: 0 };

  try {
    if (network === "USDT_TRC20") {
      const res = await fetchWithTimeout(`https://apilist.tronscan.org/api/transaction-info?hash=${h}`);
      if (!res || !res.ok) return { status: "unknown", confirmations: 0 };
      const data: any = await res.json().catch(() => ({}));
      if (!data || !data.hash) return { status: "not_found", confirmations: 0 };
      const confirmed = data.confirmed === true || data.contractRet === "SUCCESS";
      const confirmations = Number(data.confirmations ?? (confirmed ? 20 : 0)) || (confirmed ? 20 : 0);
      return { status: confirmed ? "verified" : "pending", confirmations };
    }

    // BEP20 via BSCScan proxy (needs a key for reliable access).
    const key = process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
    const base = process.env.BSCSCAN_API_URL || "https://api.bscscan.com/api";
    if (!key) return { status: "unknown", confirmations: 0 };

    const txRes = await fetchWithTimeout(
      `${base}?module=proxy&action=eth_getTransactionByHash&txhash=${h}&apikey=${key}`
    );
    if (!txRes || !txRes.ok) return { status: "unknown", confirmations: 0 };
    const tx: any = await txRes.json().catch(() => ({}));
    const result = tx?.result;
    if (!result) return { status: "not_found", confirmations: 0 };
    if (!result.blockNumber) return { status: "pending", confirmations: 0 };

    const blkRes = await fetchWithTimeout(`${base}?module=proxy&action=eth_blockNumber&apikey=${key}`);
    let confirmations = 1;
    if (blkRes && blkRes.ok) {
      const blk: any = await blkRes.json().catch(() => ({}));
      const cur = parseInt(blk?.result ?? "0x0", 16);
      const txb = parseInt(result.blockNumber, 16);
      if (cur > 0 && txb > 0) confirmations = Math.max(0, cur - txb + 1);
    }
    return { status: "verified", confirmations };
  } catch {
    return { status: "unknown", confirmations: 0 };
  }
}

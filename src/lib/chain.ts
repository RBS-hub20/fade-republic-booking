/**
 * On-chain USDT deposit verification (BEP20 via BscScan, TRC20 via TronGrid).
 * Node runtime only. Pure fetch + matching helpers — the DB/approval logic
 * lives in the /api/deposits/verify route.
 *
 * Free API keys (optional but recommended):
 *   BSCSCAN_API_KEY   — https://bscscan.com/myapikey (required for BEP20 checks)
 *   TRONGRID_API_KEY  — https://www.trongrid.io/ (optional; higher rate limits)
 */

const BSCSCAN_URL = process.env.BSCSCAN_API_URL || "https://api.bscscan.com/api";
const TRONGRID_URL = process.env.TRONGRID_API_URL || "https://api.trongrid.io";

// USDT token contracts (override via env if ever needed).
export const USDT_BEP20_CONTRACT =
  process.env.USDT_BEP20_CONTRACT || "0x55d398326f99059fF775485246999027B3197955";
export const USDT_BEP20_DECIMALS = 18;

export const USDT_TRC20_CONTRACT =
  process.env.USDT_TRC20_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const USDT_TRC20_DECIMALS = 6;

export const MIN_CONFIRMATIONS_BEP20 = Number(process.env.MIN_CONFIRMATIONS_BEP20 || 6);

const FETCH_TIMEOUT = 10_000;

export interface OnChainTransfer {
  hash: string;
  to: string;
  amount: number;
  confirmations: number;
}

/** Convert a raw integer-string token amount to a decimal number (no BigInt). */
export function unitsToAmount(value: string, decimals: number): number {
  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) return 0;
  if (decimals <= 0) return Number(digits);
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals);
  return Number(`${whole}.${frac}`);
}

/** Pull the "TxHash: <hash>" token out of a request's notes. */
export function parseTxHash(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/TxHash:\s*([A-Za-z0-9x]+)/i);
  return m ? m[1].trim() : null;
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", ...headers },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Recent USDT (BEP20) transfers TO `address`, keyed by lowercased tx hash.
 * Returns null when BSCSCAN_API_KEY is not configured (BEP20 auto-verify off).
 */
export async function fetchBep20TransfersTo(
  address: string
): Promise<Map<string, OnChainTransfer> | null> {
  const apiKey = process.env.BSCSCAN_API_KEY;
  if (!apiKey) return null;

  const url =
    `${BSCSCAN_URL}?module=account&action=tokentx` +
    `&contractaddress=${USDT_BEP20_CONTRACT}` +
    `&address=${address}&page=1&offset=100&sort=desc&apikey=${apiKey}`;
  const data = await fetchJson(url);
  const map = new Map<string, OnChainTransfer>();
  if (data?.status !== "1" || !Array.isArray(data.result)) return map;

  const target = address.toLowerCase();
  const contract = USDT_BEP20_CONTRACT.toLowerCase();
  for (const t of data.result) {
    if (String(t.to).toLowerCase() !== target) continue;
    if (String(t.contractAddress).toLowerCase() !== contract) continue;
    const decimals = Number(t.tokenDecimal ?? USDT_BEP20_DECIMALS);
    map.set(String(t.hash).toLowerCase(), {
      hash: String(t.hash),
      to: String(t.to),
      amount: unitsToAmount(String(t.value), decimals),
      confirmations: Number(t.confirmations ?? 0),
    });
  }
  return map;
}

/**
 * Recent USDT (TRC20) transfers TO `address`, keyed by lowercased tx id.
 * TronGrid works without a key (lower limits); a key raises the limit.
 */
export async function fetchTrc20TransfersTo(
  address: string
): Promise<Map<string, OnChainTransfer>> {
  const headers: Record<string, string> = {};
  if (process.env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;

  const url =
    `${TRONGRID_URL}/v1/accounts/${address}/transactions/trc20` +
    `?only_to=true&limit=50&contract_address=${USDT_TRC20_CONTRACT}`;
  const data = await fetchJson(url, headers);
  const map = new Map<string, OnChainTransfer>();
  if (!Array.isArray(data?.data)) return map;

  const target = address;
  for (const t of data.data) {
    if (String(t.to) !== target) continue;
    const decimals = Number(t?.token_info?.decimals ?? USDT_TRC20_DECIMALS);
    const id = String(t.transaction_id).toLowerCase();
    map.set(id, {
      hash: String(t.transaction_id),
      to: String(t.to),
      amount: unitsToAmount(String(t.value), decimals),
      // TronGrid returns confirmed transfers; treat as final.
      confirmations: 999,
    });
  }
  return map;
}

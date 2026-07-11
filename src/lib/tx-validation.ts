/**
 * Client-safe USDT transaction helpers. We ONLY support TRC20 (Tron) and BEP20
 * (BNB Smart Chain) — no ERC20 or other networks.
 */
export type UsdtNetwork = "USDT_TRC20" | "USDT_BEP20";

export const USDT_NETWORKS: {
  value: UsdtNetwork;
  label: string;
  chain: string;
  feeUsd: number;
  txPlaceholder: string;
}[] = [
  { value: "USDT_TRC20", label: "TRC20 (Tron)", chain: "Tron", feeUsd: 1.0, txPlaceholder: "64 hex characters, no 0x" },
  { value: "USDT_BEP20", label: "BEP20 (BSC)", chain: "BNB Smart Chain", feeUsd: 0.3, txPlaceholder: "0x + 64 hex characters" },
];

export function networkLabel(network: string): string {
  return network === "USDT_TRC20" ? "TRC20" : "BEP20";
}

export function networkFeeUsd(network: string): number {
  return network === "USDT_TRC20" ? 1.0 : 0.3;
}

/** TRC20 = 64 hex (no 0x); BEP20 = 0x + 64 hex. */
export function isValidTxid(network: string, hash: string): boolean {
  const h = hash.trim();
  if (network === "USDT_BEP20") return /^0x[0-9a-fA-F]{64}$/.test(h);
  if (network === "USDT_TRC20") return /^[0-9a-fA-F]{64}$/.test(h);
  return false;
}

/** Inline validation feedback for a TXID against the selected network. */
export function txidFeedback(network: string, hash: string): { state: "empty" | "valid" | "invalid"; message: string } {
  const h = hash.trim();
  if (!h) return { state: "empty", message: "" };
  if (isValidTxid(network, h)) return { state: "valid", message: `Valid ${networkLabel(network)} format` };
  return { state: "invalid", message: `Invalid TXID format for ${networkLabel(network)}` };
}

export function explorerTxUrl(network: string, hash: string): string {
  const h = hash.trim();
  return network === "USDT_TRC20"
    ? `https://tronscan.org/#/transaction/${h}`
    : `https://bscscan.com/tx/${h}`;
}

export function explorerName(network: string): string {
  return network === "USDT_TRC20" ? "Tronscan" : "BSCScan";
}

/** Middle-truncate an address: TNPeeaa…q4Xk */
export function shortAddress(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

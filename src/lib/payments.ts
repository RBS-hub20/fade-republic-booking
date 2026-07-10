/**
 * Deposit gateway configuration (crypto receive wallets).
 *
 * Addresses come from env vars so they can be rotated without a code change;
 * the current QuantumX wallets are the fallbacks. These are RECEIVE addresses
 * (public by nature), so it's safe to send them to the client.
 *
 * Read this on the server and pass the result to client components as props.
 */
import type { TransactionMethod } from "./constants";

export interface DepositWallet {
  method: Extract<TransactionMethod, "USDT_BEP20" | "USDT_TRC20">;
  asset: "USDT";
  /** Full network name shown in the UI. */
  network: string;
  /** Short chip label. */
  networkShort: string;
  address: string;
  memoRequired: boolean;
  /** Explorer URL for the address (admin/client verification). */
  explorerUrl: string;
}

const BEP20_ADDRESS =
  process.env.DEPOSIT_USDT_BEP20_ADDRESS ||
  "0x57CaA8Cf4658bA49139f4e7cB2D2EBB8101C83c3";

const TRC20_ADDRESS =
  process.env.DEPOSIT_USDT_TRC20_ADDRESS ||
  "TNAnmDBcmmgdiAAX6GgGqV63RCrm2aqrqD";

export function getDepositWallets(): DepositWallet[] {
  return [
    {
      method: "USDT_BEP20",
      asset: "USDT",
      network: "BNB Smart Chain (BEP20)",
      networkShort: "BEP20",
      address: BEP20_ADDRESS,
      memoRequired: false,
      explorerUrl: `https://bscscan.com/address/${BEP20_ADDRESS}`,
    },
    {
      method: "USDT_TRC20",
      asset: "USDT",
      network: "Tron (TRC20)",
      networkShort: "TRC20",
      address: TRC20_ADDRESS,
      memoRequired: false,
      explorerUrl: `https://tronscan.org/#/address/${TRC20_ADDRESS}`,
    },
  ];
}

/** Bank transfer is "coming soon" until enabled. */
export const BANK_ENABLED = process.env.BANK_DEPOSITS_ENABLED === "true";

/** Per-request deposit limits (USD), env-overridable. Min $50 (Bronze tier). */
export function getDepositLimits(): { min: number; max: number } {
  const min = Number(process.env.DEPOSIT_MIN_USD || 50);
  const max = Number(process.env.DEPOSIT_MAX_USD || 10000);
  return {
    min: Number.isFinite(min) ? min : 50,
    max: Number.isFinite(max) ? max : 10000,
  };
}

/** Validate a transaction hash against the network format. */
export function isValidTxHashForNetwork(method: string, hash: string): boolean {
  const h = hash.trim();
  if (method === "USDT_BEP20") return /^0x[0-9a-fA-F]{64}$/.test(h);
  if (method === "USDT_TRC20") return /^[0-9a-fA-F]{64}$/.test(h);
  return /^[A-Za-z0-9x]{10,120}$/.test(h); // other methods: lenient
}

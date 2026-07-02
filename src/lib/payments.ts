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

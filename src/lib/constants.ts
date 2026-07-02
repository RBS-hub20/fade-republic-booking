/**
 * App-level "enums" for fields stored as strings in SQLite.
 * Single source of truth for allowed values + display metadata.
 */

export const CLIENT_STATUSES = ["ACTIVE", "PAUSED", "CLOSED"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const TRANSACTION_TYPES = ["DEPOSIT", "WITHDRAWAL"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_METHODS = ["BANK", "CRYPTO", "OTC"] as const;
export type TransactionMethod = (typeof TRANSACTION_METHODS)[number];

export const TRANSACTION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const STATUS_BADGE: Record<
  TransactionStatus,
  { label: string; variant: "outline" | "warning" | "danger" }
> = {
  APPROVED: { label: "Approved", variant: "outline" },
  PENDING: { label: "Pending", variant: "warning" },
  REJECTED: { label: "Rejected", variant: "danger" },
};

export const STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

export const METHOD_LABELS: Record<TransactionMethod, string> = {
  BANK: "Bank",
  CRYPTO: "Crypto",
  OTC: "OTC Desk",
};

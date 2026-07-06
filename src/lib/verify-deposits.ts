/**
 * Core on-chain deposit verification, shared by:
 *   - /api/deposits/verify  (admin / Vercel Cron — all pending)
 *   - /api/deposits/check   (a client polling their own pending deposits)
 *
 * Matches a pending USDT deposit's TxID against recent on-chain transfers to our
 * receive address and auto-approves it, crediting the actual on-chain amount.
 * Emails the client on approval (best-effort). Node runtime only.
 */
import { prisma } from "./prisma";
import { getDepositWallets } from "./payments";
import {
  fetchBep20TransfersTo,
  fetchTrc20TransfersTo,
  parseTxHash,
  MIN_CONFIRMATIONS_BEP20,
  type OnChainTransfer,
} from "./chain";
import { notifyDepositApproved } from "./mailers";
import { creditFirstPackageCommission } from "./referrals";

const AMOUNT_TOLERANCE = 0.99; // allow 1% slippage below requested

export interface VerifyResult {
  ok: true;
  checked: number;
  approved: number;
  bep20Enabled: boolean;
  details: { id: string; result: string; amount?: number }[];
  at: string;
}

export async function verifyPendingDeposits(opts?: { clientId?: string }): Promise<VerifyResult> {
  const wallets = getDepositWallets();
  const bep20 = wallets.find((w) => w.method === "USDT_BEP20");
  const trc20 = wallets.find((w) => w.method === "USDT_TRC20");

  const [bepMap, tronMap] = await Promise.all([
    bep20 ? fetchBep20TransfersTo(bep20.address).catch(() => null) : Promise.resolve(null),
    trc20 ? fetchTrc20TransfersTo(trc20.address).catch(() => new Map()) : Promise.resolve(new Map()),
  ]);

  const pending = await prisma.transaction.findMany({
    where: {
      status: "PENDING",
      type: "DEPOSIT",
      method: { in: ["USDT_BEP20", "USDT_TRC20"] },
      ...(opts?.clientId ? { clientId: opts.clientId } : {}),
    },
    orderBy: { date: "asc" },
    include: { client: true },
  });

  let approved = 0;
  const details: VerifyResult["details"] = [];
  const usedHashes = new Set<string>();

  for (const tx of pending) {
    const hash = parseTxHash(tx.notes)?.toLowerCase();
    if (!hash) {
      details.push({ id: tx.id, result: "no tx hash — leave pending" });
      continue;
    }

    const map: Map<string, OnChainTransfer> | null =
      tx.method === "USDT_BEP20" ? bepMap : tronMap;
    if (!map) {
      details.push({ id: tx.id, result: "verification unavailable (no API key)" });
      continue;
    }

    const transfer = map.get(hash);
    if (!transfer) {
      details.push({ id: tx.id, result: "tx not found on-chain yet" });
      continue;
    }
    if (tx.method === "USDT_BEP20" && transfer.confirmations < MIN_CONFIRMATIONS_BEP20) {
      details.push({ id: tx.id, result: `awaiting confirmations (${transfer.confirmations})` });
      continue;
    }
    if (transfer.amount < tx.amount * AMOUNT_TOLERANCE) {
      details.push({ id: tx.id, result: `underpaid: on-chain ${transfer.amount} < requested ${tx.amount}` });
      continue;
    }

    // Anti-replay: never credit the same tx hash twice.
    if (usedHashes.has(hash)) {
      details.push({ id: tx.id, result: "duplicate tx hash in batch" });
      continue;
    }
    const alreadyUsed = await prisma.transaction.count({
      where: { status: "APPROVED", notes: { contains: transfer.hash } },
    });
    if (alreadyUsed > 0) {
      details.push({ id: tx.id, result: "tx hash already credited" });
      continue;
    }

    const credited = Math.round(transfer.amount * 100) / 100;
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: "APPROVED",
        amount: credited,
        notes: `${tx.notes ?? ""} · ✓ auto-verified on-chain (${credited} USDT)`.slice(0, 500),
      },
    });
    usedHashes.add(hash);
    approved += 1;
    details.push({ id: tx.id, result: "approved", amount: credited });

    // Credit the referrer if this is the client's first tier activation.
    await creditFirstPackageCommission({ clientId: tx.clientId, amount: credited });

    // Best-effort notification (never blocks verification).
    if (tx.client) {
      notifyDepositApproved({
        email: tx.client.email,
        name: tx.client.name,
        amount: credited,
        method: tx.method,
        auto: true,
      }).catch(() => {});
    }
  }

  return {
    ok: true,
    checked: pending.length,
    approved,
    bep20Enabled: bepMap !== null,
    details,
    at: new Date().toISOString(),
  };
}

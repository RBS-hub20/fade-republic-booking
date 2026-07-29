import { prisma } from "./prisma";
import { parseTxHash } from "./chain";

/** The payment window shown on the deposit screen (client + server agree). */
export const DEPOSIT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Soft-expire ABANDONED deposits: a PENDING DEPOSIT older than the 30-minute
 * payment window with NO transaction hash submitted → status "EXPIRED".
 *
 * Safety:
 *  - Detection mirrors the app exactly (parseTxHash on notes), so a deposit that
 *    HAS a submitted TxHash is never expired — it stays PENDING for on-chain /
 *    admin confirmation.
 *  - Never touches APPROVED (credited) rows.
 *  - Soft status change only — no deletion. The ledger row is preserved for
 *    audit and for reconciling a late payment to the static shared address.
 *  - The updateMany re-guards on status=PENDING to avoid a race with approval.
 *
 * Scoped to one client (cheap, used on the client's own poll) or global
 * (used by the daily cron and the admin approvals load).
 */
export async function expireStaleDeposits(opts?: { clientId?: string }): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - DEPOSIT_WINDOW_MS);
  const candidates = await prisma.transaction.findMany({
    where: {
      type: "DEPOSIT",
      status: "PENDING",
      createdAt: { lt: cutoff },
      ...(opts?.clientId ? { clientId: opts.clientId } : {}),
    },
    select: { id: true, notes: true },
  });

  // Only those with NO submitted TxHash are abandoned.
  const staleIds = candidates.filter((c) => parseTxHash(c.notes) === null).map((c) => c.id);
  if (staleIds.length === 0) return { expired: 0 };

  const res = await prisma.transaction.updateMany({
    where: { id: { in: staleIds }, type: "DEPOSIT", status: "PENDING" },
    data: { status: "EXPIRED" },
  });
  return { expired: res.count };
}

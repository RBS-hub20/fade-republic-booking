import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getDepositWallets } from "@/lib/payments";
import {
  fetchBep20TransfersTo,
  fetchTrc20TransfersTo,
  parseTxHash,
  MIN_CONFIRMATIONS_BEP20,
  type OnChainTransfer,
} from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Accept up to 1% slippage below the requested amount (rounding/fees).
const AMOUNT_TOLERANCE = 0.99;

function authorized(req: Request): boolean {
  // 1) Vercel Cron / external caller with the shared secret.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  // 2) An admin triggering it manually from the dashboard.
  return getSession()?.role === "admin";
}

async function run() {
  const wallets = getDepositWallets();
  const bep20 = wallets.find((w) => w.method === "USDT_BEP20");
  const trc20 = wallets.find((w) => w.method === "USDT_TRC20");

  // Fetch recent on-chain transfers per network (best-effort).
  const [bepMap, tronMap] = await Promise.all([
    bep20 ? fetchBep20TransfersTo(bep20.address).catch(() => null) : Promise.resolve(null),
    trc20 ? fetchTrc20TransfersTo(trc20.address).catch(() => new Map()) : Promise.resolve(new Map()),
  ]);

  const pending = await prisma.transaction.findMany({
    where: { status: "PENDING", type: "DEPOSIT", method: { in: ["USDT_BEP20", "USDT_TRC20"] } },
    orderBy: { date: "asc" },
  });

  let approved = 0;
  const details: { id: string; result: string; amount?: number }[] = [];
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

    // Enough confirmations?
    if (tx.method === "USDT_BEP20" && transfer.confirmations < MIN_CONFIRMATIONS_BEP20) {
      details.push({ id: tx.id, result: `awaiting confirmations (${transfer.confirmations})` });
      continue;
    }

    // Correct amount (allow small slippage)?
    if (transfer.amount < tx.amount * AMOUNT_TOLERANCE) {
      details.push({
        id: tx.id,
        result: `underpaid: on-chain ${transfer.amount} < requested ${tx.amount}`,
      });
      continue;
    }

    // Anti-replay: don't credit the same hash twice.
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

    // Approve — credit the actual on-chain amount.
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

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

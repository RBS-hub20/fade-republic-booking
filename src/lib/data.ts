/**
 * Server-side data access + derived performance computations.
 * Pages call these to get fully-computed equity curves and KPIs.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  computeEquityCurve,
  computeKpis,
  type EquityPoint,
  type LedgerEntry,
  type PerformanceKpis,
} from "./performance";

type ClientWithRelations = Prisma.ClientGetPayload<{
  include: { transactions: true; dailyPerformances: true };
}>;

export interface ClientPerformance {
  client: ClientWithRelations;
  curve: EquityPoint[];
  kpis: PerformanceKpis;
}

/** All clients with a lightweight computed current balance for the list view. */
export async function getClientsWithBalance() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      transactions: { where: { status: "APPROVED" } },
      dailyPerformances: { orderBy: { date: "asc" } },
    },
  });

  return clients.map((c) => {
    const curve = computeEquityCurve({
      initialDeposit: c.initialDeposit,
      startDate: c.startDate,
      ledger: c.transactions.map((t) => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
      })),
      performances: c.dailyPerformances.map((p) => ({
        date: p.date,
        dailyPercent: p.dailyPercent,
      })),
    });
    const kpis = computeKpis({
      initialDeposit: c.initialDeposit,
      ledger: c.transactions.map((t) => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
      })),
      curve,
    });
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      accountNumber: c.accountNumber,
      initialDeposit: c.initialDeposit,
      startDate: c.startDate,
      status: c.status,
      currentBalance: kpis.currentBalance,
      totalNetPnl: kpis.totalNetPnl,
    };
  });
}

/** Full computed performance for a single client (dashboard / report). */
export async function getClientPerformance(clientId: string): Promise<ClientPerformance | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      transactions: { orderBy: { date: "asc" } },
      dailyPerformances: { orderBy: { date: "asc" } },
    },
  });
  if (!client) return null;

  const approved = client.transactions.filter((t) => t.status === "APPROVED");
  const ledger = approved.map((t) => ({
    date: t.date,
    type: t.type,
    amount: t.amount,
  }));

  const curve = computeEquityCurve({
    initialDeposit: client.initialDeposit,
    startDate: client.startDate,
    ledger,
    performances: client.dailyPerformances.map((p) => ({
      date: p.date,
      dailyPercent: p.dailyPercent,
    })),
  });
  const kpis = computeKpis({ initialDeposit: client.initialDeposit, ledger, curve });

  return { client, curve, kpis };
}

/**
 * Portfolio-wide aggregate across all clients, for the main dashboard.
 * Combines every client's curve into a single equity series keyed by date.
 */
export async function getPortfolioPerformance() {
  const clients = await prisma.client.findMany({
    include: {
      transactions: { where: { status: "APPROVED" }, orderBy: { date: "asc" } },
      dailyPerformances: { orderBy: { date: "asc" } },
    },
  });

  const aggregateByDate = new Map<string, EquityPoint>();
  let totalInitial = 0;
  const aggLedger: LedgerEntry[] = [];

  for (const c of clients) {
    totalInitial += c.initialDeposit;
    const ledger = c.transactions.map((t) => ({
      date: t.date,
      type: t.type,
      amount: t.amount,
    }));
    aggLedger.push(...ledger);

    const curve = computeEquityCurve({
      initialDeposit: c.initialDeposit,
      startDate: c.startDate,
      ledger,
      performances: c.dailyPerformances.map((p) => ({
        date: p.date,
        dailyPercent: p.dailyPercent,
      })),
    });

    for (const point of curve) {
      const existing = aggregateByDate.get(point.date);
      if (existing) {
        existing.balance += point.balance;
        existing.pnl += point.pnl;
        existing.deposits += point.deposits;
        existing.withdrawals += point.withdrawals;
      } else {
        aggregateByDate.set(point.date, { ...point });
      }
    }
  }

  const curve = Array.from(aggregateByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Recompute weighted avg daily % / win rate at the portfolio level.
  const kpis = computeKpis({ initialDeposit: totalInitial, ledger: aggLedger, curve });

  return { curve, kpis, clientCount: clients.length };
}

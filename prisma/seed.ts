/**
 * Seed script: 3 demo clients, sample deposits/withdrawals, and 60 trading days
 * of compounded performance (0.3%–0.6% daily, Mon–Fri only).
 *
 * Idempotent: clears existing demo data first so `npm run db:seed` can re-run.
 */
import { PrismaClient } from "@prisma/client";
import {
  recentTradingDays,
  randomDailyPercent,
  computeEquityCurve,
} from "../src/lib/performance";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

interface SeedClient {
  name: string;
  email: string;
  phone: string;
  accountNumber: string;
  initialDeposit: number;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  // Extra deposits/withdrawals to drop into the ledger (dayOffset = trading-day
  // index from the start of the 60-day window).
  cashflows: {
    dayOffset: number;
    type: "DEPOSIT" | "WITHDRAWAL";
    amount: number;
    method: "BANK" | "CRYPTO" | "OTC";
    notes?: string;
    status?: "PENDING" | "APPROVED";
  }[];
}

const TRADING_DAYS = 60;

const SEED_CLIENTS: SeedClient[] = [
  {
    name: "Miguel Santos",
    email: "miguel.santos@example.com",
    phone: "+63 917 555 0142",
    accountNumber: "RSC-10001",
    initialDeposit: 25000,
    status: "ACTIVE",
    cashflows: [
      { dayOffset: 12, type: "DEPOSIT", amount: 10000, method: "BANK", notes: "Top-up via BDO" },
      { dayOffset: 33, type: "WITHDRAWAL", amount: 5000, method: "CRYPTO", notes: "USDT payout" },
      { dayOffset: 50, type: "DEPOSIT", amount: 7500, method: "OTC", notes: "OTC desk" },
    ],
  },
  {
    name: "Ana Reyes",
    email: "ana.reyes@example.com",
    phone: "+63 928 555 0199",
    accountNumber: "RSC-10002",
    initialDeposit: 50000,
    status: "ACTIVE",
    cashflows: [
      { dayOffset: 8, type: "DEPOSIT", amount: 20000, method: "BANK", notes: "Wire transfer" },
      { dayOffset: 40, type: "WITHDRAWAL", amount: 12000, method: "BANK", notes: "Scheduled withdrawal" },
      { dayOffset: 55, type: "DEPOSIT", amount: 15000, method: "CRYPTO", notes: "BTC deposit", status: "PENDING" },
    ],
  },
  {
    name: "David Cruz",
    email: "david.cruz@example.com",
    phone: "+63 905 555 0177",
    accountNumber: "RSC-10003",
    initialDeposit: 10000,
    status: "PAUSED",
    cashflows: [
      { dayOffset: 20, type: "DEPOSIT", amount: 5000, method: "CRYPTO", notes: "USDT TRC-20" },
      { dayOffset: 45, type: "WITHDRAWAL", amount: 3000, method: "OTC", notes: "Partial profit take" },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding QuantumX Global Markets...");

  // Reset demo data.
  await prisma.user.deleteMany();
  await prisma.dailyPerformance.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.client.deleteMany();

  // The shared 60 trading-day window (oldest first).
  const days = recentTradingDays(TRADING_DAYS);
  const startKey = days[0];

  const clientIdByEmail = new Map<string, string>();

  for (const sc of SEED_CLIENTS) {
    const client = await prisma.client.create({
      data: {
        name: sc.name,
        email: sc.email,
        phone: sc.phone,
        accountNumber: sc.accountNumber,
        initialDeposit: sc.initialDeposit,
        startDate: new Date(`${startKey}T00:00:00.000Z`),
        status: sc.status,
      },
    });
    clientIdByEmail.set(sc.email, client.id);

    // Ledger transactions.
    const ledger = sc.cashflows.map((cf) => ({
      date: new Date(`${days[Math.min(cf.dayOffset, days.length - 1)]}T08:00:00.000Z`),
      type: cf.type,
      amount: cf.amount,
      method: cf.method,
      notes: cf.notes,
      status: cf.status ?? ("APPROVED" as const),
    }));

    for (const t of ledger) {
      await prisma.transaction.create({
        data: { clientId: client.id, ...t },
      });
    }

    // Per-day performance percentages (random within the estimate band).
    const performances = days.map((date) => ({
      date,
      dailyPercent: randomDailyPercent(),
    }));

    // Compound the curve so we can store the end-of-day balance snapshot.
    const curve = computeEquityCurve({
      initialDeposit: sc.initialDeposit,
      startDate: startKey,
      // Only APPROVED cashflows affect the balance snapshot.
      ledger: ledger
        .filter((t) => t.status === "APPROVED")
        .map((t) => ({ date: t.date, type: t.type, amount: t.amount })),
      performances,
    });
    const balanceByDay = new Map(curve.map((p) => [p.date, p]));

    for (const p of performances) {
      const point = balanceByDay.get(p.date);
      await prisma.dailyPerformance.create({
        data: {
          clientId: client.id,
          date: new Date(`${p.date}T20:00:00.000Z`),
          dailyPercent: p.dailyPercent,
          balanceEOD: point?.balance ?? sc.initialDeposit,
          pnlUsd: point?.pnl ?? 0,
        },
      });
    }

    console.log(
      `  ✓ ${sc.name} (${sc.accountNumber}) — ${performances.length} trading days, ` +
        `final balance ≈ $${(curve.at(-1)?.balance ?? 0).toFixed(2)}`
    );
  }

  // --- Login accounts ---------------------------------------------------------
  // Admin (monitoring portal) + a demo client linked to Miguel Santos.
  await prisma.user.create({
    data: {
      email: "admin@quantumxglobal.com",
      name: "Portfolio Admin",
      passwordHash: hashPassword("admin123"),
      role: "admin",
      emailVerified: true,
    },
  });

  const demoClientId = clientIdByEmail.get("miguel.santos@example.com")!;
  await prisma.user.create({
    data: {
      email: "client@quantumxglobal.com",
      name: "Miguel Santos",
      passwordHash: hashPassword("client123"),
      role: "client",
      clientId: demoClientId,
      emailVerified: true,
    },
  });

  console.log("  ✓ Users: admin@quantumxglobal.com / client@quantumxglobal.com");
  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

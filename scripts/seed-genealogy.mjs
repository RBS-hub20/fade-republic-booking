/**
 * Seed ~1000 fake users for genealogy-tree testing:
 *   10 L1 (no sponsor) → 100 L2 → 889 L3  (999 total).
 * Randomizes username, tier (via an approved deposit), gender, and P&L (via a
 * DailyPerformance row). Assigns avatar_type deterministically. Read-only for
 * real data — only inserts/removes rows tagged with the seed email domain.
 *
 *   npm run seed:genealogy
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DOMAIN = "seedg.demo.qx";

function bucket5(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 5) + 1;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const TIERS = [50, 50, 100, 100, 250, 500]; // weighted toward lower tiers

async function main() {
  console.log("Cleaning previous genealogy seed…");
  const old = await prisma.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true, clientId: true } });
  const oldClientIds = old.map((u) => u.clientId).filter(Boolean);
  if (oldClientIds.length) {
    await prisma.dailyPerformance.deleteMany({ where: { clientId: { in: oldClientIds } } });
    await prisma.transaction.deleteMany({ where: { clientId: { in: oldClientIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  if (oldClientIds.length) await prisma.client.deleteMany({ where: { id: { in: oldClientIds } } });

  const clients = [];
  const users = [];
  const deposits = [];
  const perfs = [];
  let seq = 0;

  // node: { id, referredById, referralPath, referralDepth, rootSponsorId }
  function makeNode(level, parent) {
    seq += 1;
    const id = `seedg_${level}_${seq}_${Math.random().toString(36).slice(2, 8)}`;
    const clientId = `seedgc_${seq}_${Math.random().toString(36).slice(2, 8)}`;
    // avatarType is just one of the 10 avatar assets — no longer gender-linked.
    const avatarType = `${Math.random() < 0.5 ? "male" : "female"}-${bucket5(id)}`;
    const username = `trader_${level}_${seq}`;
    const email = `${username}@${DOMAIN}`;
    const deposit = pick(TIERS);
    const pnlUsd = Math.round(deposit * (Math.random() * 0.55 - 0.2) * 100) / 100; // -20%..+35%
    const createdAt = new Date(Date.now() - randInt(1, 330) * 86400_000);
    const status = Math.random() < 0.85 ? "ACTIVE" : "INACTIVE";

    const referredById = parent ? parent.id : null;
    const referralPath = parent ? (parent.referralPath ? `${parent.referralPath}/${parent.id}` : parent.id) : null;
    const referralDepth = parent ? parent.referralDepth + 1 : 0;
    const rootSponsorId = parent ? (parent.rootSponsorId ?? parent.id) : null;

    clients.push({ id: clientId, name: username, email, accountNumber: `SG-${seq}`, initialDeposit: 0, startDate: createdAt, status, createdAt, updatedAt: createdAt });
    users.push({ id, email, name: username, passwordHash: "seed", role: "client", emailVerified: true, clientId, referredById, referralPath, referralDepth, rootSponsorId, username, usernameSet: false, avatarType, commissionBalance: 0, createdAt, updatedAt: createdAt });
    deposits.push({ clientId, type: "DEPOSIT", amount: deposit, method: "USDT_TRC20", status: "APPROVED", date: createdAt, createdAt });
    perfs.push({ clientId, date: createdAt, dailyPercent: Math.round((0.3 + Math.random() * 0.2) * 100) / 100, balanceEOD: deposit + pnlUsd, pnlUsd, notes: "server:1.5" });
    return { id, referralPath, referralDepth, rootSponsorId };
  }

  const l1 = Array.from({ length: 10 }, () => makeNode("l1", null));
  const l2 = Array.from({ length: 100 }, () => makeNode("l2", pick(l1)));
  Array.from({ length: 889 }, () => makeNode("l3", pick(l2)));

  console.log(`Inserting ${users.length} users (+ clients, deposits, performance)…`);
  const CHUNK = 500;
  for (let i = 0; i < clients.length; i += CHUNK) await prisma.client.createMany({ data: clients.slice(i, i + CHUNK) });
  for (let i = 0; i < users.length; i += CHUNK) await prisma.user.createMany({ data: users.slice(i, i + CHUNK) });
  for (let i = 0; i < deposits.length; i += CHUNK) await prisma.transaction.createMany({ data: deposits.slice(i, i + CHUNK) });
  for (let i = 0; i < perfs.length; i += CHUNK) await prisma.dailyPerformance.createMany({ data: perfs.slice(i, i + CHUNK) });

  console.log(`✅ Seeded ${users.length} users: 10 L1 → 100 L2 → 889 L3. Company root = users with no sponsor.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

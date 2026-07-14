import { PageHeader } from "@/components/shell/page-header";
import { AddClientDialog } from "@/components/clients/add-client-dialog";
import { ClientsTable, type ClientRow } from "@/components/clients/clients-table";
import { redirect } from "next/navigation";
import { getClientsWithBalance } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFinanceSchemaOnce } from "@/lib/finance-schema";
import { ensureUsernameSchemaOnce } from "@/lib/username";
import { ensurePhoneSchemaOnce } from "@/lib/phone";
import { ensureCountrySchemaOnce } from "@/lib/countries";
import { getCapitalSummary, type CapitalSummary } from "@/lib/capital";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = getSession();
  if (session?.role !== "admin") redirect("/dashboard");
  const clients = await getClientsWithBalance();

  // Per-client capital-lock figures (Active Capital / Available / Maturity) +
  // 2nd-level unlock status per client's user.
  const capitalByClient = new Map<string, CapitalSummary>();
  const unlockByClient = new Map<string, { unlocked: boolean; active: number }>();
  const usernameByClient = new Map<string, string>();
  const phoneByClient = new Map<
    string,
    { countryCode: string | null; phoneNumber: string | null; phoneVerified: boolean }
  >();
  const countryByClient = new Map<string, { country: string | null; countryName: string | null }>();
  try {
    await ensureFinanceSchemaOnce(prisma);
    await ensureUsernameSchemaOnce(prisma);
    await ensurePhoneSchemaOnce(prisma);
    await ensureCountrySchemaOnce(prisma);
    const users = await prisma.user.findMany({
      where: { clientId: { in: clients.map((c) => c.id) } },
      select: {
        id: true,
        clientId: true,
        username: true,
        countryCode: true,
        phoneNumber: true,
        phoneVerified: true,
        country: true,
        countryName: true,
      },
    });
    const userByClient = new Map(users.map((u) => [u.clientId as string, u.id]));
    for (const u of users) {
      if (!u.clientId) continue;
      if (u.username) usernameByClient.set(u.clientId, u.username);
      phoneByClient.set(u.clientId, {
        countryCode: u.countryCode ?? null,
        phoneNumber: u.phoneNumber ?? null,
        phoneVerified: u.phoneVerified ?? false,
      });
      countryByClient.set(u.clientId, {
        country: u.country ?? null,
        countryName: u.countryName ?? null,
      });
    }
    const unlocks = await prisma.userUnlock
      .findMany({ where: { userId: { in: users.map((u) => u.id) } } })
      .catch(() => [] as { userId: string; level2Unlocked: boolean; activeDirectsCount: number }[]);
    const unlockByUser = new Map(unlocks.map((u) => [u.userId, u]));
    await Promise.all(
      clients.map(async (c) => {
        const uid = userByClient.get(c.id) ?? "";
        const summary = await getCapitalSummary({ clientId: c.id, userId: uid }).catch(() => null);
        if (summary) capitalByClient.set(c.id, summary);
        const ul = unlockByUser.get(uid);
        if (ul) unlockByClient.set(c.id, { unlocked: ul.level2Unlocked, active: ul.activeDirectsCount });
      })
    );
  } catch (err) {
    console.error("[clients] capital summaries unavailable:", err);
  }

  const rows: ClientRow[] = clients.map((c) => {
    const cap = capitalByClient.get(c.id);
    const activeCapital = cap ? cap.activeCapital + cap.maturedCapital : c.initialDeposit;
    const ul = unlockByClient.get(c.id);
    const ph = phoneByClient.get(c.id);
    const co = countryByClient.get(c.id);
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      username: usernameByClient.get(c.id) ?? null,
      accountNumber: c.accountNumber,
      status: c.status,
      // Prefer the Client's own country (admin-set / mirrored), fall back to
      // the owner User's country for legacy signups.
      country: c.country ?? co?.country ?? null,
      countryName: c.countryName ?? co?.countryName ?? null,
      activeCapital,
      hasMatured: cap?.hasMatured ?? false,
      availableWithdrawal: cap?.availableWithdrawal ?? 0,
      maturityDate: cap?.earliestMaturity ?? null,
      daysToMaturity: cap?.daysToMaturity ?? null,
      totalNetPnl: c.totalNetPnl,
      level2Unlocked: ul?.unlocked ?? false,
      activeDirects: ul?.active ?? 0,
      countryCode: ph?.countryCode ?? null,
      phoneNumber: ph?.phoneNumber ?? null,
      phoneVerified: ph?.phoneVerified ?? false,
    };
  });

  return (
    <>
      <PageHeader title="Clients" subtitle={`${clients.length} managed accounts`}>
        <AddClientDialog />
      </PageHeader>
      <ClientsTable rows={rows} />
    </>
  );
}

import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureCountrySchemaOnce } from "@/lib/countries";
import { UsersCountryTable, type UserCountryRow } from "@/components/admin/users-country-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  let rows: UserCountryRow[] = [];
  try {
    await ensureCountrySchemaOnce(prisma);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        country: true,
        countryName: true,
        clientId: true,
      },
    });
    rows = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username ?? null,
      country: u.country ?? null,
      countryName: u.countryName ?? null,
      hasClient: Boolean(u.clientId),
    }));
  } catch (err) {
    console.error("[admin/users] failed to load users:", err);
  }

  const missing = rows.filter((r) => !r.country).length;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${rows.length} accounts · ${missing} without a country — select to bulk-set`}
      />
      <UsersCountryTable rows={rows} />
    </>
  );
}

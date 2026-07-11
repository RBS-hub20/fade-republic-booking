import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureUsernameSchemaOnce } from "@/lib/username";
import { UsernameClaimForm } from "@/components/settings/username-claim-form";

export const dynamic = "force-dynamic";

export default async function UsernameSettingsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (!session.userId) redirect("/dashboard");

  await ensureUsernameSchemaOnce(prisma).catch(() => {});
  const me = await prisma.user
    .findUnique({ where: { id: session.userId }, select: { username: true, usernameSet: true } })
    .catch(() => null);

  return (
    <>
      <PageHeader
        title="Username"
        subtitle="Your @username is separate from your referral code. You can set it once."
      />
      <UsernameClaimForm currentUsername={me?.username ?? null} locked={Boolean(me?.usernameSet)} />
    </>
  );
}

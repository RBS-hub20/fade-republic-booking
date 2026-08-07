import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TeamView } from "@/components/team/team-view";
import { getSession } from "@/lib/auth";
import { getMyTeam } from "@/lib/team";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (!session.userId) redirect("/dashboard");

  const initial = await getMyTeam(session.userId, { page: 1, filter: "all" });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://quantumxglobal.online";

  return (
    <>
      <PageHeader
        title="My Team 👥"
        subtitle="Your direct referrals — who signed up, who bought, who's still pending"
      />
      <TeamView initial={initial} origin={origin} />
    </>
  );
}

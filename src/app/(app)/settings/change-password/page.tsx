import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { getSession } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export const dynamic = "force-dynamic";

export default function ChangePasswordPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (!session.userId) redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Change password"
        subtitle="Enter your current password, then choose a new one. You'll get an email confirming the change."
      />
      <ChangePasswordForm />
    </>
  );
}

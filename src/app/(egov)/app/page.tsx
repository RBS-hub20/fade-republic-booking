import type { Metadata } from "next";
import { AppShell } from "@/components/egov/app-shell";

export const metadata: Metadata = {
  title: "SuperAgent Console",
  description:
    "Chat with SuperAgent to check SSS contributions, PhilHealth membership and PSA requests — with a locally encrypted vault and an Anti-Fixer Receipt.",
};

export default function SuperAgentAppPage() {
  return <AppShell />;
}

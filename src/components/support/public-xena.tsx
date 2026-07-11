"use client";

import { usePathname } from "next/navigation";
import { SupportChat } from "./support-chat";

// Public XENA is shown on marketing/public pages only. It is hidden on the auth
// screens and on every authenticated app route (those either need no sales bot
// or, like /dashboard, already render the signed-in support chat).
const HIDE_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/dashboard",
  "/wallet",
  "/admin",
  "/clients",
  "/reports",
  "/approvals",
  "/ledger",
  "/charts",
  "/qx-tiers",
  "/deposit",
];

export function PublicXena() {
  const pathname = usePathname() || "/";
  const hidden = HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (hidden) return null;
  return <SupportChat mode="public" />;
}

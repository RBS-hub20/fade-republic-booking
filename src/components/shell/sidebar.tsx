"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  CandlestickChart,
  FileText,
  Wallet,
  CheckSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

function navForRole(role: string, clientId: string | null): NavItem[] {
  if (role === "admin") {
    return [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/approvals", label: "Approvals", icon: CheckSquare },
      { href: "/ledger", label: "Ledger", icon: ArrowLeftRight },
      { href: "/charts", label: "Charts", icon: CandlestickChart },
      { href: "/reports", label: "Reports", icon: FileText },
    ];
  }
  // Client
  return [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/wallet", label: "Deposit / Withdraw", icon: Wallet },
    { href: "/charts", label: "Charts", icon: CandlestickChart },
    ...(clientId
      ? [{ href: `/reports/${clientId}`, label: "My Statement", icon: FileText }]
      : []),
  ];
}

export function Sidebar({
  open,
  onClose,
  role,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  role: string;
  clientId: string | null;
}) {
  const pathname = usePathname();
  const nav = navForRole(role, clientId);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-5">
          <Link href="/dashboard">
            <Logo size="md" />
          </Link>
          <button onClick={onClose} className="text-muted-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-gold-400/15 text-gold-300"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Trade Beyond Limits</p>
          <p className="capitalize">{role} · Asia/Manila</p>
        </div>
      </aside>
    </>
  );
}

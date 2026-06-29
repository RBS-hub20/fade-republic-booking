import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "neutral" | "profit" | "loss" | "gold";
}) {
  const toneClass = {
    neutral: "text-foreground",
    profit: "text-profit",
    loss: "text-loss",
    gold: "text-gold-300",
  }[tone];

  const iconBg = {
    neutral: "bg-secondary text-muted-foreground",
    profit: "bg-profit/15 text-profit",
    loss: "bg-loss/15 text-loss",
    gold: "bg-gold-400/15 text-gold-300",
  }[tone];

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", iconBg)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("tnum mt-3 text-2xl font-bold", toneClass)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

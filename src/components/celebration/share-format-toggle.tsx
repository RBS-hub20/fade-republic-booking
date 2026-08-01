"use client";

import { RectangleVertical, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShareFormat } from "@/lib/use-share-image";

/** Story (9:16) vs Square (1:1) picker, shared by the celebration + promo share views. */
export function ShareFormatToggle({ format, onChange }: { format: ShareFormat; onChange: (f: ShareFormat) => void }) {
  const opt = (f: ShareFormat, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => onChange(f)}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
        format === f ? "border-white bg-white/20 text-white" : "border-white/25 text-white/70 hover:bg-white/10"
      )}
    >
      {icon} {label}
    </button>
  );
  return (
    <div className="mt-4 flex gap-2">
      {opt("story", "Story 9:16", <RectangleVertical className="h-3.5 w-3.5" />)}
      {opt("square", "Square 1:1", <Square className="h-3.5 w-3.5" />)}
    </div>
  );
}

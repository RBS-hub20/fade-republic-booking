import { cn } from "@/lib/utils";

/**
 * QuantumX Global Markets brand mark + wordmark.
 *
 * The mark is a gold rounded tile with a "QX" monogram; the wordmark renders
 * "Quantum" in the foreground colour with a gold "X". Centralised here so the
 * brand can be updated in one place.
 */

const SIZES = {
  sm: { tile: "h-7 w-7 text-[11px]", word: "text-base", sub: "text-[9px]" },
  md: { tile: "h-8 w-8 text-xs", word: "text-lg", sub: "text-[10px]" },
  lg: { tile: "h-14 w-14 text-lg", word: "text-2xl", sub: "text-xs" },
} as const;

export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-lg bg-gradient-to-br from-gold-300 to-gold-500 font-black tracking-tight text-black shadow-sm",
        SIZES[size].tile,
        className
      )}
      aria-hidden
    >
      QX
    </span>
  );
}

export function Logo({
  size = "md",
  subtitle = false,
  className,
}: {
  size?: keyof typeof SIZES;
  /** Show the "GLOBAL MARKETS" subtitle line under the wordmark. */
  subtitle?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-bold tracking-tight", s.word)}>
          Quantum<span className="text-gold-400">X</span>
        </span>
        {subtitle && (
          <span className={cn("mt-0.5 font-medium uppercase tracking-[0.2em] text-muted-foreground", s.sub)}>
            Global Markets
          </span>
        )}
      </span>
    </span>
  );
}

import { cn } from "@/lib/utils";

/**
 * QuantumX Global Markets brand mark + wordmark.
 *
 * The mark is the gold "QX" trading symbol exported as a transparent PNG
 * (/public/logo-icon.png) so it renders crisply on the dark theme at any size.
 * The wordmark renders "Quantum" in white with a gold "X", above an optional
 * "GLOBAL MARKETS" subtitle — matching the primary brand lockup.
 */

// Intrinsic aspect ratio of /public/logo-icon.png (width / height).
const ICON_RATIO = 232 / 160;

const SIZES = {
  sm: { icon: 26, word: "text-base", sub: "text-[9px]" },
  md: { icon: 32, word: "text-lg", sub: "text-[10px]" },
  lg: { icon: 56, word: "text-2xl", sub: "text-xs" },
} as const;

export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const h = SIZES[size].icon;
  const w = Math.round(h * ICON_RATIO);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icon.png"
      alt="QuantumX"
      width={w}
      height={h}
      style={{ height: h, width: w }}
      className={cn("inline-block shrink-0 select-none", className)}
      draggable={false}
    />
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
    <span className={cn("flex items-center gap-3", className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-semibold tracking-tight text-white", s.word)}>
          Quantum<span className="text-gold-400">X</span>
        </span>
        {subtitle && (
          <span
            className={cn(
              "mt-1 font-normal uppercase tracking-[0.2em] text-[#9CA3AF]",
              s.sub
            )}
          >
            Global Markets
          </span>
        )}
      </span>
    </span>
  );
}

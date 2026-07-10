import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * QuantumX Global Markets brand mark + wordmark.
 *
 * The mark is the gold "QX" symbol cropped (via CSS background) out of the full
 * brand logo (/public/quantumx-logo.png), so it renders crisply at any size on
 * the dark theme without needing a separate icon export. The wordmark renders
 * "Quantum" in the foreground colour with a gold "X".
 */

const SIZES = {
  sm: { px: 28, word: "text-base", sub: "text-[9px]" },
  md: { px: 34, word: "text-lg", sub: "text-[10px]" },
  lg: { px: 56, word: "text-2xl", sub: "text-xs" },
} as const;

// Bounding box of the QX mark within the 1254×1254 source image.
const CROP = { left: 335, top: 155, size: 685, img: 1254 };

function markStyle(px: number): CSSProperties {
  const scale = px / CROP.size;
  return {
    width: px,
    height: px,
    backgroundImage: "url(/quantumx-logo.png)",
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(CROP.img * scale).toFixed(1)}px`,
    backgroundPosition: `${(-CROP.left * scale).toFixed(1)}px ${(-CROP.top * scale).toFixed(1)}px`,
    backgroundColor: "#0b0b0b",
  };
}

export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      role="img"
      aria-label="QuantumX"
      style={markStyle(SIZES[size].px)}
      className={cn("inline-block shrink-0 rounded-lg", className)}
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
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-bold tracking-tight", s.word)}>
          Quantum<span className="text-gold-400">X</span>
        </span>
        {subtitle && (
          <span
            className={cn(
              "mt-0.5 font-medium uppercase tracking-[0.2em] text-muted-foreground",
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

import Image from "next/image";
import { cn } from "@/lib/utils";
import { LOGOS, PRODUCT } from "@/lib/egov/brand";

type Variant = "main" | "white" | "mark" | "icon";

const SOURCES: Record<Variant, { src: string; ratio: number }> = {
  // Intrinsic aspect ratios of the exported brand assets.
  main: { src: LOGOS.main, ratio: 1100 / 545 },
  white: { src: LOGOS.white, ratio: 640 / 360 },
  mark: { src: LOGOS.markWhite, ratio: 360 / 229 },
  icon: { src: LOGOS.icon, ratio: 1 },
};

/**
 * Brand lockup. `width` is the rendered CSS width in px — height follows the
 * asset's own aspect ratio so the mark never squashes.
 */
export function EgovLogo({
  variant = "main",
  width,
  className,
  priority,
}: {
  variant?: Variant;
  width: number;
  className?: string;
  priority?: boolean;
}) {
  const { src, ratio } = SOURCES[variant];
  const height = Math.round(width / ratio);
  return (
    <Image
      src={src}
      alt={PRODUCT}
      width={width * 2}
      height={height * 2}
      priority={priority}
      sizes={`${width}px`}
      className={cn("h-auto select-none", className)}
      style={{ width, maxWidth: "100%" }}
    />
  );
}

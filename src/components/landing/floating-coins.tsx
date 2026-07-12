/**
 * Decorative floating-crypto-coins backdrop for the LANDING hero only.
 *
 * Pure CSS/markup — no JavaScript, no external assets (glyphs are Unicode /
 * short tickers), so it adds ~0kb of JS. Motion, blur and opacity live in
 * globals.css under the `.qx-coin` class, which is disabled on phones
 * (<768px) and under `prefers-reduced-motion`. Purely ornamental:
 * pointer-events are off and it sits behind the hero content.
 */

type Coin = {
  /** Ticker glyph or short symbol. */
  symbol: string;
  /** Brand tint. */
  color: string;
  top: string;
  left: string;
  /** Diameter in px. */
  size: number;
  /** Animation start offset + duration (staggered so they drift out of sync). */
  delay: string;
  duration: string;
};

// Kept toward the margins so they never sit dead-centre behind the headline.
const COINS: Coin[] = [
  { symbol: "₿", color: "#f7931a", top: "14%", left: "6%", size: 64, delay: "0s", duration: "18s" },
  { symbol: "Ξ", color: "#627eea", top: "24%", left: "89%", size: 52, delay: "2.4s", duration: "21s" },
  { symbol: "₮", color: "#26a17b", top: "68%", left: "9%", size: 48, delay: "4.1s", duration: "23s" },
  { symbol: "BNB", color: "#f3ba2f", top: "72%", left: "85%", size: 56, delay: "1.2s", duration: "17s" },
  { symbol: "SOL", color: "#9945ff", top: "46%", left: "2%", size: 44, delay: "3.3s", duration: "24s" },
  { symbol: "XRP", color: "#5b6570", top: "8%", left: "62%", size: 46, delay: "5s", duration: "19s" },
];

export function FloatingCoins() {
  return (
    <div className="qx-coins" aria-hidden="true">
      {COINS.map((c) => {
        const single = c.symbol.length === 1;
        return (
          <span
            key={c.symbol}
            className="qx-coin"
            style={{
              top: c.top,
              left: c.left,
              width: c.size,
              height: c.size,
              // Softly tinted disc with a subtle brand-coloured edge.
              background: `radial-gradient(circle at 35% 30%, ${c.color}, ${c.color}22)`,
              boxShadow: `0 0 24px ${c.color}55`,
              fontSize: single ? c.size * 0.5 : c.size * 0.3,
              animationDelay: c.delay,
              animationDuration: c.duration,
            }}
          >
            {c.symbol}
          </span>
        );
      })}
    </div>
  );
}

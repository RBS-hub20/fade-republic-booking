/**
 * Lola design tokens.
 *
 * Direction: intimate, grounded, human — the feeling of calling your lola from
 * a warm-lit room at night. Deliberately NOT the gamified-cartoon look, NOT a
 * generic AI-app look, and NOT the default cream-serif-terracotta template.
 *
 * Palette is derived from Filipino material culture rather than a stock scheme:
 *   - "tayum"   — indigo from natural Philippine dye → primary, calm and deep
 *   - "ginto"   — warm gold, the glow of a kitchen lamp → accent / progress
 *   - "puso"    — a measured rose, used ONLY for the live-speaking moment
 *   - "sampaguita" warm ivory → light canvas (intentional, paired with indigo
 *                  not terracotta, so it reads heritage, not stock template)
 *   - "gabi"    — warm indigo-night → the conversation screen centerpiece
 */

export const palette = {
  // Light canvas
  canvas: "#FBF5EA", // sampaguita ivory
  surface: "#FFFFFF",
  surfaceSunk: "#F3E9D8",

  // Ink
  ink: "#241C16", // warm near-black
  inkSoft: "#6E6155",
  inkFaint: "#9C8E80",

  // Primary — tayum indigo
  primary: "#33507B",
  primaryDeep: "#21375A",
  primaryTint: "#E4E9F2",

  // Accent — ginto gold
  gold: "#C8962E",
  goldTint: "#F6E9CA",

  // The speaking moment — puso rose (use sparingly)
  puso: "#D2554C",
  pusoTint: "#F7DAD5",

  // Calm states
  listen: "#2E7D6B", // teal — "Lola is listening"

  // Conversation centerpiece — gabi night
  gabi: "#1A2236",
  gabiSoft: "#27314A",
  onGabi: "#F4EEE2",
  onGabiSoft: "#A9B2C7",

  // Status
  success: "#2E7D6B",
  warning: "#C8962E",
  danger: "#C0392B",
} as const;

/** Display + body pairing, chosen on purpose:
 *  - Display: "Fraunces" — a warm, optical serif with character (headings,
 *    the spoken phrase the learner is reaching for).
 *  - Body: "Inter" — quiet, highly legible at small sizes (UI + coaching).
 *  Fonts are loaded via expo-font in a later phase; system fallbacks here keep
 *  the scaffold runnable.
 */
export const fonts = {
  display: "Fraunces",
  body: "Inter",
} as const;

/** Modular type scale (~1.2 minor third), in pt. */
export const type = {
  hero: { size: 34, line: 40, family: fonts.display, weight: "600" as const },
  title: { size: 26, line: 32, family: fonts.display, weight: "600" as const },
  heading: { size: 20, line: 26, family: fonts.display, weight: "600" as const },
  bodyLg: { size: 18, line: 26, family: fonts.body, weight: "400" as const },
  body: { size: 16, line: 24, family: fonts.body, weight: "400" as const },
  label: { size: 14, line: 20, family: fonts.body, weight: "600" as const },
  caption: { size: 13, line: 18, family: fonts.body, weight: "400" as const },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const theme = { palette, fonts, type, space, radius } as const;
export type Theme = typeof theme;

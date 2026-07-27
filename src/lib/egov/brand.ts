/**
 * eGov SuperAgent brand tokens.
 *
 * The Tailwind theme carries the same values as `egov-*` colour utilities; this
 * module exists for the places that need raw hex (canvas/SVG fills, the jsPDF
 * generator, inline gradients).
 */
export const BRAND = {
  navy: "#0A2156",
  action: "#1E90FF",
  yellow: "#FCD116",
  red: "#CE1126",
  bg: "#050A18",
  surface: "#0A1024",
  green: "#20C997",
} as const;

export const LOGOS = {
  /** Full-colour lockup on transparency — landing hero. */
  main: "/logos/egov-superagent-main.png",
  /** White lockup on transparency — /app sidebar and other dark chrome. */
  white: "/logos/egov-superagent-white.png",
  /** Icon-only "SA" mark in white — compact headers, chat avatar. */
  markWhite: "/logos/egov-superagent-mark-white.png",
  /** Navy app icon, rounded square. */
  icon: "/logos/egov-superagent-icon.png",
  /** Navy app icon, circular crop — favicon / avatar. */
  iconCircle: "/logos/egov-superagent-icon-circle.png",
  /** Original full-colour lockup on white — print / light backgrounds. */
  lockupLight: "/logos/egov-superagent-lockup-light.png",
} as const;

export const TAGLINE = "Super Agent. All Services.";
export const PRODUCT = "eGov SuperAgent";

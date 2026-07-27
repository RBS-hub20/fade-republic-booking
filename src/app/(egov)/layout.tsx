import type { Metadata, Viewport } from "next";
import { BRAND, PRODUCT, TAGLINE } from "@/lib/egov/brand";

/**
 * Route-group layout for the eGov SuperAgent surface (/egov and /app).
 *
 * It overrides the host app's metadata and favicon so this product has its own
 * identity in the tab and in link previews, without touching the root layout.
 */
const DESCRIPTION =
  "The Autonomous eGov OS for 115M Filipinos. Utusan mo lang — SSS, PhilHealth, Pag-IBIG at PSA in one agent, with a locally encrypted vault and an Anti-Fixer Receipt for every transaction.";

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT} — ${TAGLINE}`,
    template: `%s — ${PRODUCT}`,
  },
  description: DESCRIPTION,
  applicationName: PRODUCT,
  icons: {
    icon: [
      { url: "/logos/egov-favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/logos/egov-favicon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/logos/egov-favicon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/logos/egov-favicon.ico",
    apple: { url: "/logos/egov-favicon-180.png", sizes: "180x180" },
  },
  openGraph: {
    type: "website",
    siteName: PRODUCT,
    title: `${PRODUCT} — ${TAGLINE}`,
    description: DESCRIPTION,
    images: [{ url: "/logos/egov-superagent-lockup-light.png", alt: PRODUCT }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT} — ${TAGLINE}`,
    description: DESCRIPTION,
    images: ["/logos/egov-superagent-lockup-light.png"],
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.bg,
};

export default function EgovLayout({ children }: { children: React.ReactNode }) {
  return <div className="eg-root min-h-[100dvh]">{children}</div>;
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PublicXena } from "@/components/support/public-xena";

// NOTE: We intentionally use a system font stack (defined in globals.css) rather
// than next/font/google, so the app never depends on fetching fonts from Google
// at build/runtime — important in restricted/offline environments.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://quantumxglobal.online";
const TITLE = "QuantumX Global Markets — Trade Beyond Limits";
const DESCRIPTION =
  "QuantumX Global Markets is a next-generation trading platform for secure, transparent, and intelligent access to the world's financial markets — crypto, Forex, commodities, indices and more.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "QuantumX Global Markets",
  manifest: "/site.webmanifest",
  icons: {
    // Ordered small→large. Google/browsers pick the best-fit source; declaring
    // the 192px and 512px PNGs gives Google Search a crisp logo to render
    // instead of downsampling only the 48px .ico.
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "QuantumX Global Markets",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "QuantumX Global Markets" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

// Emits <meta name="theme-color" content="#0A0A0A"> — the brand black used by
// the manifest, so mobile browser chrome and PWA installs match the site.
export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        {children}
        <PublicXena />
      </body>
    </html>
  );
}

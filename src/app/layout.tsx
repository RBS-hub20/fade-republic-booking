import type { Metadata } from "next";
import "./globals.css";

// NOTE: We intentionally use a system font stack (defined in globals.css) rather
// than next/font/google, so the app never depends on fetching fonts from Google
// at build/runtime — important in restricted/offline environments.

export const metadata: Metadata = {
  title: "RSCryptoFX Client Portal",
  description:
    "PAMM-style forex trading client dashboard — performance reporting, ledger, and live charts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

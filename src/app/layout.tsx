import type { Metadata } from "next";
import "./globals.css";

// NOTE: We intentionally use a system font stack (defined in globals.css) rather
// than next/font/google, so the app never depends on fetching fonts from Google
// at build/runtime — important in restricted/offline environments.

export const metadata: Metadata = {
  title: "QuantumX Global Markets — Trade Beyond Limits",
  description:
    "QuantumX Global Markets is a next-generation trading platform for secure, transparent, and intelligent access to the world's financial markets — crypto, Forex, commodities, indices and more.",
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

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're offline — QuantumX Global Markets",
  robots: { index: false, follow: false },
};

/**
 * Offline fallback served by the service worker when a page navigation fails
 * because the device has no connection. Fully static — no data, no session — so
 * it renders instantly from the SW precache. QuantumX needs the network for live
 * P&L, so we tell the user plainly and offer a retry.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0A0A0A] px-6 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="QuantumX" width={88} height={88} className="rounded-2xl" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">You&rsquo;re offline</h1>
        <p className="max-w-sm text-sm text-white/60">
          QuantumX needs an internet connection for live P&amp;L and account data. Reconnect and try
          again.
        </p>
      </div>
      <a
        href="/dashboard"
        className="rounded-full bg-[#C6A15B] px-6 py-2.5 text-sm font-medium text-black transition hover:opacity-90"
      >
        Retry
      </a>
    </main>
  );
}

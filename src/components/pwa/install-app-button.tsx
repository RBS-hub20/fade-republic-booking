"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * "Install QuantumX" prompt for the dashboard.
 *
 * WHY THIS EXISTS: Chrome (Android + desktop) stopped auto-showing the install
 * banner back in Chrome 76 — the mini-infobar was removed. A site that meets all
 * PWA install criteria (we do: valid manifest, 192/512 + maskable icons, SW with
 * a fetch handler, HTTPS) still won't nag the user. Instead Chrome fires a
 * `beforeinstallprompt` event that the site must capture and surface via its own
 * UI. This component does that.
 *
 * Behaviour:
 *  - Chrome / Android / desktop: capture `beforeinstallprompt`, show an "Install
 *    App" button; clicking calls the native prompt.
 *  - iOS Safari: there is no `beforeinstallprompt`. Show a short "tap Share →
 *    Add to Home Screen" hint instead (that's the only install path on iOS).
 *  - Already installed / running standalone: render nothing.
 *  - Dismiss: hidden for the rest of the session.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "qx-install-dismissed";

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true); // hidden until we know there's something to show
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed / launched from the home screen → nothing to offer.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari exposes this non-standard flag when launched standalone.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Respect an earlier dismissal for this session.
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* private mode / storage blocked — treat as not dismissed */
    }
    if (dismissed) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // stop Chrome's own (already-suppressed) mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari has no beforeinstallprompt — offer the manual Share instructions.
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isIOSSafari) {
      setIosHint(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
    } finally {
      // The prompt can only be used once.
      setDeferred(null);
      setHidden(true);
    }
  };

  // iOS Safari variant — instructions only (no programmatic install on iOS).
  if (iosHint && !deferred) {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-gold-400/40 bg-gradient-to-r from-gold-400/15 to-transparent px-4 py-3 text-sm text-gold-200">
        <span className="flex items-center gap-2">
          <Share className="h-4 w-4 shrink-0" />
          <span>
            Install QuantumX: tap <strong>Share</strong>, then{" "}
            <strong>Add to Home&nbsp;Screen</strong>.
          </span>
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install hint"
          className="shrink-0 rounded p-1 text-gold-300/70 transition-colors hover:text-gold-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Chrome / Android / desktop variant — real install button.
  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-gold-400/40 bg-gradient-to-r from-gold-400/15 to-transparent px-4 py-3">
      <span className="text-sm font-medium text-gold-200">
        Get the QuantumX app — instant access to your live P&amp;L.
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={install}
          className="flex items-center gap-2 rounded-md bg-gold-400 px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Download className="h-4 w-4" />
          Install App
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded p-1 text-gold-300/70 transition-colors hover:text-gold-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

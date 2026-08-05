"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (/sw.js) once, on the client, after load.
 *
 * Renders nothing. Registration is best-effort and fully guarded: if the
 * browser has no service-worker support (older Safari) or registration fails,
 * the app keeps working exactly as a normal website — the SW only adds offline
 * resilience + installability, it is never required for the app to function.
 *
 * The worker itself (public/sw.js) deliberately bypasses /api, /admin and
 * /login, so registering it can never interfere with authentication.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is optional — never surface a failure to the user */
      });
    };

    // Register after the window has loaded so it never competes with first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}

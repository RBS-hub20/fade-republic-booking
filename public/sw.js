/*
 * QuantumX PWA service worker.
 *
 * SAFETY-FIRST caching. The one rule that must never break: authentication and
 * live data must always hit the network. So this worker:
 *
 *   - NEVER caches or serves cached responses for /api/*, /admin/*, or /login.
 *   - NEVER touches non-GET requests (POST logins, etc. pass straight through).
 *   - Uses network-FIRST for page navigations, falling back to the /offline
 *     page only when the network is unreachable (so stale authed HTML is never
 *     served — you always get the real, current page when online).
 *   - Uses cache-FIRST only for immutable static assets (/_next/static, icons,
 *     images, fonts) — these are content-hashed or versioned, safe to cache.
 *
 * Works identically in Safari iOS (standalone), Chrome Android, and Chrome
 * desktop. WKWebView (native App Store shell) and Android WebView use the same
 * engines, so behaviour carries over.
 */

const VERSION = "qx-v1";
const STATIC_CACHE = `qx-static-${VERSION}`;
const OFFLINE_URL = "/offline";

// Precache the offline fallback + core icons so the offline page always renders.
const PRECACHE_URLS = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Never let the SW get between the user and auth/live data.
function isBypassed(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname === "/login" ||
    url.pathname.startsWith("/login/")
  );
}

// Content-hashed / versioned static assets that are safe to cache-first.
function isStaticAsset(request, url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  const dest = request.destination;
  if (dest === "style" || dest === "script" || dest === "font" || dest === "image") return true;
  return /\.(png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf|css|js)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever handle same-origin GETs. Everything else (POST logins, cross-origin
  // market APIs, etc.) is left entirely to the browser.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypassed(url)) return; // auth + live data: straight to network, no cache

  // Page navigations → network-first, offline fallback. Never cached, so an
  // authenticated user always gets the real current page when online.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || new Response("You are offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }))
      )
    );
    return;
  }

  // Static assets → cache-first, then populate the cache for next time.
  if (isStaticAsset(request, url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Anything else: default to the network (no caching).
});

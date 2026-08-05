# QuantumX — PWA + Native App Store / Play Store plan

**Status (Aug 2026):** PWA works on **Safari iOS** and **Chrome (Android + Desktop)** now — installable via *Add to Home Screen* / *Install app*. Native App Store + Play Store submission targeted for **Nov 2026**.

## One codebase, three surfaces

There is **no separate app codebase**. The web app at `https://quantumxglobal.online` is the single source of truth. Every surface loads that same live URL:

| Surface | Engine | How it loads the app |
|---|---|---|
| PWA — Safari iOS | WebKit (Safari) | Add to Home Screen → standalone web app |
| PWA — Chrome Android / Desktop | Blink (Chrome) | Install app → standalone web app |
| Native iOS (App Store) | **WKWebView** = same Safari/WebKit engine | Capacitor shell → live URL |
| Native Android (Play Store) | **Chrome WebView** = same Blink engine | Capacitor shell → live URL |

Because the native shells use the exact engines the PWA is already verified on (WKWebView = Safari, Chrome WebView = Chrome), **if the PWA works on Safari + Chrome, the native apps work too** — same HTML, same cookies (`SameSite=Lax`), same session flow, always the latest deploy.

## Phase 1 — PWA (done, this branch `feat/pwa-safari-chrome`)

- `public/site.webmanifest` — `display: standalone`, `scope: /`, `start_url: /dashboard`, black theme, 192/512 icons (incl. maskable).
- iOS meta tags via Next `appleWebApp` (capable, title, status-bar style) + `apple-touch-icon` 180×180.
- `viewport-fit=cover` for the iPhone notch / safe areas.
- Service worker `public/sw.js`: caches **only** static assets; **never** `/api/*`, `/admin/*`, or `/login` — so auth is never served stale on Safari. Navigations are network-first with an `/offline` fallback.
- `/offline` page — "You're offline — QuantumX needs internet for live P&L."
- Auth cookies are `SameSite=Lax` (verified) — required for Safari standalone PWA to send the session cookie.

### Test checklist (manual, on real devices)
- **Safari iOS:** Add to Home Screen → open → login → dashboard renders → close & reopen → session persists (lands on dashboard, not login).
- **Chrome Android:** Install → same.
- **Chrome Desktop:** Install → same.

## Phase 2 — Capacitor native shells (Nov 2026)

`capacitor.config.ts` is committed (excluded from the web build). It points `server.url` at the live site, so both native shells are thin WebViews over production.

To build the native apps when ready:

```bash
# Install Capacitor (native build only — not needed for the web app)
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/ios @capacitor/android

# Add platforms (creates ios/ and android/ native projects)
npx cap add ios
npx cap add android

# Sync config → open native IDEs to build & submit
npx cap sync
npx cap open ios       # Xcode  → App Store (Nov 2026)
npx cap open android   # Android Studio → Play Store (Nov 2026)
```

Since the shells load the remote URL, there is nothing to re-bundle on each deploy — pushing to production updates all four surfaces at once.

### Submission notes
- **iOS App Store:** WKWebView pointed at a remote URL is accepted provided the app delivers real, app-like functionality (it does — full trading portal). App icon/splash from the same brand assets.
- **Play Store:** Chrome WebView shell, same URL.
- App identifiers: `appId: online.quantumxglobal.app`, `appName: QuantumX` (see `capacitor.config.ts`).

/**
 * Capacitor configuration for the native App Store (iOS) and Play Store
 * (Android) shells — used only when building the native apps, NOT by the Next.js
 * web build (it is excluded in tsconfig.json).
 *
 * Strategy: the native shell is a thin WebView pointed at the LIVE production
 * URL. iOS uses WKWebView (the Safari engine) and Android uses the Chrome
 * WebView, so both render exactly the same site the PWA already runs on — one
 * codebase, always the latest deploy, no separate app bundle to keep in sync.
 *
 * Because we point at a remote https:// URL, cookies (SameSite=Lax) and the
 * session flow behave identically to the browser PWA that's already verified
 * working on Safari + Chrome.
 *
 * Requires the Capacitor CLI + platform packages at native-build time:
 *   npm i -D @capacitor/cli
 *   npm i @capacitor/core @capacitor/ios @capacitor/android
 * (Not added to package.json here so the web build stays untouched.)
 */
const config = {
  appId: "online.quantumxglobal.app",
  appName: "QuantumX",
  // No local web assets are bundled — the WebView loads the live site below.
  webDir: "public",
  server: {
    // Both engines (WKWebView / Chrome WebView) load the live production site,
    // so the native apps always serve the latest deploy.
    url: "https://quantumxglobal.online",
    cleartext: false,
  },
  ios: {
    // Match the brand chrome behind the notch / status bar.
    backgroundColor: "#0A0A0A",
    contentInset: "always",
  },
  android: {
    backgroundColor: "#0A0A0A",
  },
};

export default config;

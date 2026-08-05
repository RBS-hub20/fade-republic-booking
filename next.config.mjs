/** @type {import('next').NextConfig} */

// Security hardening headers applied to every response. Kept conservative so
// nothing in the app breaks: no full Content-Security-Policy yet (Next injects
// inline scripts/styles that need a nonce-based CSP — tracked as a follow-up),
// only the safe frame-ancestors directive.
const securityHeaders = [
  // Force HTTPS for 2 years incl. subdomains (prod is HTTPS-only).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Clickjacking: this app is never meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Stop MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry ?ref=, tokens) to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful browser features the app doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig = {
  reactStrictMode: true,
  // The unrelated standalone admin prototype file lives at repo root and is not
  // part of this app; exclude it from type-checking handled via tsconfig.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

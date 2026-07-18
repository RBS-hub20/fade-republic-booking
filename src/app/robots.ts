import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://quantumxglobal.online";

/**
 * /robots.txt — tells crawlers what to index and points them at the sitemap.
 *
 * The authenticated app (dashboard, wallet, reports, admin, API) is disallowed
 * so Google never wastes crawl budget on login-walled pages and never surfaces
 * them in results. The public marketing surface stays fully crawlable, which is
 * what lets Google fetch the homepage's <link rel="icon"> and show our logo.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/wallet",
        "/deposit",
        "/approvals",
        "/clients",
        "/ledger",
        "/charts",
        "/reports",
        "/qx-tiers",
        "/settings/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://quantumxglobal.online";

/**
 * /sitemap.xml — the public, indexable marketing surface. Giving Google an
 * explicit sitemap prompts a recrawl and speeds up how quickly branding
 * (favicon, title, OG image) is picked up in search results.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];
}

import type { MetadataRoute } from "next";

const BASE_URL = "https://healthwatch-global.com";
const LOCALES = ["en", "fr", "es", "ar", "id"];

// Pages indexed by search engines (priority order)
const PUBLIC_ROUTES = [
  { path: "",        changeFreq: "daily",   priority: 1.0 },
  { path: "/alerts", changeFreq: "monthly", priority: 0.8 },
  { path: "/pricing",changeFreq: "monthly", priority: 0.9 },
  { path: "/reports",changeFreq: "weekly",  priority: 0.7 },
  { path: "/about",  changeFreq: "monthly", priority: 0.6 },
  { path: "/contact",changeFreq: "yearly",  priority: 0.5 },
  { path: "/privacy",changeFreq: "yearly",  priority: 0.3 },
  { path: "/terms",  changeFreq: "yearly",  priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const route of PUBLIC_ROUTES) {
      entries.push({
        url: `${BASE_URL}/${locale}${route.path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFreq,
        priority: route.priority,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((l) => [l, `${BASE_URL}/${l}${route.path}`])
          ),
        },
      });
    }
  }

  return entries;
}

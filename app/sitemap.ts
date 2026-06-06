import type { MetadataRoute } from "next";

const BASE_URL = "https://healthwatch-global.com";
const LOCALES = ["en", "fr", "es", "ar", "id"];

// Pages indexed by search engines (priority order)
const PUBLIC_ROUTES = [
  { path: "",         changeFreq: "daily",   priority: 1.0 },
  { path: "/pricing", changeFreq: "weekly",  priority: 0.9 },
  { path: "/alerts",  changeFreq: "daily",   priority: 0.8 }, // outbreak data updated daily
  { path: "/reports", changeFreq: "weekly",  priority: 0.8 },
  { path: "/about",   changeFreq: "monthly", priority: 0.7 },
  { path: "/compare", changeFreq: "monthly", priority: 0.7 },
  { path: "/docs",    changeFreq: "weekly",  priority: 0.6 },
  { path: "/contact", changeFreq: "monthly", priority: 0.5 },
  { path: "/legal",   changeFreq: "yearly",  priority: 0.3 },
  { path: "/privacy", changeFreq: "yearly",  priority: 0.3 },
  { path: "/terms",   changeFreq: "yearly",  priority: 0.3 },
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
          languages: {
            ...Object.fromEntries(
              LOCALES.map((l) => [l, `${BASE_URL}/${l}${route.path}`])
            ),
            "x-default": `${BASE_URL}/en${route.path}`,
          },
        },
      });
    }
  }

  return entries;
}

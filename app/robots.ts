import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // "/api/feed" must win over the blanket "/api/" disallow below — it's
        // the public RSS feed (app/api/feed/route.ts), the only /api/ route
        // meant to be crawled. Listed first/more specific per the robots.txt
        // spec's longest-match-wins rule (Google, and most other crawlers,
        // resolve Allow vs Disallow ties on path length, not rule order).
        allow: ["/", "/api/feed"],
        disallow: [
          "/*/login",
          "/*/signup",
          "/*/account",
          "/*/forgot-password",
          "/*/reset-password",
          "/*/admin",
          "/*/qa-source-check",
          "/*/success",
          "/*/outbreak/*/print",
          "/api/",
        ],
      },
    ],
    sitemap: "https://healthwatch-global.com/sitemap.xml",
    host: "https://healthwatch-global.com",
  };
}

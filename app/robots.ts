import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/*/login",
          "/*/signup",
          "/*/account",
          "/*/forgot-password",
          "/*/reset-password",
          "/*/admin",
          "/*/success",
          "/api/",
        ],
      },
    ],
    sitemap: "https://healthwatch-global.com/sitemap.xml",
    host: "https://healthwatch-global.com",
  };
}

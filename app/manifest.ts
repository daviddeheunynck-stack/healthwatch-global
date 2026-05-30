import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "HealthWatch Global",
    short_name:       "HealthWatch",
    description:      "Real-time epidemic surveillance — WHO, CDC & ECDC data in 5 languages",
    start_url:        "/en",
    display:          "standalone",
    background_color: "#111827",
    theme_color:      "#dc2626",
    orientation:      "any",
    icons: [
      {
        src:     "/icon-192.png",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icon-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["health", "medical", "news"],
    lang:        "en",
    dir:         "ltr",
  };
}

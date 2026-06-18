import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "HealthWatch Global",
    short_name:       "HealthWatch",
    description:      "Epidemic surveillance — WHO, ECDC, PAHO & Africa CDC data in 5 languages",
    start_url:        "/en",
    display:          "standalone",
    background_color: "#111827",
    theme_color:      "#dc2626",
    orientation:      "any",
    // Next.js serves /icon (32px) and /apple-icon (180px) via app/icon.tsx and app/apple-icon.tsx.
    // For manifest icons, we reference the dynamic routes — browsers accept them as PNG.
    icons: [
      {
        src:     "/icon",
        sizes:   "32x32",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/apple-icon",
        sizes:   "180x180",
        type:    "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src:         "/og-screenshot.png",
        sizes:       "1200x630",
        type:        "image/png",
        form_factor: "wide",
        label:       "HealthWatch Global dashboard",
      },
    ],
    categories: ["health", "medical", "news"],
    lang:        "en",
    dir:         "ltr",
  };
}

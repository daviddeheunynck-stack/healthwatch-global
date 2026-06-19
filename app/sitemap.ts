import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { allDiseases, diseaseToSlug } from "@/lib/disease-data";

const BASE_URL = "https://healthwatch-global.com";
const LOCALES  = ["en", "fr", "es", "ar", "id"] as const;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const PUBLIC_ROUTES = [
  { path: "",         changeFreq: "daily",   priority: 1.0 },
  { path: "/pricing", changeFreq: "weekly",  priority: 0.9 },
  { path: "/alerts",  changeFreq: "daily",   priority: 0.8 },
  { path: "/reports", changeFreq: "weekly",  priority: 0.8 },
  { path: "/diseases", changeFreq: "daily",   priority: 0.9 },
  { path: "/pilot",   changeFreq: "monthly", priority: 0.8 },
  { path: "/about",   changeFreq: "monthly", priority: 0.7 },
  { path: "/compare", changeFreq: "monthly", priority: 0.7 },
  { path: "/docs",    changeFreq: "weekly",  priority: 0.6 },
  { path: "/embed",   changeFreq: "monthly", priority: 0.7 },
  { path: "/coming-soon", changeFreq: "daily",   priority: 0.6 },
  { path: "/contact",    changeFreq: "monthly", priority: 0.5 },
  { path: "/legal",      changeFreq: "yearly",  priority: 0.3 },
  { path: "/privacy", changeFreq: "yearly",  priority: 0.3 },
  { path: "/terms",   changeFreq: "yearly",  priority: 0.3 },
] as const;

function localeAlternates(path: string) {
  return {
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `${BASE_URL}/${l}${path}`])),
      "x-default": `${BASE_URL}/en${path}`,
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // ── Static routes ────────────────────────────────────────────────────────
  for (const locale of LOCALES) {
    for (const route of PUBLIC_ROUTES) {
      entries.push({
        url: `${BASE_URL}/${locale}${route.path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFreq,
        priority: route.priority,
        alternates: localeAlternates(route.path),
      });
    }
  }

  // ── Outbreak pages — one per active outbreak per locale ──────────────────
  try {
    const supabase = createClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );
    const { data: outbreaks } = await supabase
      .from("outbreaks")
      .select("id, date")
      .eq("active", true)
      .order("date", { ascending: false });

    for (const o of outbreaks ?? []) {
      const outbreakPath = `/outbreak/${o.id}`;
      const lastMod = o.date ? new Date(o.date) : new Date();
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}${outbreakPath}`,
          lastModified: lastMod,
          changeFrequency: "daily",
          priority: 0.7,
          alternates: localeAlternates(outbreakPath),
        });
      }
    }

    // Historical outbreaks — lower priority; rarely change so changeFrequency: monthly
    const { data: historical } = await supabase
      .from("outbreaks")
      .select("id, date")
      .eq("active", false)
      .order("date", { ascending: false })
      .limit(500);

    for (const o of historical ?? []) {
      const outbreakPath = `/outbreak/${o.id}`;
      const lastMod = o.date ? new Date(o.date) : new Date();
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}${outbreakPath}`,
          lastModified: lastMod,
          changeFrequency: "monthly",
          priority: 0.5,
          alternates: localeAlternates(outbreakPath),
        });
      }
    }
  } catch {
    // DB unreachable at build time — static routes still returned
  }

  // ── Region pages — 5 regions × 5 locales ───────────────────────────────
  const REGIONS = ["africa", "asia", "europe", "americas", "oceania"];
  for (const region of REGIONS) {
    const regionPath = `/region/${region}`;
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${regionPath}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.8,
        alternates: localeAlternates(regionPath),
      });
    }
  }

  // ── Disease profile pages — all diseases × 5 locales ────────────────────
  for (const disease of allDiseases()) {
    const slug = diseaseToSlug(disease.name_en);
    const diseasePath = `/disease/${slug}`;
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${diseasePath}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.8,
        alternates: localeAlternates(diseasePath),
      });
    }
  }

  return entries;
}

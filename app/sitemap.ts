import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { allDiseases, diseaseToSlug } from "@/lib/disease-data";
import { countryToSlug } from "@/lib/country-utils";

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
  { path: "/docs",      changeFreq: "weekly",  priority: 0.6 },
  { path: "/embed",     changeFreq: "monthly", priority: 0.7 },
  { path: "/countries", changeFreq: "daily",   priority: 0.8 },
  { path: "/regions",   changeFreq: "daily",   priority: 0.8 },
  { path: "/coming-soon", changeFreq: "daily",   priority: 0.6 },
  { path: "/methodology", changeFreq: "monthly", priority: 0.7 },
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

  // Shared DB client — null if env vars missing at build time; try blocks catch the null ref gracefully
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? createClient(
        clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      )
    : null;

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
    const { data: outbreaks } = await supabase!
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
    const { data: historical } = await supabase!
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

  // ── Country pages — all countries × 5 locales ────────────────────────────
  try {
    const { data: countryRows } = await supabase!
      .from("outbreaks")
      .select("country_en")
      .not("country_en", "is", null);

    const uniqueCountries = [
      ...new Set((countryRows ?? []).map((r) => r.country_en as string).filter(Boolean)),
    ];

    for (const c of uniqueCountries) {
      const countryPath = `/country/${countryToSlug(c)}`;
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}${countryPath}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.7,
          alternates: localeAlternates(countryPath),
        });
      }
    }
  } catch {
    // DB unreachable at build time — skip country pages
  }

  return entries;
}

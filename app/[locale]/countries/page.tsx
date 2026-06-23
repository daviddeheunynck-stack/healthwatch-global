// Index of all countries with recorded outbreaks.
// URL: /[locale]/countries
// ISR: 1 hour

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";
import { countryToSlug, getLocalizedCountryName } from "@/lib/country-utils";
import type { Outbreak } from "@/lib/outbreaks";

export const revalidate = 3600;

const BASE_URL = "https://healthwatch-global.com";
const LOCALES  = ["en", "fr", "es", "ar", "id"] as const;
type Locale    = typeof LOCALES[number];

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const LABELS: Record<Locale, {
  title: string; subtitle: string;
  active: (n: number) => string; noActive: string;
  total: string; cases: string; back: string;
  metaTitle: string; metaDesc: string;
  sortActive: string; sortAlpha: string;
  regionLabel: Record<string, string>;
}> = {
  en: {
    title: "Countries",
    subtitle: "Every country where a WHO, ECDC, PAHO or Africa CDC outbreak has been recorded.",
    active: (n) => n === 1 ? "1 active" : `${n} active`,
    noActive: "No active outbreaks",
    total: "total outbreaks",
    cases: "cases",
    back: "← Dashboard",
    metaTitle: "Disease Outbreaks by Country — HealthWatch Global",
    metaDesc: "Browse all countries with recorded disease outbreaks from WHO, ECDC, PAHO and Africa CDC. Active and historical data.",
    sortActive: "Active first",
    sortAlpha: "A–Z",
    regionLabel: { africa: "Africa", asia: "Asia", americas: "Americas", europe: "Europe", oceania: "Oceania", other: "Other" },
  },
  fr: {
    title: "Pays",
    subtitle: "Tous les pays où un foyer épidémique OMS, ECDC, PAHO ou Africa CDC a été enregistré.",
    active: (n) => n === 1 ? "1 actif" : `${n} actifs`,
    noActive: "Aucun foyer actif",
    total: "foyers au total",
    cases: "cas",
    back: "← Tableau de bord",
    metaTitle: "Foyers épidémiques par pays — HealthWatch Global",
    metaDesc: "Explorez tous les pays avec des foyers enregistrés par l'OMS, l'ECDC, le PAHO et Africa CDC. Données actives et historiques.",
    sortActive: "Actifs en premier",
    sortAlpha: "A–Z",
    regionLabel: { africa: "Afrique", asia: "Asie", americas: "Amériques", europe: "Europe", oceania: "Océanie", other: "Autre" },
  },
  es: {
    title: "Países",
    subtitle: "Todos los países donde se ha registrado un brote de OMS, ECDC, PAHO o Africa CDC.",
    active: (n) => n === 1 ? "1 activo" : `${n} activos`,
    noActive: "Sin brotes activos",
    total: "brotes en total",
    cases: "casos",
    back: "← Panel",
    metaTitle: "Brotes de enfermedades por país — HealthWatch Global",
    metaDesc: "Explore todos los países con brotes registrados por OMS, ECDC, PAHO y Africa CDC. Datos activos e históricos.",
    sortActive: "Activos primero",
    sortAlpha: "A–Z",
    regionLabel: { africa: "África", asia: "Asia", americas: "Américas", europe: "Europa", oceania: "Oceanía", other: "Otro" },
  },
  ar: {
    title: "الدول",
    subtitle: "جميع الدول التي سُجّل فيها تفشٍّ وبائي بواسطة منظمة الصحة العالمية أو ECDC أو PAHO أو Africa CDC.",
    active: (n) => `${n} نشط`,
    noActive: "لا تفشيات نشطة",
    total: "تفشيات إجمالاً",
    cases: "حالة",
    back: "→ لوحة التحكم",
    metaTitle: "تفشيات الأمراض حسب الدولة — HealthWatch Global",
    metaDesc: "تصفح جميع الدول التي سُجّلت فيها تفشيات بواسطة منظمة الصحة العالمية وECDC وPAHO وAfrica CDC.",
    sortActive: "النشطة أولاً",
    sortAlpha: "أ–ي",
    regionLabel: { africa: "أفريقيا", asia: "آسيا", americas: "الأمريكتان", europe: "أوروبا", oceania: "أوقيانوسيا", other: "أخرى" },
  },
  id: {
    title: "Negara",
    subtitle: "Semua negara yang pernah mencatat wabah dari WHO, ECDC, PAHO atau Africa CDC.",
    active: (n) => n === 1 ? "1 aktif" : `${n} aktif`,
    noActive: "Tidak ada wabah aktif",
    total: "total wabah",
    cases: "kasus",
    back: "← Dasbor",
    metaTitle: "Wabah Penyakit per Negara — HealthWatch Global",
    metaDesc: "Jelajahi semua negara dengan wabah yang tercatat dari WHO, ECDC, PAHO dan Africa CDC. Data aktif dan historis.",
    sortActive: "Aktif dulu",
    sortAlpha: "A–Z",
    regionLabel: { africa: "Afrika", asia: "Asia", americas: "Amerika", europe: "Eropa", oceania: "Oseania", other: "Lainnya" },
  },
};

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const lb = LABELS[l];
  const url = `${BASE_URL}/${l}/countries`;

  return {
    title: lb.metaTitle,
    description: lb.metaDesc,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_URL}/${loc}/countries`])),
        "x-default": `${BASE_URL}/en/countries`,
      },
    },
    openGraph: {
      title: lb.metaTitle,
      description: lb.metaDesc,
      url,
      type: "website",
      siteName: "HealthWatch Global",
    },
    twitter: { card: "summary_large_image", title: lb.metaTitle, description: lb.metaDesc },
    robots: { index: true, follow: true },
  };
}

// ── Data ──────────────────────────────────────────────────────────────────────

interface CountryStats {
  country_en: string;
  country:    string;
  country_ar: string | null;
  region:     string;
  activeCount: number;
  totalCount:  number;
  totalCases:  number;
}

async function fetchCountryStats(): Promise<CountryStats[]> {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data } = await supabase
    .from("outbreaks")
    .select("country_en, country, country_ar, region, active, cases")
    .not("country_en", "is", null);

  if (!data) return [];

  const map = new Map<string, CountryStats>();
  for (const o of data as Pick<Outbreak, "country_en" | "country" | "country_ar" | "region" | "active" | "cases">[]) {
    if (!o.country_en) continue;
    const existing = map.get(o.country_en);
    if (existing) {
      if (o.active) existing.activeCount++;
      existing.totalCount++;
      existing.totalCases += o.cases ?? 0;
    } else {
      map.set(o.country_en, {
        country_en:  o.country_en,
        country:     o.country ?? o.country_en,
        country_ar:  o.country_ar ?? null,
        region:      o.region ?? "",
        activeCount: o.active ? 1 : 0,
        totalCount:  1,
        totalCases:  o.cases ?? 0,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
    return a.country_en.localeCompare(b.country_en);
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CountriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l  = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const lb = LABELS[l];
  const isRtl = l === "ar";

  const countries = await fetchCountryStats();
  const activeCount = countries.filter((c) => c.activeCount > 0).length;
  const totalCases  = countries.reduce((s, c) => s + c.totalCases, 0);

  const regionGroups = new Map<string, CountryStats[]>();
  for (const c of countries) {
    const r = c.region || "other";
    if (!regionGroups.has(r)) regionGroups.set(r, []);
    regionGroups.get(r)!.push(c);
  }

  const REGION_ORDER = ["africa", "asia", "americas", "europe", "oceania", "other"];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: lb.metaTitle,
      description: lb.metaDesc,
      url: `${BASE_URL}/${l}/countries`,
      creator: { "@type": "Organization", name: "HealthWatch Global", url: BASE_URL },
      ...(activeCount > 0 && { measurementTechnique: `${activeCount} countr${activeCount === 1 ? "y" : "ies"} with active outbreaks` }),
      ...(totalCases > 0 && { size: `${totalCases.toLocaleString("en")} confirmed cases tracked` }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "HealthWatch Global", item: `${BASE_URL}/${l}` },
        { "@type": "ListItem", position: 2, name: lb.title, item: `${BASE_URL}/${l}/countries` },
      ],
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-10" dir={isRtl ? "rtl" : "ltr"}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <div className="space-y-3">
        <Link href={`/${l}`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          {lb.back}
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl font-bold text-white">{lb.title}</h1>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              {lb.active(activeCount)}
            </span>
          )}
        </div>
        <p className="text-gray-400 leading-relaxed max-w-2xl">{lb.subtitle}</p>
        <div className="flex items-center gap-4">
          <Link href={`/${l}/diseases`} className="text-sm text-gray-500 hover:text-red-400 transition-colors">
            {l === "fr" ? "→ Par maladie" : l === "es" ? "→ Por enfermedad" : l === "ar" ? "← حسب المرض" : l === "id" ? "→ Per penyakit" : "→ By disease"}
          </Link>
          <Link href={`/${l}/regions`} className="text-sm text-gray-500 hover:text-red-400 transition-colors">
            {l === "fr" ? "→ Par région" : l === "es" ? "→ Por región" : l === "ar" ? "← حسب المنطقة" : l === "id" ? "→ Per wilayah" : "→ By region"}
          </Link>
        </div>
      </div>

      {/* Countries by region */}
      {REGION_ORDER.map((region) => {
        const group = regionGroups.get(region);
        if (!group || group.length === 0) return null;
        const regionLabel = lb.regionLabel[region] ?? region;

        return (
          <section key={region} className="space-y-3">
            <h2 className="text-lg font-bold text-white border-b border-gray-800 pb-2">
              {regionLabel}
              <span className="ml-2 text-sm font-normal text-gray-500">({group.length})</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.map((c) => {
                const displayName = getLocalizedCountryName(c, l);
                const slug = countryToSlug(c.country_en);
                const hasActive = c.activeCount > 0;

                return (
                  <Link
                    key={c.country_en}
                    href={`/${l}/country/${slug}`}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors group ${
                      hasActive
                        ? "bg-red-950/20 border-red-800/30 hover:border-red-700/50 hover:bg-red-950/30"
                        : "bg-gray-900/40 border-gray-800 hover:border-gray-700 hover:bg-gray-900/60"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm truncate ${hasActive ? "text-white" : "text-gray-300"} group-hover:text-white transition-colors`}>
                        {displayName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.totalCount} {lb.total}
                        {c.totalCases > 0 && ` · ${c.totalCases.toLocaleString(l)} ${lb.cases}`}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {hasActive ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          {lb.active(c.activeCount)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">{lb.noActive}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

    </div>
  );
}

// Hub page per WHO region — aggregates all outbreaks in one geographic zone.
// URL: /[locale]/region/[region]  e.g. /fr/region/africa
// ISR: regenerated every hour.

import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { diseaseToSlug, normalizeDisease } from "@/lib/disease-data";
import { getOutbreakTrendsBulk } from "@/lib/outbreak-trend";
import type { Outbreak } from "@/lib/outbreaks";
import EmailCapture from "@/components/EmailCapture";

export const revalidate = 3600;

const BASE_URL = "https://healthwatch-global.com";
const LOCALES  = ["en", "fr", "es", "ar", "id"] as const;
type Locale    = typeof LOCALES[number];

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const REGIONS = ["africa", "asia", "europe", "americas", "oceania"] as const;
type Region = typeof REGIONS[number];

// ── Labels ────────────────────────────────────────────────────────────────────
const REGION_NAME: Record<Locale, Record<Region, string>> = {
  fr: { africa: "Afrique",   asia: "Asie",  europe: "Europe",  americas: "Amériques", oceania: "Océanie"    },
  en: { africa: "Africa",    asia: "Asia",  europe: "Europe",  americas: "Americas",  oceania: "Oceania"    },
  es: { africa: "África",    asia: "Asia",  europe: "Europa",  americas: "Américas",  oceania: "Oceanía"    },
  ar: { africa: "أفريقيا",  asia: "آسيا", europe: "أوروبا", americas: "الأمريكتان", oceania: "أوقيانوسيا" },
  id: { africa: "Afrika",    asia: "Asia",  europe: "Eropa",   americas: "Amerika",   oceania: "Oseania"    },
};

const LABELS: Record<Locale, {
  active: (n: number) => string; noActive: string;
  cases: string; deaths: string; countries: string; outbreaks: string;
  activeSection: string; historySection: string; noHistory: string;
  risk: Record<string, string>;
  ctaTitle: string; ctaBody: string; ctaBtn: string;
  back: string; regionsHub: string; cases_unit: string; deaths_unit: string; noData: string;
}> = {
  fr: {
    active: (n) => n === 1 ? "1 foyer actif" : `${n} foyers actifs`,
    noActive: "Aucun foyer actif", cases: "Cas", deaths: "Décès",
    countries: "Pays", outbreaks: "Foyers total",
    activeSection: "Foyers en cours", historySection: "Historique",
    noHistory: "Aucun foyer historique.",
    risk: { high: "RISQUE ÉLEVÉ", medium: "RISQUE MODÉRÉ", low: "RISQUE FAIBLE" },
    ctaTitle: "Alertes en temps réel pour cette région",
    ctaBody: "Soyez alerté dès qu'un nouveau foyer est détecté.",
    ctaBtn: "Commencer gratuitement →", back: "← Tableau de bord", regionsHub: "Régions",
    cases_unit: "cas", deaths_unit: "décès", noData: "N/D",
  },
  en: {
    active: (n) => n === 1 ? "1 active outbreak" : `${n} active outbreaks`,
    noActive: "No active outbreaks", cases: "Cases", deaths: "Deaths",
    countries: "Countries", outbreaks: "Total outbreaks",
    activeSection: "Active outbreaks", historySection: "Outbreak history",
    noHistory: "No historical outbreaks on record.",
    risk: { high: "HIGH RISK", medium: "MODERATE RISK", low: "LOW RISK" },
    ctaTitle: "Real-time alerts for this region",
    ctaBody: "Be notified as soon as a new outbreak is detected.",
    ctaBtn: "Start for free →", back: "← Dashboard", regionsHub: "Regions",
    cases_unit: "cases", deaths_unit: "deaths", noData: "N/A",
  },
  es: {
    active: (n) => n === 1 ? "1 brote activo" : `${n} brotes activos`,
    noActive: "Sin brotes activos", cases: "Casos", deaths: "Fallecidos",
    countries: "Países", outbreaks: "Brotes totales",
    activeSection: "Brotes en curso", historySection: "Historial",
    noHistory: "Sin brotes históricos.",
    risk: { high: "RIESGO ALTO", medium: "RIESGO MODERADO", low: "RIESGO BAJO" },
    ctaTitle: "Alertas en tiempo real para esta región",
    ctaBody: "Sé notificado en cuanto se detecte un nuevo brote.",
    ctaBtn: "Empezar gratis →", back: "← Panel", regionsHub: "Regiones",
    cases_unit: "casos", deaths_unit: "fallecidos", noData: "N/D",
  },
  ar: {
    active: (n) => n === 1 ? "تفشٍّ نشط" : `${n} تفشيات نشطة`,
    noActive: "لا تفشيات نشطة", cases: "الحالات", deaths: "الوفيات",
    countries: "الدول", outbreaks: "إجمالي التفشيات",
    activeSection: "التفشيات الجارية", historySection: "السجل التاريخي",
    noHistory: "لا سجل لتفشيات سابقة.",
    risk: { high: "خطر مرتفع", medium: "خطر متوسط", low: "خطر منخفض" },
    ctaTitle: "تنبيهات فورية لهذه المنطقة",
    ctaBody: "احصل على إشعار فور اكتشاف تفشٍّ جديد.",
    ctaBtn: "ابدأ مجاناً ←", back: "→ لوحة التحكم", regionsHub: "المناطق",
    cases_unit: "حالة", deaths_unit: "وفاة", noData: "غ/م",
  },
  id: {
    active: (n) => n === 1 ? "1 wabah aktif" : `${n} wabah aktif`,
    noActive: "Tidak ada wabah aktif", cases: "Kasus", deaths: "Kematian",
    countries: "Negara", outbreaks: "Total wabah",
    activeSection: "Wabah aktif", historySection: "Riwayat wabah",
    noHistory: "Tidak ada riwayat wabah.",
    risk: { high: "RISIKO TINGGI", medium: "RISIKO SEDANG", low: "RISIKO RENDAH" },
    ctaTitle: "Peringatan real-time untuk wilayah ini",
    ctaBody: "Dapatkan notifikasi segera setelah wabah baru terdeteksi.",
    ctaBtn: "Mulai gratis →", back: "← Dasbor", regionsHub: "Wilayah",
    cases_unit: "kasus", deaths_unit: "kematian", noData: "T/S",
  },
};

const RISK_STYLE: Record<string, string> = {
  high:   "text-red-400 bg-red-500/10 border border-red-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border border-yellow-500/30",
  low:    "text-green-400 bg-green-500/10 border border-green-500/30",
};

const TREND_ICON  = { up: "▲", stable: "→", down: "▼" } as const;
const TREND_COLOR = { up: "text-red-400", stable: "text-gray-400", down: "text-green-400" } as const;

// ── Data ─────────────────────────────────────────────────────────────────────
async function fetchRegionOutbreaks(region: string): Promise<Outbreak[]> {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  const { data } = await supabase
    .from("outbreaks")
    .select("*")
    .eq("region", region)
    .order("date", { ascending: false });
  return (data ?? []) as Outbreak[];
}

// ── Static params ─────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const params: { locale: string; region: string }[] = [];
  for (const locale of LOCALES) {
    for (const region of REGIONS) {
      params.push({ locale, region });
    }
  }
  return params;
}

// ── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!REGIONS.includes(region as Region)) return { title: "Not found" };

  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const regionName = REGION_NAME[l][region as Region];

  const TITLE: Record<Locale, string> = {
    fr: `Épidémies en ${regionName} — Surveillance OMS · HealthWatch Global`,
    en: `Disease outbreaks in ${regionName} — WHO surveillance · HealthWatch Global`,
    es: `Brotes en ${regionName} — Vigilancia OMS · HealthWatch Global`,
    ar: `تفشيات الأمراض في ${regionName} — مراقبة منظمة الصحة العالمية · HealthWatch Global`,
    id: `Wabah penyakit di ${regionName} — Pengawasan WHO · HealthWatch Global`,
  };
  const DESC: Record<Locale, string> = {
    fr: `Tous les foyers de maladies infectieuses actifs et historiques en ${regionName}. Données officielles OMS, ECDC, PAHO et Africa CDC, mises à jour toutes les heures par HealthWatch Global.`,
    en: `All active and historical infectious disease outbreaks in ${regionName}. Official WHO, ECDC, PAHO and Africa CDC data, updated every hour by HealthWatch Global.`,
    es: `Todos los brotes activos e históricos en ${regionName}. Datos oficiales OMS, ECDC, PAHO y Africa CDC, actualizados cada hora por HealthWatch Global.`,
    ar: `جميع تفشيات الأمراض المعدية النشطة والتاريخية في ${regionName}. بيانات رسمية من منظمة الصحة العالمية، ECDC، PAHO وAfrica CDC، محدّثة كل ساعة.`,
    id: `Semua wabah penyakit menular aktif dan historis di ${regionName}. Data resmi WHO, ECDC, PAHO dan Africa CDC, diperbarui setiap jam oleh HealthWatch Global.`,
  };

  const canonical = `${BASE_URL}/${l}/region/${region}`;

  return {
    title: TITLE[l],
    description: DESC[l],
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_URL}/${loc}/region/${region}`])),
        "x-default": `${BASE_URL}/en/region/${region}`,
      },
    },
    openGraph: { title: TITLE[l], description: DESC[l], url: canonical, siteName: "HealthWatch Global", type: "website" },
    twitter:   { card: "summary_large_image", title: TITLE[l], description: DESC[l] },
    robots:    { index: true, follow: true },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function RegionPage({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!REGIONS.includes(region as Region)) notFound();

  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const lb = LABELS[l];
  const isRtl = l === "ar";
  const regionName = REGION_NAME[l][region as Region];

  const allOutbreaks = await fetchRegionOutbreaks(region);
  if (allOutbreaks.length === 0) notFound();

  const active  = allOutbreaks.filter((o) => o.active);
  const history = allOutbreaks.filter((o) => !o.active);

  const totalCases  = allOutbreaks.reduce((s, o) => s + (o.cases || 0), 0);
  const totalDeaths = allOutbreaks.reduce((s, o) => s + (o.deaths || 0), 0);
  const numLocale   = l === "ar" ? "ar-SA" : l;
  const countriesSet = new Set(allOutbreaks.map((o) => o.country_en || o.country).filter(Boolean));

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  const trendsMap = active.length > 0
    ? await getOutbreakTrendsBulk(supabase, active.map((o) => o.id))
    : new Map();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${regionName} — Disease Outbreaks`,
      description: `${active.length} active outbreak${active.length !== 1 ? "s" : ""} in ${regionName}. ${countriesSet.size} countries tracked. Official WHO, ECDC, PAHO and Africa CDC data.`,
      url: `${BASE_URL}/${l}/region/${region}`,
      spatialCoverage: { "@type": "Place", name: regionName },
      creator: { "@type": "Organization", name: "HealthWatch Global", url: BASE_URL },
      ...(totalCases > 0 && { measurementTechnique: `${totalCases.toLocaleString("en")} confirmed cases tracked` }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "HealthWatch Global", item: `${BASE_URL}/${l}` },
        { "@type": "ListItem", position: 2, name: "Regions", item: `${BASE_URL}/${l}/regions` },
        { "@type": "ListItem", position: 3, name: regionName, item: `${BASE_URL}/${l}/region/${region}` },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10" dir={isRtl ? "rtl" : undefined}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/${l}`} className="hover:text-gray-300 transition-colors">{lb.back}</Link>
        <span className="text-gray-700">·</span>
        <Link href={`/${l}/regions`} className="hover:text-gray-300 transition-colors">{lb.regionsHub}</Link>
        <span className="text-gray-700">·</span>
        <span className="text-gray-400">{regionName}</span>
      </nav>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-white">{regionName}</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            active.length > 0
              ? "bg-red-500/15 text-red-400 border border-red-500/30"
              : "bg-gray-800 text-gray-400 border border-gray-700"
          }`}>
            {active.length > 0 ? lb.active(active.length) : lb.noActive}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: lb.cases,     value: totalCases  > 0 ? totalCases.toLocaleString(numLocale)  : lb.noData },
          { label: lb.deaths,    value: totalDeaths > 0 ? totalDeaths.toLocaleString(numLocale) : lb.noData },
          { label: lb.countries, value: countriesSet.size.toString() },
          { label: lb.outbreaks, value: allOutbreaks.length.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Active outbreaks */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{lb.activeSection}</h2>
          <div className="space-y-3">
            {active.map((o) => {
              const trend    = trendsMap.get(o.id);
              const disease  = getLocalizedDisease(o, l);
              const country  = getLocalizedCountry(o, l);
              const riskKey  = o.risk_level as string;

              return (
                <div
                  key={o.id}
                  className="relative bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors group"
                >
                  <Link
                    href={`/${l}/outbreak/${o.id}`}
                    className="absolute inset-0 rounded-xl"
                    aria-label={`${disease} – ${country}`}
                  />
                  <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <Link
                        href={`/${l}/disease/${diseaseToSlug(normalizeDisease(o.disease_en || o.disease).name_en)}`}
                        className="font-semibold text-white group-hover:text-red-400 transition-colors hover:underline"
                      >
                        {disease}
                      </Link>
                      <p className="text-sm text-gray-400">
                        📍 {country}
                        {o.cases > 0 && <span className="ml-2">· {o.cases.toLocaleString(numLocale)} {lb.cases_unit}</span>}
                        {o.deaths > 0 && <span className="ml-1 text-gray-500">· {o.deaths.toLocaleString(numLocale)} {lb.deaths_unit}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {trend && trend.direction !== "unknown" && (
                        <span className={`text-xs font-medium ${TREND_COLOR[trend.direction as "up"|"stable"|"down"]}`}>
                          {TREND_ICON[trend.direction as "up"|"stable"|"down"]}
                          {trend.deltaPercent !== 0 && ` ${Math.abs(trend.deltaPercent)}%`}
                        </span>
                      )}
                      {riskKey && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${RISK_STYLE[riskKey] ?? ""}`}>
                          {(lb.risk as Record<string, string>)[riskKey]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Historical outbreaks */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{lb.historySection}</h2>
          <div className="space-y-2">
            {history.map((o) => {
              const disease = getLocalizedDisease(o, l);
              const country = getLocalizedCountry(o, l);
              return (
                <Link
                  key={o.id}
                  href={`/${l}/outbreak/${o.id}`}
                  className="flex items-center justify-between gap-4 bg-gray-900/50 border border-gray-800/60 hover:border-gray-700 rounded-lg px-4 py-3 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-gray-600 text-sm shrink-0">
                      {o.date ? new Date(o.date).getFullYear() : "—"}
                    </span>
                    <span className="text-gray-300 group-hover:text-white transition-colors truncate font-medium">
                      {disease}
                    </span>
                    <span className="text-gray-500 text-sm truncate hidden sm:block">· {country}</span>
                  </div>
                  <span className="text-sm text-gray-500 shrink-0">
                    {o.cases > 0 ? `${o.cases.toLocaleString(numLocale)} ${lb.cases_unit}` : lb.noData}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Email capture CTA */}
      <EmailCapture locale={l} region={region} title={lb.ctaTitle} body={lb.ctaBody} />
    </div>
  );
}

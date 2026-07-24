// Country hub page — all outbreaks for a single country.
// URL: /[locale]/country/[slug]  e.g. /en/country/democratic-republic-of-the-congo
// ISR: 1 hour

import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { countryToSlug, slugToCountryEn } from "@/lib/country-utils";
import { getLocalizedDisease, getLocalizedCountry, filterDisplayActive } from "@/lib/outbreaks";
import { allDiseases, diseaseToSlug } from "@/lib/disease-data";
import type { DiseaseInfo, AppRegion } from "@/lib/disease-data";
import type { Outbreak } from "@/lib/outbreaks";
import { getOutbreakTrendsBulkCached } from "@/lib/outbreak-trend";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";
import { jsonLdHtml } from "@/lib/json-ld";
import WatchButton from "@/components/WatchButton";
import EmailCapture from "@/components/EmailCapture";
import CountryAlertNudge from "@/components/CountryAlertNudge";

export const revalidate = 3600;

const BASE_URL = "https://healthwatch-global.com";
const LOCALES  = ["en", "fr", "es", "ar", "id"] as const;
type Locale    = typeof LOCALES[number];

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const RISK_STYLE: Record<string, string> = {
  high:   "text-red-400 bg-red-500/10 border-red-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  low:    "text-green-400 bg-green-500/10 border-green-500/30",
};

const TREND_ICON  = { up: "▲", stable: "→", down: "▼" } as const;
const TREND_COLOR = { up: "text-red-400", stable: "text-gray-500", down: "text-green-400" } as const;

const LABELS: Record<Locale, {
  activeSection: string; historySection: string; noHistory: string; noActive: string;
  cases: string; deaths: string; cfr: string; diseases: string;
  activeBadge: (n: number) => string;
  risk: Record<string, string>;
  ctaTitle: string; ctaBody: string; ctaBtn: string;
  back: string; noData: string; source: string;
  outbreaksSince: string; lastUpdated: string;
}> = {
  en: {
    activeSection: "Active outbreaks",
    historySection: "Outbreak history",
    noHistory: "No historical outbreaks on record.",
    noActive: "No active outbreaks",
    cases: "Confirmed cases", deaths: "Deaths", cfr: "Case fatality rate",
    diseases: "Diseases recorded",
    activeBadge: (n) => n === 1 ? "1 active outbreak" : `${n} active outbreaks`,
    risk: { high: "HIGH RISK", medium: "MODERATE RISK", low: "LOW RISK" },
    ctaTitle: "Get outbreak alerts for this region",
    ctaBody: "Be notified the moment a new outbreak is reported in your area of interest, or an existing one escalates.",
    ctaBtn: "Start for free →",
    back: "← Dashboard",
    noData: "N/A",
    source: "Source",
    outbreaksSince: "outbreaks tracked",
    lastUpdated: "Data as of",
  },
  fr: {
    activeSection: "Foyers en cours",
    historySection: "Historique des épidémies",
    noHistory: "Aucun foyer historique enregistré.",
    noActive: "Aucun foyer actif",
    cases: "Cas confirmés", deaths: "Décès", cfr: "Létalité",
    diseases: "Maladies enregistrées",
    activeBadge: (n) => n === 1 ? "1 foyer actif" : `${n} foyers actifs`,
    risk: { high: "RISQUE ÉLEVÉ", medium: "RISQUE MODÉRÉ", low: "RISQUE FAIBLE" },
    ctaTitle: "Recevoir les alertes pour cette région",
    ctaBody: "Soyez alerté dès qu'un nouveau foyer est signalé dans votre zone d'intérêt, ou qu'un foyer existant s'aggrave.",
    ctaBtn: "Commencer gratuitement →",
    back: "← Tableau de bord",
    noData: "N/D",
    source: "Source",
    outbreaksSince: "foyers suivis",
    lastUpdated: "Données au",
  },
  es: {
    activeSection: "Brotes en curso",
    historySection: "Historial de epidemias",
    noHistory: "Sin brotes históricos registrados.",
    noActive: "Sin brotes activos",
    cases: "Casos confirmados", deaths: "Fallecidos", cfr: "Tasa de letalidad",
    diseases: "Enfermedades registradas",
    activeBadge: (n) => n === 1 ? "1 brote activo" : `${n} brotes activos`,
    risk: { high: "RIESGO ALTO", medium: "RIESGO MODERADO", low: "RIESGO BAJO" },
    ctaTitle: "Recibe alertas para esta región",
    ctaBody: "Sé notificado en cuanto se reporte un nuevo brote en tu área de interés, o si un brote existente se agrava.",
    ctaBtn: "Empezar gratis →",
    back: "← Panel",
    noData: "N/D",
    source: "Fuente",
    outbreaksSince: "brotes registrados",
    lastUpdated: "Datos al",
  },
  ar: {
    activeSection: "التفشيات الجارية",
    historySection: "تاريخ الأوبئة",
    noHistory: "لا سجل لتفشيات سابقة.",
    noActive: "لا تفشيات نشطة",
    cases: "الحالات المؤكدة", deaths: "الوفيات", cfr: "معدل الوفيات",
    diseases: "الأمراض المسجلة",
    activeBadge: (n) => n === 1 ? "تفشٍّ نشط واحد" : `${n} تفشيات نشطة`,
    risk: { high: "خطر مرتفع", medium: "خطر متوسط", low: "خطر منخفض" },
    ctaTitle: "احصل على تنبيهات لهذه المنطقة",
    ctaBody: "كن أول من يعلم عند الإبلاغ عن تفشٍّ جديد في منطقتك، أو تفاقم تفشٍّ قائم.",
    ctaBtn: "ابدأ مجاناً ←",
    back: "→ لوحة التحكم",
    noData: "غ/م",
    source: "المصدر",
    outbreaksSince: "تفشيات مرصودة",
    lastUpdated: "بيانات حتى",
  },
  id: {
    activeSection: "Wabah yang sedang berlangsung",
    historySection: "Riwayat epidemi",
    noHistory: "Tidak ada riwayat wabah.",
    noActive: "Tidak ada wabah aktif",
    cases: "Kasus terkonfirmasi", deaths: "Kematian", cfr: "Tingkat kematian",
    diseases: "Penyakit tercatat",
    activeBadge: (n) => n === 1 ? "1 wabah aktif" : `${n} wabah aktif`,
    risk: { high: "RISIKO TINGGI", medium: "RISIKO SEDANG", low: "RISIKO RENDAH" },
    ctaTitle: "Dapatkan peringatan untuk wilayah ini",
    ctaBody: "Dapatkan notifikasi segera setelah wabah baru dilaporkan di area Anda, atau saat wabah yang ada memburuk.",
    ctaBtn: "Mulai gratis →",
    back: "← Dasbor",
    noData: "T/S",
    source: "Sumber",
    outbreaksSince: "wabah terlacak",
    lastUpdated: "Data per",
  },
};

// ── Traveler risk labels ──────────────────────────────────────────────────────

const TRAVELER_LABELS: Record<Locale, { title: string; high: string; moderate: string; note: string }> = {
  en: { title: "Traveler health advisory", high: "High risk", moderate: "Moderate risk", note: "Regional-level risk based on endemic disease burden. Consult a travel health specialist." },
  fr: { title: "Avertissement santé voyageurs", high: "Risque élevé", moderate: "Risque modéré", note: "Risque au niveau régional. Consultez un médecin spécialisé en médecine du voyage." },
  es: { title: "Aviso sanitario para viajeros", high: "Riesgo alto", moderate: "Riesgo moderado", note: "Riesgo a nivel regional. Consulte a un especialista en medicina del viajero." },
  ar: { title: "تنبيه صحي للمسافرين", high: "خطر مرتفع", moderate: "خطر متوسط", note: "خطر على المستوى الإقليمي. استشر طبيب متخصص في طب السفر." },
  id: { title: "Peringatan kesehatan wisatawan", high: "Risiko tinggi", moderate: "Risiko sedang", note: "Risiko tingkat regional. Konsultasikan dengan dokter spesialis kesehatan perjalanan." },
};

function getDiseaseName(d: DiseaseInfo, locale: string): string {
  if (locale === "fr") return d.name_fr;
  if (locale === "es") return d.name_es;
  if (locale === "ar") return d.name_ar;
  if (locale === "id") return d.name_id;
  return d.name_en;
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function db() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

async function getAllCountryEn(): Promise<string[]> {
  const { data } = await db()
    .from("outbreaks")
    .select("country_en")
    .not("country_en", "is", null);
  if (!data) return [];
  const unique = new Set(data.map((r) => r.country_en as string).filter(Boolean));
  return [...unique];
}

async function getCountryOutbreaks(countryEn: string): Promise<Outbreak[]> {
  const { data } = await db()
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, region, cases, deaths, risk_level, date, is_pheic, active, is_seed, source_priority, updated_at")
    .eq("country_en", countryEn)
    .order("date", { ascending: false });
  return (data ?? []) as Outbreak[];
}

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const countries = await getAllCountryEn();
  const params: { locale: string; slug: string }[] = [];
  for (const c of countries) {
    const slug = countryToSlug(c);
    for (const locale of LOCALES) {
      params.push({ locale, slug });
    }
  }
  return params;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;

  const countries = await getAllCountryEn();
  const countryEn = slugToCountryEn(slug, countries);
  if (!countryEn) return { title: "Country not found" };

  const outbreaks = await getCountryOutbreaks(countryEn);
  const active    = filterDisplayActive(outbreaks);

  const TITLE_TPL: Record<Locale, string> = {
    en: `${countryEn} — Disease Outbreaks`,
    fr: `${countryEn} — Foyers épidémiques`,
    es: `${countryEn} — Brotes de enfermedades`,
    ar: `${countryEn} — تفشيات الأمراض`,
    id: `${countryEn} — Wabah Penyakit`,
  };

  const DESC_TPL: Record<Locale, string> = {
    en: `${active.length} active outbreak${active.length !== 1 ? "s" : ""} in ${countryEn}. WHO, ECDC, PAHO and Africa CDC data updated every hour by HealthWatch Global.`,
    fr: `${active.length} foyer${active.length !== 1 ? "s" : ""} actif${active.length !== 1 ? "s" : ""} en ${countryEn}. Données OMS, ECDC, PAHO et Africa CDC suivies toutes les heures par HealthWatch Global.`,
    es: `${active.length} brote${active.length !== 1 ? "s" : ""} activo${active.length !== 1 ? "s" : ""} en ${countryEn}. Datos de OMS, ECDC, PAHO y Africa CDC actualizados cada hora.`,
    ar: `${active.length} تفشٍّ نشط في ${countryEn}. بيانات منظمة الصحة العالمية، ECDC، PAHO وAfrica CDC.`,
    id: `${active.length} wabah aktif di ${countryEn}. Data WHO, ECDC, PAHO dan Africa CDC diperbarui setiap jam.`,
  };

  const title       = TITLE_TPL[l];
  const description = DESC_TPL[l];
  const canonical   = `${BASE_URL}/${l}/country/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_URL}/${loc}/country/${slug}`])),
        "x-default": `${BASE_URL}/en/country/${slug}`,
      },
    },
    openGraph: {
      title: `${title} | HealthWatch Global`,
      description,
      url: canonical,
      type: "website",
      siteName: "HealthWatch Global",
      locale: ({ en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID" } as Record<string, string>)[l] ?? "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | HealthWatch Global`,
      description,
    },
    robots: { index: true, follow: true },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CountryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const lb = LABELS[l];
  const isRtl = l === "ar";

  const countries = await getAllCountryEn();
  const countryEn = slugToCountryEn(slug, countries);
  if (!countryEn) notFound();

  const outbreaks  = await getCountryOutbreaks(countryEn);
  const active     = filterDisplayActive(outbreaks);
  const activeIds  = new Set(active.map((o) => o.id));
  const historical = outbreaks.filter((o) => !activeIds.has(o.id));

  const trendsMap = active.length > 0
    ? new Map(Object.entries(await getOutbreakTrendsBulkCached(active.map((o) => o.id))))
    : new Map<string, import("@/lib/outbreak-trend").OutbreakTrend>();

  // Scoped to `active` (display-active), not the full outbreaks history — same fix already
  // applied to the disease page (see b4044e5): summing every historical row inflates these
  // far beyond the current situation (found 2026-07-15: DR Congo showed 35M+ cases, dominated
  // by a Malaria GHO annual estimate and superseded Ebola snapshots — see filterDisplayActive).
  const totalCases  = active.reduce((s, o) => s + (o.cases  ?? 0), 0);
  const totalDeaths = active.reduce((s, o) => s + (o.deaths ?? 0), 0);
  const numLocale   = l === "ar" ? "ar-SA" : l;
  const latestUpdate = outbreaks.reduce<string | null>((latest, o) => {
    const t = (o as { updated_at?: string }).updated_at ?? o.date ?? null;
    if (!t) return latest;
    if (!latest || t > latest) return t;
    return latest;
  }, null);
  const cfr         = totalCases > 0 ? (totalDeaths / totalCases * 100).toFixed(1) + "%" : lb.noData;
  const uniqueDiseases = new Set(outbreaks.map((o) => o.disease_en ?? o.disease)).size;

  // Unique diseases for chips
  const diseaseChips = new Map<string, { name_en: string; displayName: string; hasActive: boolean }>();
  for (const o of outbreaks) {
    const key = o.disease_en ?? o.disease;
    if (!key) continue;
    const existing = diseaseChips.get(key);
    if (existing) { if (o.active) existing.hasActive = true; }
    else diseaseChips.set(key, {
      name_en: key,
      displayName: getLocalizedDisease(o, l) ?? key,
      hasActive: o.active ?? false,
    });
  }

  // Get a sample outbreak's country name in the current locale
  const regionRaw   = outbreaks[0]?.region ?? null;
  const regionSlug  = regionRaw ? regionRaw.toLowerCase().replace(/\s+/g, "-") : null;

  // Traveler health advisory — endemic diseases for this region
  const tl = TRAVELER_LABELS[l];
  const allDiseasesList = allDiseases();
  const region = regionSlug as AppRegion | null;
  const travelerHigh = region ? allDiseasesList.filter(d => d.travelerRisk?.[region] === "high") : [];
  const travelerMod  = region ? allDiseasesList.filter(d => d.travelerRisk?.[region] === "moderate") : [];

  const displayName = outbreaks[0]
    ? getLocalizedCountry(outbreaks[0], l) ?? countryEn
    : countryEn;

  const countryCtaTitle =
    l === "fr" ? `Alertes épidémiques pour ${displayName}` :
    l === "es" ? `Alertas de brotes para ${displayName}` :
    l === "ar" ? `تنبيهات تفشي الأمراض في ${displayName}` :
    l === "id" ? `Peringatan wabah untuk ${displayName}` :
    `Get outbreak alerts for ${displayName}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: `${countryEn} — Disease Outbreaks`,
      description: `${active.length} active outbreak${active.length !== 1 ? "s" : ""} in ${countryEn}. Confirmed cases, deaths, CFR and disease breakdown. Official WHO, ECDC, PAHO and Africa CDC data.`,
      url: `${BASE_URL}/${l}/country/${slug}`,
      spatialCoverage: { "@type": "Country", name: countryEn },
      creator: { "@type": "Organization", name: "HealthWatch Global", url: BASE_URL },
      ...(totalCases > 0 && { measurementTechnique: `${totalCases.toLocaleString("en")} confirmed cases tracked` }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "HealthWatch Global", item: `${BASE_URL}/${l}` },
        { "@type": "ListItem", position: 2, name: "Countries", item: `${BASE_URL}/${l}/countries` },
        ...(regionSlug ? [{ "@type": "ListItem", position: 3, name: regionRaw ? regionRaw.charAt(0).toUpperCase() + regionRaw.slice(1) : regionRaw, item: `${BASE_URL}/${l}/region/${regionSlug}` },
                          { "@type": "ListItem", position: 4, name: displayName, item: `${BASE_URL}/${l}/country/${slug}` }]
                       : [{ "@type": "ListItem", position: 3, name: displayName, item: `${BASE_URL}/${l}/country/${slug}` }]),
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-10" dir={isRtl ? "rtl" : "ltr"}>
      {jsonLd.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(s) }} />
      ))}

      {/* Breadcrumb */}
      <div className={`flex items-center justify-between gap-2 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}>
        <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <Link href={`/${l}`} className="hover:text-gray-300 transition-colors">{lb.back}</Link>
          <span>·</span>
          <Link href={`/${l}/countries`} className="hover:text-gray-300 transition-colors">
            {l === "fr" ? "Pays" : l === "es" ? "Países" : l === "ar" ? "الدول" : l === "id" ? "Negara" : "Countries"}
          </Link>
          {regionSlug && (
            <>
              <span>·</span>
              <Link href={`/${l}/region/${regionSlug}`} className="hover:text-gray-300 transition-colors capitalize">
                {regionRaw}
              </Link>
            </>
          )}
        </div>
        <ShareOutbreakButton
          disease={active[0] ? (active[0].disease_en ?? active[0].disease) : (outbreaks[0]?.disease_en ?? outbreaks[0]?.disease ?? "")}
          country={displayName}
          cases={totalCases}
          riskLevel={active.some((o) => o.risk_level === "high") ? "high" : active.some((o) => o.risk_level === "medium") ? "medium" : "low"}
          locale={l}
          pageUrl={`https://healthwatch-global.com/${l}/country/${slug}`}
          compact={false}
        />
      </div>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white leading-tight">{displayName}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {active.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  {lb.activeBadge(active.length)}
                </span>
              ) : (
                <span className="text-sm text-gray-500">{lb.noActive}</span>
              )}
              {latestUpdate && (
                <span className="text-xs text-gray-600">
                  {lb.lastUpdated} {new Date(latestUpdate).toLocaleDateString(
                    l === "ar" ? "ar-SA" : l,
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {totalCases > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: lb.cases,    value: totalCases.toLocaleString(numLocale),  color: "text-blue-400" },
              { label: lb.deaths,   value: totalDeaths.toLocaleString(numLocale), color: "text-red-400"  },
              { label: lb.cfr,      value: cfr,                          color: "text-yellow-400" },
              { label: lb.diseases, value: String(uniqueDiseases),       color: "text-purple-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <CountryAlertNudge locale={l} countryName={displayName} />

      {/* Active outbreaks */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">
          {lb.activeSection}
        </h2>
        {active.length === 0 ? (
          <p className="text-gray-500 text-sm">{lb.noActive}</p>
        ) : (
          <div className="space-y-3">
            {active.map((o) => {
              const disease = getLocalizedDisease(o, l) ?? o.disease_en ?? o.disease;
              const cfr1 = o.cases > 0 && o.deaths !== null ? (o.deaths / o.cases * 100).toFixed(1) + "%" : lb.noData;
              const trend = trendsMap.get(o.id);
              return (
                <div
                  key={o.id}
                  className="relative bg-gray-900/60 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors group"
                >
                  <Link href={`/${l}/outbreak/${o.id}`} className="absolute inset-0 rounded-xl z-0" aria-label={disease ?? ""} />
                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        o.risk_level === "high" ? "bg-red-400 animate-pulse" :
                        o.risk_level === "medium" ? "bg-yellow-400" : "bg-green-400"
                      }`} />
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate group-hover:text-red-300 transition-colors">
                          {disease}
                        </p>
                        {o.date && (
                          <p className="text-xs text-gray-500">{o.date}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {o.is_pheic && (
                        <span className="text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded px-2 py-0.5">
                          PHEIC
                        </span>
                      )}
                      <span className={`text-xs font-semibold border rounded-full px-2.5 py-1 ${RISK_STYLE[o.risk_level] ?? RISK_STYLE.low}`}>
                        {lb.risk[o.risk_level] ?? o.risk_level}
                      </span>
                      {trend && trend.direction !== "unknown" && (
                        <span className={`text-xs font-medium ${TREND_COLOR[trend.direction as "up" | "stable" | "down"]}`}>
                          {TREND_ICON[trend.direction as "up" | "stable" | "down"]}
                          {trend.deltaPercent !== 0 && ` ${Math.abs(trend.deltaPercent)}%`}
                        </span>
                      )}
                      {o.cases > 0 && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">{o.cases.toLocaleString(numLocale)}</p>
                          <p className="text-xs text-gray-500">{cfr1}</p>
                        </div>
                      )}
                      <WatchButton outbreakId={o.id} locale={l} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Traveler health advisory */}
      {region && (travelerHigh.length > 0 || travelerMod.length > 0) && (
        <section className="space-y-4 border border-amber-800/30 bg-amber-950/10 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-amber-400">{tl.title}</h2>
          </div>
          {travelerHigh.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">{tl.high}</p>
              <div className="flex flex-wrap gap-2">
                {travelerHigh.map(d => (
                  <Link
                    key={d.name_en}
                    href={`/${l}/disease/${diseaseToSlug(d.name_en)}`}
                    className="text-xs px-3 py-1.5 rounded-full border border-red-800/50 bg-red-950/20 text-red-300 hover:border-red-600/70 hover:text-red-200 transition-colors"
                  >
                    {getDiseaseName(d, l)}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {travelerMod.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">{tl.moderate}</p>
              <div className="flex flex-wrap gap-2">
                {travelerMod.map(d => (
                  <Link
                    key={d.name_en}
                    href={`/${l}/disease/${diseaseToSlug(d.name_en)}`}
                    className="text-xs px-3 py-1.5 rounded-full border border-yellow-800/50 bg-yellow-950/20 text-yellow-300 hover:border-yellow-600/70 hover:text-yellow-200 transition-colors"
                  >
                    {getDiseaseName(d, l)}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-600 italic">{tl.note}</p>
        </section>
      )}

      {/* CTA */}
      <EmailCapture
        locale={l}
        proTitle={countryCtaTitle}
        title={lb.ctaTitle}
        body={lb.ctaBody}
      />

      {/* Disease chips */}
      {diseaseChips.size > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            {l === "fr" ? "Maladies enregistrées" : l === "es" ? "Enfermedades registradas" : l === "ar" ? "الأمراض المسجلة" : l === "id" ? "Penyakit tercatat" : "Diseases recorded"}
            <span className="ml-2 text-sm font-normal text-gray-500">({diseaseChips.size})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...diseaseChips.values()]
              .sort((a, b) => (b.hasActive ? 1 : 0) - (a.hasActive ? 1 : 0) || a.name_en.localeCompare(b.name_en))
              .map(({ name_en, displayName, hasActive }) => (
                <Link
                  key={name_en}
                  href={`/${l}/disease/${diseaseToSlug(name_en)}`}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors hover:scale-[1.03] ${
                    hasActive
                      ? "bg-purple-950/30 border-purple-800/40 text-purple-300 hover:border-purple-600/60"
                      : "bg-gray-900/50 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                  }`}
                >
                  {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />}
                  {displayName}
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* Historical outbreaks */}
      {historical.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">
            {lb.historySection}
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({historical.length} {lb.outbreaksSince})
            </span>
          </h2>
          <div className="space-y-2">
            {historical.map((o) => {
              const disease = getLocalizedDisease(o, l) ?? o.disease_en ?? o.disease;
              const diseaseSlug = diseaseToSlug(o.disease_en ?? o.disease ?? "");
              return (
                <div key={o.id} className="flex items-center justify-between gap-4 py-3 border-b border-gray-800/60 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600 shrink-0" />
                    <div className="min-w-0">
                      <Link
                        href={`/${l}/outbreak/${o.id}`}
                        className="text-sm text-gray-300 hover:text-white transition-colors truncate"
                      >
                        {disease}
                      </Link>
                      {diseaseSlug && (
                        <span className="text-xs text-gray-600 ml-2">
                          <Link href={`/${l}/disease/${diseaseSlug}`} className="hover:text-gray-400 transition-colors">
                            ↗ {o.disease_en ?? o.disease}
                          </Link>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    {o.cases > 0 && (
                      <span className="text-sm text-gray-400">{o.cases.toLocaleString(numLocale)} {lb.cases.toLowerCase()}</span>
                    )}
                    {o.date && (
                      <span className="text-xs text-gray-600 w-24">{o.date}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}

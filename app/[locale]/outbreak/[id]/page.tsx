// Public SEO page for individual outbreaks — indexed by search engines.
// URL: /[locale]/outbreak/[id]
// ISR: regenerated every hour so stale data never stays more than 60 min.

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocalizedDisease, getLocalizedCountry, sourceStatus } from "@/lib/outbreaks";
import { diseaseToSlug, normalizeDisease } from "@/lib/disease-data";
import type { Outbreak } from "@/lib/outbreaks";
import type { Metadata } from "next";

export const revalidate = 3600;

const BASE_URL   = "https://healthwatch-global.com";
const LOCALES    = ["en", "fr", "es", "ar", "id"] as const;
const DON_PATTERN = /who\.int\/emergencies\/disease-outbreak-news\/item\/(\d{4}-DON\d+)/i;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const LABELS = {
  fr: {
    cases: "Cas confirmés", deaths: "Décès", cfr: "Létalité",
    date: "Date", region: "Région",
    sourceVerified: "Bulletin OMS officiel", sourceOfficial: "Source officielle",
    pheic: "URGENCE SANITAIRE INTERNATIONALE (PHEIC)",
    ctaTitle: "Recevoir les alertes épidémiques en temps réel",
    ctaBtn: "Commencer gratuitement →",
    back: "← Tableau de bord",
    noData: "N/D",
    risk: { high: "RISQUE ÉLEVÉ", medium: "RISQUE MODÉRÉ", low: "RISQUE FAIBLE" },
  },
  en: {
    cases: "Confirmed cases", deaths: "Deaths", cfr: "Case fatality rate",
    date: "Report date", region: "Region",
    sourceVerified: "Official WHO Disease Outbreak News", sourceOfficial: "Official source",
    pheic: "PUBLIC HEALTH EMERGENCY OF INTERNATIONAL CONCERN (PHEIC)",
    ctaTitle: "Get real-time disease outbreak alerts",
    ctaBtn: "Start for free →",
    back: "← Dashboard",
    noData: "N/A",
    risk: { high: "HIGH RISK", medium: "MEDIUM RISK", low: "LOW RISK" },
  },
  es: {
    cases: "Casos confirmados", deaths: "Fallecidos", cfr: "Tasa de letalidad",
    date: "Fecha del informe", region: "Región",
    sourceVerified: "Boletín oficial OMS", sourceOfficial: "Fuente oficial",
    pheic: "EMERGENCIA DE SALUD PÚBLICA DE IMPORTANCIA INTERNACIONAL (ESPII)",
    ctaTitle: "Recibe alertas de brotes en tiempo real",
    ctaBtn: "Empezar gratis →",
    back: "← Panel",
    noData: "N/D",
    risk: { high: "RIESGO ALTO", medium: "RIESGO MEDIO", low: "RIESGO BAJO" },
  },
  ar: {
    cases: "الحالات المؤكدة", deaths: "الوفيات", cfr: "معدل الوفيات",
    date: "تاريخ التقرير", region: "المنطقة",
    sourceVerified: "نشرة منظمة الصحة العالمية الرسمية", sourceOfficial: "مصدر رسمي",
    pheic: "طوارئ الصحة العمومية التي تثير قلقاً دولياً",
    ctaTitle: "احصل على تنبيهات الأوبئة في الوقت الفعلي",
    ctaBtn: "ابدأ مجاناً →",
    back: "→ لوحة التحكم",
    noData: "غ/م",
    risk: { high: "خطر عالٍ", medium: "خطر متوسط", low: "خطر منخفض" },
  },
  id: {
    cases: "Kasus terkonfirmasi", deaths: "Kematian", cfr: "Tingkat kematian",
    date: "Tanggal laporan", region: "Wilayah",
    sourceVerified: "Buletin resmi WHO", sourceOfficial: "Sumber resmi",
    pheic: "KEDARURATAN KESEHATAN MASYARAKAT YANG MERESAHKAN DUNIA (KKMMD)",
    ctaTitle: "Dapatkan peringatan wabah secara real-time",
    ctaBtn: "Mulai gratis →",
    back: "← Dasbor",
    noData: "T/S",
    risk: { high: "RISIKO TINGGI", medium: "RISIKO SEDANG", low: "RISIKO RENDAH" },
  },
} satisfies Record<string, { cases: string; deaths: string; cfr: string; date: string; region: string; sourceVerified: string; sourceOfficial: string; pheic: string; ctaTitle: string; ctaBtn: string; back: string; noData: string; risk: Record<string, string> }>;

const RISK_STYLE: Record<string, string> = {
  high:   "text-red-400 bg-red-500/10 border-red-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  low:    "text-green-400 bg-green-500/10 border-green-500/30",
};

// cache() deduplicates within a single render (generateMetadata + page share the same fetch)
const getOutbreak = cache(async (id: string): Promise<Outbreak | null> => {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  const { data } = await supabase
    .from("outbreaks")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const o = await getOutbreak(id);
  if (!o) return { title: "Outbreak not found" };

  const disease = getLocalizedDisease(o, locale) ?? o.disease_en ?? o.disease;
  const country = getLocalizedCountry(o, locale) ?? o.country_en ?? o.country;
  const year    = o.date ? new Date(o.date).getFullYear() : "";
  const donRef  = o.source ? DON_PATTERN.exec(o.source)?.[1] : null;

  const title = donRef
    ? `${disease} — ${country} · WHO ${donRef}`
    : `${disease} outbreak — ${country} ${year}`;

  const caseStr = o.cases > 0
    ? `${o.cases.toLocaleString("en")} cases, ${o.deaths.toLocaleString("en")} deaths.`
    : "";
  const description = [
    `${disease} outbreak in ${country}.`,
    caseStr,
    donRef ? `WHO Disease Outbreak News ${donRef}.` : "Official health data.",
    "Tracked by HealthWatch Global.",
  ].filter(Boolean).join(" ");

  const canonical = `${BASE_URL}/${locale}/outbreak/${id}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `${BASE_URL}/${l}/outbreak/${id}`])),
        "x-default": `${BASE_URL}/en/outbreak/${id}`,
      },
    },
    openGraph: {
      title: `${title} | HealthWatch Global`,
      description,
      url: canonical,
      type: "article",
      siteName: "HealthWatch Global",
      images: [{
        url: `${BASE_URL}/api/outbreak-card/${id}?locale=${locale}`,
        width: 1200,
        height: 630,
        alt: title,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | HealthWatch Global`,
      description,
      images: [`${BASE_URL}/api/outbreak-card/${id}?locale=${locale}`],
    },
  };
}

export default async function OutbreakPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const o = await getOutbreak(id);
  if (!o) notFound();

  const l       = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
  const isRtl   = locale === "ar";
  const disease = getLocalizedDisease(o, locale) ?? o.disease_en ?? o.disease;
  const country = getLocalizedCountry(o, locale) ?? o.country_en ?? o.country;
  const hasData = o.cases > 0;
  const cfr     = hasData ? ((o.deaths / o.cases) * 100).toFixed(1) + "%" : l.noData;
  const donRef  = o.source ? DON_PATTERN.exec(o.source)?.[1] : null;
  const status  = sourceStatus(o);

  const diseaseSlug = diseaseToSlug(normalizeDisease(o.disease_en || o.disease).name_en);
  const diseasesLabel: Record<string, string> = {
    fr: "Maladies", en: "Diseases", es: "Enfermedades", ar: "الأمراض", id: "Penyakit",
  };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${disease} outbreak in ${country}`,
      description: `${disease} outbreak tracking. ${hasData ? `${o.cases} cases, ${o.deaths} deaths.` : ""}`,
      datePublished: o.date,
      publisher: { "@type": "Organization", name: "HealthWatch Global", url: BASE_URL },
      about: {
        "@type": "InfectiousDisease",
        name: o.disease_en ?? o.disease,
        url: `${BASE_URL}/${locale}/disease/${diseaseSlug}`,
      },
      ...(donRef && { url: o.source }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "HealthWatch Global", item: `${BASE_URL}/${locale}` },
        { "@type": "ListItem", position: 2, name: diseasesLabel[locale] ?? "Diseases", item: `${BASE_URL}/${locale}/diseases` },
        { "@type": "ListItem", position: 3, name: disease, item: `${BASE_URL}/${locale}/disease/${diseaseSlug}` },
        { "@type": "ListItem", position: 4, name: `${disease} — ${country}`, item: `${BASE_URL}/${locale}/outbreak/${id}` },
      ],
    },
  ];

  return (
    <div className={`max-w-3xl mx-auto${isRtl ? " text-right" : ""}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href={`/${locale}`}
        className="text-sm text-gray-400 hover:text-white transition-colors mb-6 inline-block"
      >
        {l.back}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${RISK_STYLE[o.risk_level] ?? RISK_STYLE.low}`}>
            {l.risk[o.risk_level] ?? o.risk_level}
          </span>
          {o.is_pheic && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-purple-500/10 border-purple-500/30 text-purple-400">
              🚨 PHEIC
            </span>
          )}
          {donRef && (
            <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
              {donRef}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-white">{disease}</h1>
        <p className="text-xl text-gray-400 mt-1">📍 {country}</p>
        <Link
          href={`/${locale}/disease/${diseaseToSlug(normalizeDisease(o.disease_en || o.disease).name_en)}`}
          className="inline-block mt-2 text-sm text-red-400/70 hover:text-red-400 transition-colors"
        >
          {{ fr: `Voir tous les foyers — ${disease}`, en: `All ${disease} outbreaks`, es: `Todos los brotes — ${disease}`, ar: `جميع تفشيات ${disease} ←`, id: `Semua wabah ${disease}` }[locale] ?? `All ${disease} outbreaks`} →
        </Link>
        {o.is_pheic && (
          <p className="mt-2 text-xs text-purple-400 font-semibold tracking-wide">{l.pheic}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: l.cases,  value: hasData ? o.cases.toLocaleString()  : l.noData, cls: "text-white" },
          { label: l.deaths, value: hasData ? o.deaths.toLocaleString() : l.noData, cls: "text-red-400" },
          { label: l.cfr,    value: cfr,                                              cls: "text-amber-400" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
            <div className={`text-2xl font-bold ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Meta */}
      <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mb-6 grid grid-cols-2 gap-3 text-sm">
        {o.date && (
          <div>
            <span className="text-gray-400">{l.date} : </span>
            <span className="text-white font-medium">{o.date}</span>
          </div>
        )}
        {o.region && (
          <div>
            <span className="text-gray-400">{l.region} : </span>
            <span className="text-white font-medium capitalize">{o.region}</span>
          </div>
        )}
      </div>

      {/* Description */}
      {o.description && (
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mb-6">
          <p className="text-gray-300 text-sm leading-relaxed">{o.description}</p>
        </div>
      )}

      {/* Source link */}
      {status !== "unverified" && o.source && (
        <div className="mb-6 text-sm flex items-center gap-2">
          <a
            href={o.source}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline ${status === "don" ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-gray-200"}`}
          >
            {status === "don" ? l.sourceVerified : l.sourceOfficial}
          </a>
          <span className="text-gray-600">↗</span>
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
        <p className="text-white font-semibold mb-3">{l.ctaTitle}</p>
        <Link
          href={`/${locale}`}
          className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {l.ctaBtn}
        </Link>
      </div>
    </div>
  );
}

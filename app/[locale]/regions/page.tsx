// Index of all WHO regions with active outbreak stats.
// URL: /[locale]/regions
// ISR: 1 hour

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";
import type { Outbreak } from "@/lib/outbreaks";
import EmailCapture from "@/components/EmailCapture";

export const revalidate = 3600;

const BASE_URL = "https://healthwatch-global.com";
const LOCALES  = ["en", "fr", "es", "ar", "id"] as const;
type Locale    = typeof LOCALES[number];

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const REGION_SLUGS = ["africa", "asia", "americas", "europe", "oceania"] as const;
type RegionSlug = typeof REGION_SLUGS[number];

const REGION_NAME: Record<Locale, Record<RegionSlug, string>> = {
  en: { africa: "Africa", asia: "Asia", americas: "Americas", europe: "Europe", oceania: "Oceania" },
  fr: { africa: "Afrique", asia: "Asie", americas: "Amériques", europe: "Europe", oceania: "Océanie" },
  es: { africa: "África", asia: "Asia", americas: "Américas", europe: "Europa", oceania: "Oceanía" },
  ar: { africa: "أفريقيا", asia: "آسيا", americas: "الأمريكتان", europe: "أوروبا", oceania: "أوقيانوسيا" },
  id: { africa: "Afrika", asia: "Asia", americas: "Amerika", europe: "Eropa", oceania: "Oseania" },
};

const REGION_DESC: Record<Locale, Record<RegionSlug, string>> = {
  en: {
    africa:   "Sub-Saharan and North Africa — high burden of hemorrhagic fevers, cholera, meningitis",
    asia:     "South, East and Southeast Asia — avian influenza, dengue, emerging pathogens",
    americas: "North, Central and South America — dengue, hantavirus, Chagas disease",
    europe:   "European region including Central Asia — West Nile virus, tick-borne encephalitis",
    oceania:  "Pacific island nations and Australia — dengue, leptospirosis, typhoid",
  },
  fr: {
    africa:   "Afrique subsaharienne et du Nord — forte charge en fièvres hémorragiques, choléra, méningite",
    asia:     "Asie du Sud, de l'Est et du Sud-Est — grippe aviaire, dengue, pathogènes émergents",
    americas: "Amérique du Nord, centrale et du Sud — dengue, hantavirus, maladie de Chagas",
    europe:   "Région européenne incl. Asie centrale — virus du Nil occidental, encéphalite à tiques",
    oceania:  "Nations insulaires du Pacifique et Australie — dengue, leptospirose, typhoïde",
  },
  es: {
    africa:   "África subsahariana y del Norte — alta carga de fiebres hemorrágicas, cólera, meningitis",
    asia:     "Asia meridional, oriental y sudoriental — gripe aviar, dengue, patógenos emergentes",
    americas: "América del Norte, Central y del Sur — dengue, hantavirus, enfermedad de Chagas",
    europe:   "Región europea incl. Asia Central — virus del Nilo occidental, encefalitis por garrapatas",
    oceania:  "Islas del Pacífico y Australia — dengue, leptospirosis, tifoidea",
  },
  ar: {
    africa:   "أفريقيا جنوب الصحراء وشمال أفريقيا — حمى نزفية، كوليرا، التهاب السحايا",
    asia:     "جنوب وشرق وجنوب شرق آسيا — إنفلونزا الطيور، حمى الضنك، مسببات ناشئة",
    americas: "أمريكا الشمالية والوسطى والجنوبية — حمى الضنك، هانتافيروس، مرض شاغاز",
    europe:   "المنطقة الأوروبية بما فيها آسيا الوسطى — حمى النيل الغربي، التهاب الدماغ",
    oceania:  "جزر المحيط الهادئ وأستراليا — حمى الضنك، داء البريميات، التيفوئيد",
  },
  id: {
    africa:   "Afrika sub-Sahara dan Afrika Utara — demam berdarah, kolera, meningitis",
    asia:     "Asia Selatan, Timur, dan Tenggara — flu burung, dengue, patogen baru",
    americas: "Amerika Utara, Tengah, dan Selatan — dengue, hantavirus, penyakit Chagas",
    europe:   "Wilayah Eropa termasuk Asia Tengah — virus West Nile, ensefalitis kutu",
    oceania:  "Kepulauan Pasifik dan Australia — dengue, leptospirosis, tifoid",
  },
};

const LABELS: Record<Locale, {
  title: string; subtitle: string;
  active: (n: number) => string; noActive: string;
  countries: string; outbreaks: string; cases: string;
  back: string;
  metaTitle: string; metaDesc: string;
  proTitle: string; captureTitle: string; captureBody: string;
}> = {
  en: {
    title: "Regions",
    subtitle: "Disease outbreak surveillance by WHO region — Africa, Asia, Americas, Europe, Oceania.",
    active: (n) => n === 1 ? "1 active" : `${n} active`,
    noActive: "No active outbreaks",
    countries: "countries", outbreaks: "outbreaks", cases: "cases",
    back: "← Dashboard",
    metaTitle: "Disease Outbreaks by Region — HealthWatch Global",
    metaDesc: "Monitor disease outbreaks by WHO region. Real-time data from WHO, ECDC, PAHO and Africa CDC across Africa, Asia, Americas, Europe, and Oceania.",
    proTitle: "Get real-time regional alerts for your areas of operation",
    captureTitle: "Weekly regional digest",
    captureBody: "Active outbreaks, case counts and risk levels by WHO region. WHO, ECDC, PAHO and Africa CDC sources.",
  },
  fr: {
    title: "Régions",
    subtitle: "Surveillance des épidémies par région OMS — Afrique, Asie, Amériques, Europe, Océanie.",
    active: (n) => n === 1 ? "1 actif" : `${n} actifs`,
    noActive: "Aucun foyer actif",
    countries: "pays", outbreaks: "foyers", cases: "cas",
    back: "← Tableau de bord",
    metaTitle: "Foyers épidémiques par région — HealthWatch Global",
    metaDesc: "Surveillance des épidémies par région OMS. Données en temps réel OMS, ECDC, PAHO et Africa CDC.",
    proTitle: "Alertes régionales en temps réel pour vos zones d'opération",
    captureTitle: "Digest hebdomadaire régional",
    captureBody: "Foyers actifs, cas et niveaux de risque par région OMS. Sources OMS, ECDC, PAHO et Africa CDC.",
  },
  es: {
    title: "Regiones",
    subtitle: "Vigilancia de brotes por región OMS — África, Asia, Américas, Europa, Oceanía.",
    active: (n) => n === 1 ? "1 activo" : `${n} activos`,
    noActive: "Sin brotes activos",
    countries: "países", outbreaks: "brotes", cases: "casos",
    back: "← Panel",
    metaTitle: "Brotes de enfermedades por región — HealthWatch Global",
    metaDesc: "Vigilancia de brotes por región OMS. Datos en tiempo real de OMS, ECDC, PAHO y Africa CDC.",
    proTitle: "Alertas regionales en tiempo real para sus zonas de operación",
    captureTitle: "Digest semanal regional",
    captureBody: "Brotes activos, recuentos de casos y niveles de riesgo por región OMS. Fuentes OMS, ECDC, PAHO y Africa CDC.",
  },
  ar: {
    title: "المناطق",
    subtitle: "مراقبة تفشي الأمراض حسب منطقة منظمة الصحة العالمية — أفريقيا، آسيا، الأمريكتان، أوروبا، أوقيانوسيا.",
    active: (n) => `${n} نشط`,
    noActive: "لا تفشيات نشطة",
    countries: "دول", outbreaks: "تفشيات", cases: "حالة",
    back: "→ لوحة التحكم",
    metaTitle: "تفشيات الأمراض حسب المنطقة — HealthWatch Global",
    metaDesc: "رصد تفشي الأمراض حسب منطقة منظمة الصحة العالمية. بيانات من منظمة الصحة العالمية وECDC وPAHO وAfrica CDC.",
    proTitle: "تنبيهات إقليمية فورية لمناطق عملياتك",
    captureTitle: "ملخص أسبوعي إقليمي",
    captureBody: "التفشيات النشطة وأعداد الحالات ومستويات الخطر حسب منطقة منظمة الصحة العالمية.",
  },
  id: {
    title: "Wilayah",
    subtitle: "Pengawasan wabah penyakit menurut wilayah WHO — Afrika, Asia, Amerika, Eropa, Oseania.",
    active: (n) => n === 1 ? "1 aktif" : `${n} aktif`,
    noActive: "Tidak ada wabah aktif",
    countries: "negara", outbreaks: "wabah", cases: "kasus",
    back: "← Dasbor",
    metaTitle: "Wabah Penyakit per Wilayah — HealthWatch Global",
    metaDesc: "Pantau wabah penyakit menurut wilayah WHO. Data real-time dari WHO, ECDC, PAHO dan Africa CDC.",
    proTitle: "Peringatan regional real-time untuk wilayah operasi Anda",
    captureTitle: "Digest mingguan regional",
    captureBody: "Wabah aktif, jumlah kasus dan tingkat risiko per wilayah WHO. Sumber WHO, ECDC, PAHO dan Africa CDC.",
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
  const url = `${BASE_URL}/${l}/regions`;

  return {
    title: lb.metaTitle,
    description: lb.metaDesc,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_URL}/${loc}/regions`])),
        "x-default": `${BASE_URL}/en/regions`,
      },
    },
    openGraph: {
      title: lb.metaTitle,
      description: lb.metaDesc,
      url,
      type: "website",
      siteName: "HealthWatch Global",
      locale: ({ en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID" } as Record<string, string>)[l] ?? "en_US",
    },
    twitter: { card: "summary_large_image", title: lb.metaTitle, description: lb.metaDesc },
    robots: { index: true, follow: true },
  };
}

// ── Data ──────────────────────────────────────────────────────────────────────

interface RegionStats {
  slug:        RegionSlug;
  activeCount: number;
  totalCount:  number;
  totalCases:  number;
  countryCount: number;
}

async function fetchRegionStats(): Promise<RegionStats[]> {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data } = await supabase
    .from("outbreaks")
    .select("region, active, cases, country_en")
    .not("region", "is", null);

  if (!data) return REGION_SLUGS.map((slug) => ({ slug, activeCount: 0, totalCount: 0, totalCases: 0, countryCount: 0 }));

  const map = new Map<RegionSlug, { active: number; total: number; cases: number; countries: Set<string> }>();
  for (const slug of REGION_SLUGS) {
    map.set(slug, { active: 0, total: 0, cases: 0, countries: new Set() });
  }

  for (const o of data as Pick<Outbreak, "region" | "active" | "cases" | "country_en">[]) {
    if (!o.region) continue;
    const slug = o.region.toLowerCase().replace(/\s+/g, "-") as RegionSlug;
    const bucket = map.get(slug);
    if (!bucket) continue;
    bucket.total++;
    bucket.cases += o.cases ?? 0;
    if (o.active) bucket.active++;
    if (o.country_en) bucket.countries.add(o.country_en);
  }

  return REGION_SLUGS.map((slug) => {
    const b = map.get(slug)!;
    return { slug, activeCount: b.active, totalCount: b.total, totalCases: b.cases, countryCount: b.countries.size };
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RegionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l  = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const lb = LABELS[l];
  const isRtl = l === "ar";

  const regions = await fetchRegionStats();
  const totalActive = regions.reduce((s, r) => s + r.activeCount, 0);
  const totalCases  = regions.reduce((s, r) => s + r.totalCases, 0);
  const numLocale   = l === "ar" ? "ar-SA" : l;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: lb.metaTitle,
      description: lb.metaDesc,
      url: `${BASE_URL}/${l}/regions`,
      creator: { "@type": "Organization", name: "HealthWatch Global", url: BASE_URL },
      ...(totalActive > 0 && { measurementTechnique: `${totalActive} active outbreak${totalActive === 1 ? "" : "s"} across WHO regions` }),
      ...(totalCases > 0 && { size: `${totalCases.toLocaleString("en")} confirmed cases tracked` }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "HealthWatch Global", item: `${BASE_URL}/${l}` },
        { "@type": "ListItem", position: 2, name: lb.title, item: `${BASE_URL}/${l}/regions` },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-10" dir={isRtl ? "rtl" : "ltr"}>
      {jsonLd.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      {/* Header */}
      <div className="space-y-3">
        <Link href={`/${l}`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          {lb.back}
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl font-bold text-white">{lb.title}</h1>
          {totalActive > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              {lb.active(totalActive)}
            </span>
          )}
        </div>
        <p className="text-gray-400 leading-relaxed">{lb.subtitle}</p>
        <div className="flex items-center gap-4 pt-1">
          <Link href={`/${l}/diseases`} className="text-sm text-gray-500 hover:text-red-400 transition-colors">
            {l === "fr" ? "→ Par maladie" : l === "es" ? "→ Por enfermedad" : l === "ar" ? "← حسب المرض" : l === "id" ? "→ Per penyakit" : "→ By disease"}
          </Link>
          <Link href={`/${l}/countries`} className="text-sm text-gray-500 hover:text-red-400 transition-colors">
            {l === "fr" ? "→ Par pays" : l === "es" ? "→ Por país" : l === "ar" ? "← حسب الدولة" : l === "id" ? "→ Per negara" : "→ By country"}
          </Link>
        </div>
      </div>

      {/* Region cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {regions.map((r) => {
          const name = REGION_NAME[l][r.slug];
          const desc = REGION_DESC[l][r.slug];
          const hasActive = r.activeCount > 0;

          return (
            <Link
              key={r.slug}
              href={`/${l}/region/${r.slug}`}
              className={`group relative flex flex-col gap-4 rounded-2xl border p-6 transition-all hover:scale-[1.01] ${
                hasActive
                  ? "bg-red-950/20 border-red-800/30 hover:border-red-700/50 hover:bg-red-950/30"
                  : "bg-gray-900/40 border-gray-800 hover:border-gray-700 hover:bg-gray-900/60"
              }`}
            >
              {/* Region name + active badge */}
              <div className="flex items-center justify-between gap-3">
                <h2 className={`text-xl font-bold ${hasActive ? "text-white" : "text-gray-200"} group-hover:text-white transition-colors`}>
                  {name}
                </h2>
                {hasActive ? (
                  <span className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    {lb.active(r.activeCount)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-gray-600">{lb.noActive}</span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-gray-500 mt-auto pt-2 border-t border-gray-800/60">
                <span>
                  <span className={`font-semibold ${hasActive ? "text-white" : "text-gray-300"}`}>
                    {r.totalCount}
                  </span>{" "}
                  {lb.outbreaks}
                </span>
                {r.countryCount > 0 && (
                  <span>
                    <span className="font-semibold text-gray-300">{r.countryCount}</span>{" "}
                    {lb.countries}
                  </span>
                )}
                {r.totalCases > 0 && (
                  <span>
                    <span className="font-semibold text-gray-300">{r.totalCases.toLocaleString(numLocale)}</span>{" "}
                    {lb.cases}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* CTA */}
      <EmailCapture
        locale={l}
        title={lb.captureTitle}
        body={lb.captureBody}
        proTitle={lb.proTitle}
      />

    </div>
  );
}

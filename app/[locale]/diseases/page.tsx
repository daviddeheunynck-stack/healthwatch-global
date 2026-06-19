// Hub page — index of all 30 tracked diseases with active outbreak counts.
// URL: /[locale]/diseases
// ISR: regenerated every hour.

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";
import { allDiseases, diseaseToSlug, normalizeDisease } from "@/lib/disease-data";
import { getLocalizedDisease } from "@/lib/outbreaks";
import type { Outbreak } from "@/lib/outbreaks";
import EmailCapture from "@/components/EmailCapture";

const DISEASE_COUNT = allDiseases().length;

export const revalidate = 3600;

const BASE_URL = "https://healthwatch-global.com";
const LOCALES  = ["en", "fr", "es", "ar", "id"] as const;
type Locale = typeof LOCALES[number];

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// ── Labels ────────────────────────────────────────────────────────────────────
const LABELS: Record<Locale, {
  title: string; subtitle: string;
  active: (n: number) => string; noActive: string;
  cases: string; metaTitle: string; metaDesc: string;
  back: string;
  captureTitle: string; captureBody: string;
}> = {
  fr: {
    title: "Maladies surveillées",
    subtitle: `${DISEASE_COUNT} pathogènes suivis en temps réel via les données officielles de l'OMS, l'ECDC, le PAHO et Africa CDC.`,
    active: (n) => n === 1 ? "1 foyer actif" : `${n} foyers actifs`,
    noActive: "Aucun foyer actif",
    cases: "cas",
    metaTitle: "Maladies infectieuses surveillées — HealthWatch Global",
    metaDesc: `Index des ${DISEASE_COUNT} pathogènes suivis en temps réel par HealthWatch Global — Ebola, Mpox, Choléra, Dengue et bien d'autres. Données officielles OMS, ECDC, PAHO et Africa CDC.`,
    back: "← Tableau de bord",
    captureTitle: "Digest hebdomadaire de toutes les maladies surveillées",
    captureBody: `Un résumé des ${DISEASE_COUNT} pathogènes surveillés — foyers actifs, cas et risques. Sources OMS, ECDC, PAHO et Africa CDC.`,
  },
  en: {
    title: "Tracked diseases",
    subtitle: `${DISEASE_COUNT} pathogens monitored in real time via official WHO, ECDC, PAHO and Africa CDC data.`,
    active: (n) => n === 1 ? "1 active outbreak" : `${n} active outbreaks`,
    noActive: "No active outbreaks",
    cases: "cases",
    metaTitle: "Infectious diseases tracked — HealthWatch Global",
    metaDesc: `Index of ${DISEASE_COUNT} pathogens monitored in real time by HealthWatch Global — Ebola, Mpox, Cholera, Dengue and more. Official WHO, ECDC, PAHO and Africa CDC data.`,
    back: "← Dashboard",
    captureTitle: "Weekly digest covering all tracked diseases",
    captureBody: `Active outbreaks, case counts and risk levels across all ${DISEASE_COUNT} tracked pathogens. WHO, ECDC, PAHO and Africa CDC sources.`,
  },
  es: {
    title: "Enfermedades vigiladas",
    subtitle: `${DISEASE_COUNT} patógenos monitoreados en tiempo real mediante datos oficiales de OMS, ECDC, PAHO y Africa CDC.`,
    active: (n) => n === 1 ? "1 brote activo" : `${n} brotes activos`,
    noActive: "Sin brotes activos",
    cases: "casos",
    metaTitle: "Enfermedades infecciosas vigiladas — HealthWatch Global",
    metaDesc: `Índice de ${DISEASE_COUNT} patógenos monitoreados en tiempo real por HealthWatch Global — Ébola, Mpox, Cólera, Dengue y más. Datos oficiales OMS, ECDC, PAHO y Africa CDC.`,
    back: "← Panel",
    captureTitle: "Digest semanal de las enfermedades vigiladas",
    captureBody: `Brotes activos, recuentos de casos y niveles de riesgo de los ${DISEASE_COUNT} patógenos vigilados. Fuentes OMS, ECDC, PAHO y Africa CDC.`,
  },
  ar: {
    title: "الأمراض المُراقَبة",
    subtitle: `${DISEASE_COUNT} مسبباً مرضياً مُراقَباً في الوقت الفعلي عبر البيانات الرسمية لمنظمة الصحة العالمية، ECDC، PAHO وAfrica CDC.`,
    active: (n) => n === 1 ? "تفشٍّ نشط واحد" : `${n} تفشيات نشطة`,
    noActive: "لا تفشيات نشطة",
    cases: "حالة",
    metaTitle: "الأمراض المعدية المُراقَبة — HealthWatch Global",
    metaDesc: `فهرس ${DISEASE_COUNT} مسبباً مرضياً مُراقَباً في الوقت الفعلي بواسطة HealthWatch Global — إيبولا، جدري القرود، كوليرا، حمى الضنك والمزيد. بيانات رسمية من منظمة الصحة العالمية، ECDC، PAHO وAfrica CDC.`,
    back: "→ لوحة التحكم",
    captureTitle: "ملخص أسبوعي لجميع الأمراض المُراقَبة",
    captureBody: `التفشيات النشطة وأعداد الحالات ومستويات الخطر لـ ${DISEASE_COUNT} مسبباً مرضياً مُراقَباً. مصادر منظمة الصحة العالمية، ECDC، PAHO وAfrica CDC.`,
  },
  id: {
    title: "Penyakit yang dipantau",
    subtitle: `${DISEASE_COUNT} patogen dipantau secara real-time menggunakan data resmi WHO, ECDC, PAHO, dan Africa CDC.`,
    active: (n) => n === 1 ? "1 wabah aktif" : `${n} wabah aktif`,
    noActive: "Tidak ada wabah aktif",
    cases: "kasus",
    metaTitle: "Penyakit menular yang dipantau — HealthWatch Global",
    metaDesc: `Indeks ${DISEASE_COUNT} patogen yang dipantau secara real-time oleh HealthWatch Global — Ebola, Mpox, Kolera, Dengue dan lainnya. Data resmi WHO, ECDC, PAHO dan Africa CDC.`,
    back: "← Dasbor",
    captureTitle: "Digest mingguan penyakit yang dipantau",
    captureBody: `Wabah aktif, jumlah kasus dan tingkat risiko dari ${DISEASE_COUNT} patogen yang dipantau. Sumber WHO, ECDC, PAHO dan Africa CDC.`,
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
  const canonical = `${BASE_URL}/${l}/diseases`;

  return {
    title: lb.metaTitle,
    description: lb.metaDesc,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_URL}/${loc}/diseases`])),
        "x-default": `${BASE_URL}/en/diseases`,
      },
    },
    openGraph: {
      title: lb.metaTitle,
      description: lb.metaDesc,
      url: canonical,
      siteName: "HealthWatch Global",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: lb.metaTitle, description: lb.metaDesc },
    robots: { index: true, follow: true },
  };
}

// ── Data ─────────────────────────────────────────────────────────────────────
async function fetchActiveOutbreaks(): Promise<Outbreak[]> {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  const { data } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, cases, active")
    .eq("active", true);
  return (data ?? []) as Outbreak[];
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function DiseasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const lb = LABELS[l];
  const isRtl = l === "ar";

  const active = await fetchActiveOutbreaks();

  // Group active outbreaks by canonical disease name_en
  const byDisease = new Map<string, { count: number; cases: number }>();
  for (const o of active) {
    const key = normalizeDisease(o.disease_en || o.disease).name_en;
    const cur = byDisease.get(key) ?? { count: 0, cases: 0 };
    byDisease.set(key, { count: cur.count + 1, cases: cur.cases + (o.cases || 0) });
  }

  const diseases = allDiseases();

  // Sort: active first (desc by outbreak count), then alphabetical by localized name
  const sorted = [...diseases].sort((a, b) => {
    const da = byDisease.get(a.name_en)?.count ?? 0;
    const db = byDisease.get(b.name_en)?.count ?? 0;
    if (da !== db) return db - da;
    return getLocalizedDisease({ disease: a.name_en, disease_en: a.name_en, disease_ar: a.name_ar }, l)
      .localeCompare(getLocalizedDisease({ disease: b.name_en, disease_en: b.name_en, disease_ar: b.name_ar }, l));
  });

  const activeCount  = byDisease.size;
  const totalActive  = active.length;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "HealthWatch Global", item: `${BASE_URL}/${l}` },
        { "@type": "ListItem", position: 2, name: lb.title, item: `${BASE_URL}/${l}/diseases` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: lb.metaTitle,
      description: lb.metaDesc,
      url: `${BASE_URL}/${l}/diseases`,
      numberOfItems: diseases.length,
      itemListElement: sorted.map((disease, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}/${l}/disease/${diseaseToSlug(disease.name_en)}`,
        name: getLocalizedDisease(
          { disease: disease.name_en, disease_en: disease.name_en, disease_ar: disease.name_ar }, l
        ),
      })),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir={isRtl ? "rtl" : undefined}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Back */}
      <Link href={`/${l}`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        {lb.back}
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">{lb.title}</h1>
        <p className="text-gray-400">{lb.subtitle}</p>
        <div className="flex gap-4 pt-1 text-sm text-gray-500">
          <span><span className="text-white font-semibold">{diseases.length}</span> {l === "fr" ? "maladies" : l === "es" ? "enfermedades" : l === "ar" ? "مرض" : l === "id" ? "penyakit" : "diseases"}</span>
          <span>·</span>
          <span><span className="text-red-400 font-semibold">{activeCount}</span> {l === "fr" ? "avec foyers actifs" : l === "es" ? "con brotes activos" : l === "ar" ? "مع تفشيات نشطة" : l === "id" ? "dengan wabah aktif" : "with active outbreaks"}</span>
          <span>·</span>
          <span><span className="text-white font-semibold">{totalActive}</span> {l === "fr" ? "foyers actifs au total" : l === "es" ? "brotes activos en total" : l === "ar" ? "تفشٍّ نشط إجمالاً" : l === "id" ? "wabah aktif total" : "total active outbreaks"}</span>
        </div>
        <div className="pt-1">
          <Link href={`/${l}/countries`} className="text-sm text-gray-500 hover:text-red-400 transition-colors">
            {l === "fr" ? "→ Voir par pays" : l === "es" ? "→ Ver por país" : l === "ar" ? "← عرض حسب الدولة" : l === "id" ? "→ Lihat per negara" : "→ Browse by country"}
          </Link>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sorted.map((disease) => {
          const slug     = diseaseToSlug(disease.name_en);
          const stats    = byDisease.get(disease.name_en);
          const hasActive = (stats?.count ?? 0) > 0;
          const name     = getLocalizedDisease(
            { disease: disease.name_en, disease_en: disease.name_en, disease_ar: disease.name_ar },
            l
          );

          return (
            <Link
              key={slug}
              href={`/${l}/disease/${slug}`}
              className={`group relative flex flex-col gap-2 rounded-xl border p-4 transition-all hover:scale-[1.02] ${
                hasActive
                  ? "bg-red-950/20 border-red-800/40 hover:border-red-600/60"
                  : "bg-gray-900/50 border-gray-800 hover:border-gray-600"
              }`}
            >
              {hasActive && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <p className={`font-semibold leading-tight pr-4 ${hasActive ? "text-white" : "text-gray-300 group-hover:text-white"} transition-colors`}>
                {name}
              </p>
              <p className={`text-xs font-medium ${hasActive ? "text-red-400" : "text-gray-600"}`}>
                {hasActive
                  ? lb.active(stats!.count)
                  : lb.noActive
                }
              </p>
              {hasActive && stats!.cases > 0 && (
                <p className="text-xs text-gray-500">
                  {stats!.cases.toLocaleString("en")} {lb.cases}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {/* CTA */}
      <EmailCapture
        locale={l}
        title={lb.captureTitle}
        body={lb.captureBody}
      />

    </div>
  );
}

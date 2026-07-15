// Public SEO page for a disease — aggregates all outbreaks for one pathogen.
// URL: /[locale]/disease/[slug]  e.g. /fr/disease/rift-valley-fever
// ISR: regenerated every hour.

import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { slugToDisease, diseaseToSlug, allDiseases, normalizeDisease, getContagiosityLevel } from "@/lib/disease-data";
import { countryToSlug } from "@/lib/country-utils";
import type { PathogenType, TransmissionMode, VaccineStatus, TreatmentStatus, ContagiosityLevel } from "@/lib/disease-data";
import { getLocalizedDisease, getLocalizedCountry, filterDisplayActive } from "@/lib/outbreaks";
import { getOutbreakTrendsBulkCached } from "@/lib/outbreak-trend";
import type { Outbreak } from "@/lib/outbreaks";
import EmailCapture from "@/components/EmailCapture";
import DiseaseAlertNudge from "@/components/DiseaseAlertNudge";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";
import WatchButton from "@/components/WatchButton";
import WatchDiseaseButton from "@/components/WatchDiseaseButton";

export const revalidate = 3600;

const BASE_URL = "https://healthwatch-global.com";
const LOCALES  = ["en", "fr", "es", "ar", "id"] as const;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// ── Labels ────────────────────────────────────────────────────────────────────
const LABELS = {
  fr: {
    activeBadge: (n: number) => n === 1 ? "1 foyer actif" : `${n} foyers actifs`,
    noActive: "Aucun foyer actif",
    cases: "Cas confirmés", deaths: "Décès", recovered: "Guéris", cfr: "Létalité", countries: "Pays touchés", lastUpdated: "Mis à jour :",
    activeSection: "Foyers en cours",
    historySection: "Historique des épidémies",
    noHistory: "Aucun foyer historique enregistré.",
    risk: { high: "RISQUE ÉLEVÉ", medium: "RISQUE MODÉRÉ", low: "RISQUE FAIBLE" },
    ctaTitle: "Recevoir les alertes quotidiennes",
    ctaBody: "Soyez alerté dès qu'un nouveau foyer est signalé.",
    ctaBtn: "Commencer gratuitement →",
    back: "← Tableau de bord",
    cases_unit: "cas", deaths_unit: "décès",
    noData: "N/D",
    daysAgo: (n: number) => n === 0 ? "aujourd'hui" : n === 1 ? "hier" : `${n}j`,
  },
  en: {
    activeBadge: (n: number) => n === 1 ? "1 active outbreak" : `${n} active outbreaks`,
    noActive: "No active outbreaks",
    cases: "Confirmed cases", deaths: "Deaths", recovered: "Recovered", cfr: "Case fatality rate", countries: "Countries affected", lastUpdated: "Updated:",
    activeSection: "Active outbreaks",
    historySection: "Outbreak history",
    noHistory: "No historical outbreaks on record.",
    risk: { high: "HIGH RISK", medium: "MODERATE RISK", low: "LOW RISK" },
    ctaTitle: "Get daily outbreak alerts",
    ctaBody: "Be notified as soon as a new outbreak is reported.",
    ctaBtn: "Start for free →",
    back: "← Dashboard",
    cases_unit: "cases", deaths_unit: "deaths",
    noData: "N/A",
    daysAgo: (n: number) => n === 0 ? "today" : n === 1 ? "yesterday" : `${n}d`,
  },
  es: {
    activeBadge: (n: number) => n === 1 ? "1 brote activo" : `${n} brotes activos`,
    noActive: "Sin brotes activos",
    cases: "Casos confirmados", deaths: "Fallecidos", recovered: "Recuperados", cfr: "Tasa de letalidad", countries: "Países afectados", lastUpdated: "Actualizado:",
    activeSection: "Brotes en curso",
    historySection: "Historial de epidemias",
    noHistory: "Sin brotes históricos registrados.",
    risk: { high: "RIESGO ALTO", medium: "RIESGO MODERADO", low: "RIESGO BAJO" },
    ctaTitle: "Recibe alertas diarias",
    ctaBody: "Sé notificado en cuanto se reporte un nuevo brote.",
    ctaBtn: "Empezar gratis →",
    back: "← Panel",
    cases_unit: "casos", deaths_unit: "fallecidos",
    noData: "N/D",
    daysAgo: (n: number) => n === 0 ? "hoy" : n === 1 ? "ayer" : `${n}d`,
  },
  ar: {
    activeBadge: (n: number) => n === 1 ? "تفشٍّ نشط واحد" : `${n} تفشيات نشطة`,
    noActive: "لا تفشيات نشطة",
    cases: "الحالات المؤكدة", deaths: "الوفيات", recovered: "المتعافون", cfr: "معدل الوفيات", countries: "الدول المتضررة", lastUpdated: "تحديث:",
    activeSection: "التفشيات الجارية",
    historySection: "تاريخ الأوبئة",
    noHistory: "لا سجل لتفشيات سابقة.",
    risk: { high: "خطر مرتفع", medium: "خطر متوسط", low: "خطر منخفض" },
    ctaTitle: "احصل على تنبيهات يومية",
    ctaBody: "كن أول من يعلم عند الإبلاغ عن تفشٍّ جديد.",
    ctaBtn: "ابدأ مجاناً ←",
    back: "→ لوحة التحكم",
    cases_unit: "حالة", deaths_unit: "وفاة",
    noData: "غ/م",
    daysAgo: (n: number) => n === 0 ? "اليوم" : n === 1 ? "أمس" : `${n}ي`,
  },
  id: {
    activeBadge: (n: number) => n === 1 ? "1 wabah aktif" : `${n} wabah aktif`,
    noActive: "Tidak ada wabah aktif",
    cases: "Kasus terkonfirmasi", deaths: "Kematian", recovered: "Sembuh", cfr: "Tingkat kematian", countries: "Negara terdampak", lastUpdated: "Diperbarui:",
    activeSection: "Wabah yang sedang berlangsung",
    historySection: "Riwayat epidemi",
    noHistory: "Tidak ada riwayat wabah.",
    risk: { high: "RISIKO TINGGI", medium: "RISIKO SEDANG", low: "RISIKO RENDAH" },
    ctaTitle: "Dapatkan peringatan wabah harian",
    ctaBody: "Dapatkan notifikasi segera setelah wabah baru dilaporkan.",
    ctaBtn: "Mulai gratis →",
    back: "← Dasbor",
    cases_unit: "kasus", deaths_unit: "kematian",
    noData: "T/S",
    daysAgo: (n: number) => n === 0 ? "hari ini" : n === 1 ? "kemarin" : `${n}h`,
  },
} as const;

type Locale = keyof typeof LABELS;

// ── Virology panel labels ─────────────────────────────────────────────────────
const VIRO_LABELS: Record<Locale, {
  panelTitle: string;
  pathogen: string; family: string; transmission: string;
  incubation: string; days: string; cfrRef: string; r0: string;
  vaccine: string; treatment: string;
  vaccineStatus: Record<VaccineStatus, string>;
  vaccineStrainWarning: string;
  treatmentStatus: Record<TreatmentStatus, string>;
  transmissionLabels: Record<TransmissionMode, string>;
  pathogenLabels: Record<PathogenType, string>;
  contagiosityLabels: Record<ContagiosityLevel, string>;
  whoLink: string;
}> = {
  fr: {
    panelTitle: "Profil clinique",
    pathogen: "Agent pathogène", family: "Famille", transmission: "Transmission",
    incubation: "Incubation", days: "j", cfrRef: "Létalité (référence)", r0: "R₀ de référence",
    vaccine: "Vaccin", treatment: "Traitement", whoLink: "Fiche OMS →",
    vaccineStatus: { yes: "Disponible", no: "Non disponible", experimental: "Expérimental", conditional: "Usage limité" },
    vaccineStrainWarning: "Non disponible pour la souche active",
    treatmentStatus: { yes: "Disponible", no: "Non disponible", supportive: "Symptomatique", experimental: "Expérimental" },
    pathogenLabels: { virus_rna: "Virus ARN", virus_dna: "Virus ADN", bacteria: "Bactérie", parasite: "Parasite", fungus: "Champignon" },
    contagiosityLabels: { "very-high": "Très élevée", high: "Élevée", moderate: "Modérée", low: "Faible" },
    transmissionLabels: {
      contact: "Contact direct", droplet: "Gouttelettes", airborne: "Aérosol / voie aérienne",
      vector: "Vecteur arthropode", foodborne: "Alimentaire", waterborne: "Hydrique",
      sexual: "Sexuelle", nosocomial: "Nosocomiale", fomite: "Surfaces contaminées", zoonotic: "Zoonotique",
    },
  },
  en: {
    panelTitle: "Clinical profile",
    pathogen: "Pathogen", family: "Family", transmission: "Transmission",
    incubation: "Incubation", days: "d", cfrRef: "CFR (reference)", r0: "R₀ (reference)",
    vaccine: "Vaccine", treatment: "Treatment", whoLink: "WHO factsheet →",
    vaccineStatus: { yes: "Available", no: "Not available", experimental: "Experimental", conditional: "Limited use" },
    vaccineStrainWarning: "Not available for active strain",
    treatmentStatus: { yes: "Available", no: "Not available", supportive: "Supportive care", experimental: "Experimental" },
    pathogenLabels: { virus_rna: "RNA virus", virus_dna: "DNA virus", bacteria: "Bacteria", parasite: "Parasite", fungus: "Fungus" },
    contagiosityLabels: { "very-high": "Very high", high: "High", moderate: "Moderate", low: "Low" },
    transmissionLabels: {
      contact: "Direct contact", droplet: "Respiratory droplets", airborne: "Airborne / aerosol",
      vector: "Arthropod vector", foodborne: "Foodborne", waterborne: "Waterborne",
      sexual: "Sexual", nosocomial: "Nosocomial", fomite: "Fomites", zoonotic: "Zoonotic",
    },
  },
  es: {
    panelTitle: "Perfil clínico",
    pathogen: "Agente patógeno", family: "Familia", transmission: "Transmisión",
    incubation: "Incubación", days: "d", cfrRef: "Letalidad (referencia)", r0: "R₀ de referencia",
    vaccine: "Vacuna", treatment: "Tratamiento", whoLink: "Ficha OMS →",
    vaccineStatus: { yes: "Disponible", no: "No disponible", experimental: "Experimental", conditional: "Uso limitado" },
    vaccineStrainWarning: "No disponible para la cepa activa",
    treatmentStatus: { yes: "Disponible", no: "No disponible", supportive: "Cuidados de apoyo", experimental: "Experimental" },
    pathogenLabels: { virus_rna: "Virus ARN", virus_dna: "Virus ADN", bacteria: "Bacteria", parasite: "Parásito", fungus: "Hongo" },
    contagiosityLabels: { "very-high": "Muy alta", high: "Alta", moderate: "Moderada", low: "Baja" },
    transmissionLabels: {
      contact: "Contacto directo", droplet: "Gotículas respiratorias", airborne: "Aéreo / aerosol",
      vector: "Vector artrópodo", foodborne: "Alimentaria", waterborne: "Hídrica",
      sexual: "Sexual", nosocomial: "Nosocomial", fomite: "Fómites", zoonotic: "Zoonótico",
    },
  },
  ar: {
    panelTitle: "الملف السريري",
    pathogen: "العامل الممرض", family: "العائلة", transmission: "طريقة الانتقال",
    incubation: "الحضانة", days: "ي", cfrRef: "معدل الوفيات (مرجع)", r0: "R₀ (مرجع)",
    vaccine: "اللقاح", treatment: "العلاج", whoLink: "← بطاقة منظمة الصحة العالمية",
    vaccineStatus: { yes: "متوفر", no: "غير متوفر", experimental: "تجريبي", conditional: "استخدام محدود" },
    vaccineStrainWarning: "غير متوفر للسلالة النشطة",
    treatmentStatus: { yes: "متوفر", no: "غير متوفر", supportive: "علاج داعم", experimental: "تجريبي" },
    pathogenLabels: { virus_rna: "فيروس RNA", virus_dna: "فيروس DNA", bacteria: "بكتيريا", parasite: "طفيلي", fungus: "فطر" },
    contagiosityLabels: { "very-high": "مرتفعة جدًا", high: "مرتفعة", moderate: "متوسطة", low: "منخفضة" },
    transmissionLabels: {
      contact: "اتصال مباشر", droplet: "رذاذ تنفسي", airborne: "هواء / هباء",
      vector: "ناقل حشري", foodborne: "عن طريق الطعام", waterborne: "عن طريق الماء",
      sexual: "جنسي", nosocomial: "مستشفيات", fomite: "أسطح ملوثة", zoonotic: "حيواني المصدر",
    },
  },
  id: {
    panelTitle: "Profil klinis",
    pathogen: "Patogen", family: "Famili", transmission: "Penularan",
    incubation: "Inkubasi", days: "h", cfrRef: "CFR (referensi)", r0: "R₀ (referensi)",
    vaccine: "Vaksin", treatment: "Pengobatan", whoLink: "Lembar fakta WHO →",
    vaccineStatus: { yes: "Tersedia", no: "Tidak tersedia", experimental: "Eksperimental", conditional: "Penggunaan terbatas" },
    vaccineStrainWarning: "Tidak tersedia untuk galur aktif",
    treatmentStatus: { yes: "Tersedia", no: "Tidak tersedia", supportive: "Perawatan suportif", experimental: "Eksperimental" },
    pathogenLabels: { virus_rna: "Virus RNA", virus_dna: "Virus DNA", bacteria: "Bakteri", parasite: "Parasit", fungus: "Jamur" },
    contagiosityLabels: { "very-high": "Sangat tinggi", high: "Tinggi", moderate: "Sedang", low: "Rendah" },
    transmissionLabels: {
      contact: "Kontak langsung", droplet: "Droplet pernapasan", airborne: "Udara / aerosol",
      vector: "Vektor artropoda", foodborne: "Melalui makanan", waterborne: "Melalui air",
      sexual: "Seksual", nosocomial: "Nosokomial", fomite: "Fomit", zoonotic: "Zoonotik",
    },
  },
} as const;

const VACCINE_COLOR: Record<VaccineStatus, string> = {
  yes: "text-green-400 bg-green-500/10 border-green-500/30",
  experimental: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  conditional: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  no: "text-gray-400 bg-gray-800/60 border-gray-700",
};
const TREATMENT_COLOR: Record<TreatmentStatus, string> = {
  yes: "text-green-400 bg-green-500/10 border-green-500/30",
  experimental: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  supportive: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  no: "text-gray-400 bg-gray-800/60 border-gray-700",
};
const CONTAGIOSITY_COLOR: Record<ContagiosityLevel, string> = {
  "very-high": "text-red-400 bg-red-500/10 border-red-500/30",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  moderate: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  low: "text-green-400 bg-green-500/10 border-green-500/30",
};

const RISK_STYLE: Record<string, string> = {
  high:   "text-red-400 bg-red-500/10 border border-red-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border border-yellow-500/30",
  low:    "text-green-400 bg-green-500/10 border border-green-500/30",
};

const TREND_ICON  = { up: "▲", stable: "→", down: "▼" } as const;
const TREND_COLOR = { up: "text-red-400", stable: "text-gray-400", down: "text-green-400" } as const;

// ── Data ─────────────────────────────────────────────────────────────────────
async function fetchDiseaseOutbreaks(diseaseNameEn: string): Promise<Outbreak[]> {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, description, country, country_en, country_ar, cases, deaths, risk_level, date, active, is_seed, source_priority, updated_at")
    .order("date", { ascending: false });

  if (!data) return [];

  return (data as Outbreak[]).filter(
    (o) => normalizeDisease(o.disease_en || o.disease).name_en === diseaseNameEn
  );
}

// ── Static params ─────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const diseases = allDiseases();
  const params: { locale: string; slug: string }[] = [];
  for (const d of diseases) {
    const slug = diseaseToSlug(d.name_en);
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
  const info = slugToDisease(slug);
  if (!info) return { title: "Disease not found" };

  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const diseaseName = getLocalizedDisease(
    { disease: info.name_en, disease_en: info.name_en, disease_ar: info.name_ar },
    l
  );

  const TITLE: Record<Locale, string> = {
    fr: `${diseaseName} — Surveillance mondiale · HealthWatch Global`,
    en: `${diseaseName} — Global outbreak surveillance · HealthWatch Global`,
    es: `${diseaseName} — Vigilancia mundial · HealthWatch Global`,
    ar: `${diseaseName} — المراقبة العالمية · HealthWatch Global`,
    id: `${diseaseName} — Pengawasan wabah global · HealthWatch Global`,
  };
  const DESC: Record<Locale, string> = {
    fr: `Suivez les foyers de ${diseaseName} en continu — cas confirmés, décès, CFR et pays touchés. Données officielles OMS, ECDC, PAHO et Africa CDC agrégées par HealthWatch Global.`,
    en: `Track ${diseaseName} outbreaks continuously — confirmed cases, deaths, case fatality rate and affected countries. Official WHO, ECDC, PAHO and Africa CDC data aggregated by HealthWatch Global.`,
    es: `Siga los brotes de ${diseaseName} continuamente — casos confirmados, fallecidos, tasa de letalidad y países afectados. Datos oficiales OMS, ECDC, PAHO y Africa CDC.`,
    ar: `تتبع تفشيات ${diseaseName} بشكل مستمر — حالات مؤكدة، وفيات، معدل الوفيات ودول متضررة. بيانات رسمية من WHO وECDC وPAHO وAfrica CDC.`,
    id: `Pantau wabah ${diseaseName} secara berkelanjutan — kasus terkonfirmasi, kematian, CFR dan negara terdampak. Data resmi WHO, ECDC, PAHO dan Africa CDC.`,
  };

  const canonical = `${BASE_URL}/${l}/disease/${slug}`;

  return {
    title: TITLE[l],
    description: DESC[l],
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(LOCALES.map((loc) => [loc, `${BASE_URL}/${loc}/disease/${slug}`])),
        "x-default": `${BASE_URL}/en/disease/${slug}`,
      },
    },
    openGraph: {
      title: TITLE[l],
      description: DESC[l],
      url: canonical,
      siteName: "HealthWatch Global",
      type: "website",
      locale: ({ en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID" } as Record<string, string>)[l] ?? "en_US",
    },
    twitter: { card: "summary_large_image", title: TITLE[l], description: DESC[l] },
    robots: { index: true, follow: true },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function DiseasePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const info = slugToDisease(slug);
  if (!info) notFound();

  const contagiosityLevel = getContagiosityLevel(info.r0_ref);

  const l = (LOCALES.includes(locale as Locale) ? locale : "en") as Locale;
  const lb = LABELS[l];
  const vl = VIRO_LABELS[l];
  const isRtl = l === "ar";

  const allOutbreaks = await fetchDiseaseOutbreaks(info.name_en);

  const active    = filterDisplayActive(allOutbreaks);
  const activeIds = new Set(active.map((o) => o.id));
  const history   = allOutbreaks.filter((o) => !activeIds.has(o.id));

  // Strain-specific vaccine override: if any active outbreak is a strain not covered by the
  // listed vaccine (e.g. Bundibugyo Ebola vs Ervebo which covers Zaïre strain only), downgrade badge.
  // disease_en/disease are kept canonical (no species suffix) so outbreak rows stay matchable
  // by the sync crons' disease+country key — the strain marker lives in description instead.
  const vaccineStrainOverride =
    info.vaccine === "yes" &&
    /za[ïi]re/i.test(info.vaccineName ?? "") &&
    active.some((o) => /bundibugyo/i.test(`${o.disease_en || o.disease || ""} ${o.description || ""}`));

  const totalCases  = active.reduce((s, o) => s + (o.cases || 0), 0);
  const totalDeaths = active.reduce((s, o) => s + (o.deaths || 0), 0);
  const numLocale   = l === "ar" ? "ar-SA" : l;
  const cfr         = totalCases > 0 ? ((totalDeaths / totalCases) * 100).toFixed(1) : null;
  // Active countries only — consistent with cases/deaths which also use `active`.
  // Historical countries are still visible in the country pills section below.
  const countriesSet = new Set(active.map((o) => o.country_en || o.country).filter(Boolean));

  // Most recent update across active outbreaks — used as "data as of" timestamp
  const latestUpdate = active.reduce<string | null>((latest, o) => {
    if (!o.updated_at) return latest;
    if (!latest || o.updated_at > latest) return o.updated_at;
    return latest;
  }, null);

  // Unique countries with active-status for the "Countries affected" chips
  const affectedCountryMap = new Map<string, { country_en: string; hasActive: boolean }>();
  for (const o of allOutbreaks) {
    const key = o.country_en || o.country;
    if (!key) continue;
    const existing = affectedCountryMap.get(key);
    if (existing) { if (o.active) existing.hasActive = true; }
    else affectedCountryMap.set(key, { country_en: o.country_en ?? key, hasActive: o.active ?? false });
  }
  const affectedCountries = [...affectedCountryMap.values()]
    .sort((a, b) => (b.hasActive ? 1 : 0) - (a.hasActive ? 1 : 0) || a.country_en.localeCompare(b.country_en));

  const trendsMap = active.length > 0
    ? new Map(Object.entries(await getOutbreakTrendsBulkCached(active.map((o) => o.id))))
    : new Map();

  const diseaseName = getLocalizedDisease(
    { disease: info.name_en, disease_en: info.name_en, disease_ar: info.name_ar },
    l
  );

  const DISEASES_LABEL: Record<Locale, string> = {
    fr: "Maladies", en: "Diseases", es: "Enfermedades", ar: "الأمراض", id: "Penyakit",
  };

  const diseaseProTitle: Record<Locale, string> = {
    en: `Track ${diseaseName} outbreaks continuously`,
    fr: `Surveiller les foyers de ${diseaseName} en continu`,
    es: `Seguir los brotes de ${diseaseName} continuamente`,
    ar: `تتبع تفشيات ${diseaseName} بشكل مستمر`,
    id: `Lacak wabah ${diseaseName} secara berkelanjutan`,
  };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "InfectiousDisease",
      name: info.name_en,
      alternateName: [info.name_fr, info.name_es, info.name_ar, info.name_id].filter((n) => n && n !== info.name_en),
      ...(info.family && { infectiousAgentClass: info.family }),
      ...(info.transmission.length > 0 && { transmissionMethod: info.transmission.join(", ") }),
      url: `${BASE_URL}/${l}/disease/${slug}`,
      ...(totalCases > 0 && {
        description: `${totalCases.toLocaleString("en")} cases and ${totalDeaths.toLocaleString("en")} deaths recorded across ${countriesSet.size} countries.`,
      }),
      mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}/${l}/disease/${slug}` },
      publisher: { "@type": "Organization", name: "HealthWatch Global", url: BASE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "HealthWatch Global", item: `${BASE_URL}/${l}` },
        { "@type": "ListItem", position: 2, name: DISEASES_LABEL[l], item: `${BASE_URL}/${l}/diseases` },
        { "@type": "ListItem", position: 3, name: diseaseName, item: `${BASE_URL}/${l}/disease/${slug}` },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10" dir={isRtl ? "rtl" : undefined}>
      {jsonLd.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      {/* Back link */}
      <div className={`flex items-center justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Link href={`/${l}`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          {lb.back}
        </Link>
        <ShareOutbreakButton
          disease={diseaseName}
          country={active[0] ? (active[0].country_en ?? active[0].country) : ""}
          cases={totalCases}
          riskLevel={active.some((o) => o.risk_level === "high") ? "high" : active.some((o) => o.risk_level === "medium") ? "medium" : "low"}
          locale={l}
          pageUrl={`https://healthwatch-global.com/${l}/disease/${slug}`}
          compact={false}
        />
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-white">{diseaseName}</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            active.length > 0
              ? "bg-red-500/15 text-red-400 border border-red-500/30"
              : "bg-gray-800 text-gray-400 border border-gray-700"
          }`}>
            {active.length > 0 ? lb.activeBadge(active.length) : lb.noActive}
          </span>
          <WatchDiseaseButton diseaseName={info.name_en} locale={l} />
        </div>
        {info.name_en !== diseaseName && (
          <p className="text-sm text-gray-500">{info.name_en}</p>
        )}
      </div>

      {/* Stats bar */}
      <div className="space-y-2">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[
            { label: lb.cases,     value: totalCases  > 0 ? totalCases.toLocaleString(numLocale)  : lb.noData },
            { label: lb.deaths,    value: totalDeaths > 0 ? totalDeaths.toLocaleString(numLocale) : lb.noData },
            { label: lb.cfr,       value: cfr ? `${cfr}%` : lb.noData },
            { label: lb.countries, value: countriesSet.size > 0 ? countriesSet.size.toString() : lb.noData },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {latestUpdate && (
          <p className="text-xs text-gray-600 text-right">
            {lb.lastUpdated} {new Date(latestUpdate).toLocaleDateString(
              l === "ar" ? "ar-SA" : l,
              { year: "numeric", month: "long", day: "numeric" }
            )}
          </p>
        )}
      </div>

      <DiseaseAlertNudge locale={l} diseaseName={diseaseName} />

      {/* Virology panel */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{vl.panelTitle}</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          {/* Pathogen type */}
          <div className="space-y-1">
            <p className="text-xs text-gray-500">{vl.pathogen}</p>
            <p className="text-sm text-white font-medium">{vl.pathogenLabels[info.pathogenType]}</p>
            {info.family && <p className="text-xs text-gray-500">{info.family}</p>}
          </div>

          {/* Incubation */}
          {(info.incubationMin != null || info.incubationMax != null) && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">{vl.incubation}</p>
              <p className="text-sm text-white font-medium">
                {info.incubationMin != null && info.incubationMax != null
                  ? `${info.incubationMin}–${info.incubationMax} ${vl.days}`
                  : `${info.incubationMin ?? info.incubationMax} ${vl.days}`}
              </p>
            </div>
          )}

          {/* CFR reference */}
          {info.cfr_ref && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">{vl.cfrRef}</p>
              <p className="text-sm text-white font-medium">{info.cfr_ref}</p>
            </div>
          )}

          {/* R0 reference + derived contagiosity level */}
          {info.r0_ref && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">{vl.r0}</p>
              <p className="text-sm text-white font-medium">{info.r0_ref}</p>
              {contagiosityLevel && (
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${CONTAGIOSITY_COLOR[contagiosityLevel]}`}>
                  {vl.contagiosityLabels[contagiosityLevel]}
                </span>
              )}
            </div>
          )}

          {/* Vaccine */}
          <div className="space-y-1">
            <p className="text-xs text-gray-500">{vl.vaccine}</p>
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${
              vaccineStrainOverride
                ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                : VACCINE_COLOR[info.vaccine]
            }`}>
              {vaccineStrainOverride ? vl.vaccineStrainWarning : vl.vaccineStatus[info.vaccine]}
            </span>
            {info.vaccineName && <p className="text-xs text-gray-500 mt-1">{info.vaccineName}</p>}
          </div>

          {/* Treatment */}
          <div className="space-y-1">
            <p className="text-xs text-gray-500">{vl.treatment}</p>
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${TREATMENT_COLOR[info.treatment]}`}>
              {vl.treatmentStatus[info.treatment]}
            </span>
          </div>
        </div>

        {/* Transmission modes */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{vl.transmission}</p>
          <div className="flex flex-wrap gap-2">
            {info.transmission.map((mode) => (
              <span key={mode} className="text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                {vl.transmissionLabels[mode]}
              </span>
            ))}
          </div>
        </div>

        {/* WHO factsheet link */}
        {info.whoFactsheet && (
          <a
            href={info.whoFactsheet}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {vl.whoLink}
          </a>
        )}
      </section>

      {/* Active outbreaks */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{lb.activeSection}</h2>
          <div className="space-y-3">
            {active.map((o) => {
              const trend    = trendsMap.get(o.id);
              const country  = getLocalizedCountry(o, l);
              const riskKey  = o.risk_level as string | undefined;
              const riskLabel = riskKey ? (lb.risk as Record<string, string>)[riskKey] : undefined;

              const daysAgo = o.date
                ? Math.floor((Date.now() - new Date(o.date).getTime()) / 86_400_000)
                : null;
              const ageColor = daysAgo === null ? "text-gray-600"
                : daysAgo <= 7  ? "text-green-500"
                : daysAgo <= 21 ? "text-amber-500"
                : "text-red-500";

              return (
                <div
                  key={o.id}
                  className="relative bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors group"
                >
                  {/* Full-card link overlay */}
                  <Link
                    href={`/${l}/outbreak/${o.id}`}
                    className="absolute inset-0 rounded-xl"
                    aria-label={country}
                  />
                  {/* Content above the link */}
                  <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <p className="font-semibold text-white group-hover:text-red-400 transition-colors">
                        {country}
                      </p>
                      <p className="text-sm text-gray-400">
                        {o.cases > 0 && <span>{o.cases.toLocaleString(numLocale)} {lb.cases_unit}</span>}
                        {o.deaths !== null && o.deaths > 0 && <span className="ml-2 text-gray-500">· {o.deaths.toLocaleString(numLocale)} {lb.deaths_unit}</span>}
                        {o.date && (
                          <span className="ml-2 text-gray-600">
                            · {new Date(o.date).toLocaleDateString(
                                l === "ar" ? "ar-SA" : l,
                                { year: "numeric", month: "short", day: "numeric" }
                              )}
                          </span>
                        )}
                        {daysAgo !== null && (
                          <span className={`ml-1 text-xs font-medium ${ageColor}`}>
                            ({lb.daysAgo(daysAgo)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {trend && trend.direction !== "unknown" && (
                        <span className={`text-xs font-medium flex items-center gap-1 ${TREND_COLOR[trend.direction as "up"|"stable"|"down"]}`}>
                          {TREND_ICON[trend.direction as "up"|"stable"|"down"]}
                          {trend.deltaPercent !== 0 && `${Math.abs(trend.deltaPercent)}%`}
                        </span>
                      )}
                      {riskLabel && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${RISK_STYLE[riskKey!] ?? "text-gray-400 bg-gray-800 border border-gray-700"}`}>
                          {riskLabel}
                        </span>
                      )}
                      <WatchButton outbreakId={o.id} locale={l} />
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
                    <span className="text-gray-300 group-hover:text-white transition-colors truncate">
                      {country}
                    </span>
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

      {history.length === 0 && active.length === 0 && (
        <p className="text-gray-500 text-sm">{lb.noHistory}</p>
      )}

      {/* Countries affected */}
      {affectedCountries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            {l === "fr" ? "Pays touchés" : l === "es" ? "Países afectados" : l === "ar" ? "الدول المتضررة" : l === "id" ? "Negara terdampak" : "Countries affected"}
            <span className="ml-2 text-sm font-normal text-gray-500">({affectedCountries.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {affectedCountries.map(({ country_en, hasActive }) => (
              <Link
                key={country_en}
                href={`/${l}/country/${countryToSlug(country_en)}`}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors hover:scale-[1.03] ${
                  hasActive
                    ? "bg-red-950/30 border-red-800/40 text-red-300 hover:border-red-600/60"
                    : "bg-gray-900/50 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                }`}
              >
                {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />}
                {country_en}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Email capture CTA */}
      <EmailCapture locale={l} region="all" title={lb.ctaTitle} body={lb.ctaBody} proTitle={diseaseProTitle[l]} />

    </div>
  );
}

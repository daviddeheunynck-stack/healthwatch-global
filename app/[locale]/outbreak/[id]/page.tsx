// Public SEO page for individual outbreaks — indexed by search engines.
// URL: /[locale]/outbreak/[id]
// ISR: regenerated every hour so stale data never stays more than 60 min.

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import OutbreakBottomCta from "@/components/OutbreakBottomCta";
import CitationBlock from "@/components/CitationBlock";
import OutbreakStatsGrid from "@/components/OutbreakStatsGrid";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";
import OutbreakCasesChart from "@/components/OutbreakCasesChart";
import { getLocalizedDisease, getLocalizedCountry, sourceStatus, sourceName, staleOutbreakDays } from "@/lib/outbreaks";
import { diseaseToSlug, normalizeDisease } from "@/lib/disease-data";
import { countryToSlug } from "@/lib/country-utils";
import type { Outbreak } from "@/lib/outbreaks";
import { getResponseGuidance, RESPONSE_ACTIONS } from "@/lib/response-guidance";
import { getOutbreakTrend } from "@/lib/outbreak-trend";
import PhaseBadge from "@/components/PhaseBadge";
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
    compareLabel: "Comparer",
    printReport: "Rapport PDF",
    lastSynced: "Vérifié par HealthWatch",
    sourceLabel: "Source", sourceVerified: "Bulletin OMS officiel", sourceOfficial: "Source officielle",
    pheic: "URGENCE SANITAIRE INTERNATIONALE (PHEIC)",
    archived: "Foyer terminé — données archivées",
    ctaTitle: "Recevoir les alertes épidémiques en temps réel",
    ctaSub: "Essai Pro 14 jours gratuit — sans carte bancaire",
    ctaProBtn: "Commencer l'essai gratuit →",
    ctaFree: "Ou créer un compte gratuit",
    back: "← Tableau de bord",
    chartTitle: "Évolution des cas",
    noData: "N/D",
    risk: { high: "RISQUE ÉLEVÉ", medium: "RISQUE MODÉRÉ", low: "RISQUE FAIBLE" },
    fpGuidance: "Guide d'action — Point focal",
    tierLabels: { immediate: "IMMÉDIAT · NOTIFICATION RSI", rapid: "RÉPONSE RAPIDE", monitor: "SURVEILLANCE STANDARD" },
    firstActions: "Premières actions",
    reportingLag: "Date de rapport officiel — dans les zones enclavées, le signal de terrain précède généralement cette date de plusieurs jours à plusieurs semaines.",
    operationalDisclaimer: "Outil de veille — pas un déclencheur opérationnel. Toute mobilisation requiert vérification OMS directe et validation par votre protocole institutionnel.",
    cumulativeAs: (date: string) => `Cas cumulés depuis le début de l'épidémie — bulletin OMS du ${date}`,
    citeLabel: "Citer cette page (Vancouver)",
    citeCopy: "Copier la citation",
    citeCopied: "Copié !",
    staleBulletin: (d: number) => `Aucun bulletin officiel depuis ${d} jours — foyer peut-être résolu ou non rapporté.`,
  },
  en: {
    cases: "Confirmed cases", deaths: "Deaths", cfr: "Case fatality rate",
    date: "Report date", region: "Region",
    printReport: "PDF Report",
    lastSynced: "Last checked by HealthWatch",
    sourceLabel: "Source", sourceVerified: "Official WHO Disease Outbreak News", sourceOfficial: "Official source",
    pheic: "PUBLIC HEALTH EMERGENCY OF INTERNATIONAL CONCERN (PHEIC)",
    archived: "Outbreak resolved — archived data",
    ctaTitle: "Get real-time disease outbreak alerts",
    ctaSub: "14-day Pro trial — no credit card required",
    ctaProBtn: "Start free trial →",
    ctaFree: "Or create a free account",
    back: "← Dashboard",
    compareLabel: "Compare",
    chartTitle: "Case trend",
    noData: "N/A",
    risk: { high: "HIGH RISK", medium: "MEDIUM RISK", low: "LOW RISK" },
    fpGuidance: "Focal Point Guidance",
    tierLabels: { immediate: "IMMEDIATE · IHR NOTIFIABLE", rapid: "RAPID RESPONSE", monitor: "STANDARD MONITORING" },
    firstActions: "First actions",
    reportingLag: "Official report date — in isolated zones, field onset typically precedes this by days to weeks.",
    operationalDisclaimer: "Situational awareness tool — not an operational trigger. Any mobilization requires direct WHO verification and validation through your institutional protocol.",
    cumulativeAs: (date: string) => `Cumulative cases since outbreak start — WHO DON bulletin dated ${date}`,
    citeLabel: "Cite this page (Vancouver)",
    citeCopy: "Copy citation",
    citeCopied: "Copied!",
    staleBulletin: (d: number) => `No official bulletin in ${d} days — may be resolved or unreported in isolated areas.`,
  },
  es: {
    cases: "Casos confirmados", deaths: "Fallecidos", cfr: "Tasa de letalidad",
    date: "Fecha del informe", region: "Región",
    printReport: "Informe PDF",
    lastSynced: "Última verificación por HealthWatch",
    sourceLabel: "Fuente", sourceVerified: "Boletín oficial OMS", sourceOfficial: "Fuente oficial",
    pheic: "EMERGENCIA DE SALUD PÚBLICA DE IMPORTANCIA INTERNACIONAL (ESPII)",
    archived: "Brote resuelto — datos archivados",
    ctaTitle: "Recibe alertas de brotes en tiempo real",
    ctaSub: "Prueba Pro 14 días gratis — sin tarjeta de crédito",
    ctaProBtn: "Iniciar prueba gratuita →",
    ctaFree: "O crear una cuenta gratuita",
    back: "← Panel",
    compareLabel: "Comparar",
    chartTitle: "Evolución de casos",
    noData: "N/D",
    risk: { high: "RIESGO ALTO", medium: "RIESGO MEDIO", low: "RIESGO BAJO" },
    fpGuidance: "Guía para el Punto Focal",
    tierLabels: { immediate: "INMEDIATO · NOTIFICABLE RSI", rapid: "RESPUESTA RÁPIDA", monitor: "VIGILANCIA ESTÁNDAR" },
    firstActions: "Primeras acciones",
    reportingLag: "Fecha del informe oficial — en zonas aisladas, el inicio en el campo suele preceder a esta fecha por días o semanas.",
    operationalDisclaimer: "Herramienta de vigilancia — no es un disparador operacional. Cualquier movilización requiere verificación OMS directa y validación por su protocolo institucional.",
    cumulativeAs: (date: string) => `Casos acumulados desde el inicio del brote — boletín OMS del ${date}`,
    citeLabel: "Citar esta página (Vancouver)",
    citeCopy: "Copiar cita",
    citeCopied: "¡Copiado!",
    staleBulletin: (d: number) => `Sin boletín oficial en ${d} días — puede estar resuelto o sin reporte en zonas aisladas.`,
  },
  ar: {
    cases: "الحالات المؤكدة", deaths: "الوفيات", cfr: "معدل الوفيات",
    date: "تاريخ التقرير", region: "المنطقة",
    printReport: "تقرير PDF",
    lastSynced: "آخر تحقق بواسطة HealthWatch",
    sourceLabel: "المصدر", sourceVerified: "نشرة منظمة الصحة العالمية الرسمية", sourceOfficial: "مصدر رسمي",
    pheic: "طوارئ الصحة العمومية التي تثير قلقاً دولياً",
    archived: "انتهى التفشي — بيانات مؤرشفة",
    ctaTitle: "احصل على تنبيهات الأوبئة في الوقت الفعلي",
    ctaSub: "تجربة Pro مجانية 14 يوماً — بدون بطاقة بنكية",
    ctaProBtn: "← ابدأ التجربة المجانية",
    ctaFree: "أو أنشئ حساباً مجانياً",
    back: "→ لوحة التحكم",
    compareLabel: "مقارنة",
    chartTitle: "اتجاه الحالات",
    noData: "غ/م",
    risk: { high: "خطر عالٍ", medium: "خطر متوسط", low: "خطر منخفض" },
    fpGuidance: "دليل نقطة الاتصال",
    tierLabels: { immediate: "فوري · إخطار اللوائح الصحية الدولية", rapid: "استجابة سريعة", monitor: "مراقبة قياسية" },
    firstActions: "الإجراءات الأولى",
    reportingLag: "تاريخ التقرير الرسمي — في المناطق المعزولة، يسبق ظهور المرض ميدانياً هذا التاريخ بأيام إلى أسابيع.",
    operationalDisclaimer: "أداة رصد فقط — ليست مُحفِّزاً تشغيلياً. أي تعبئة تستلزم التحقق المباشر من منظمة الصحة العالمية والتحقق عبر بروتوكولك المؤسسي.",
    cumulativeAs: (date: string) => `الحالات التراكمية منذ بداية التفشي — نشرة منظمة الصحة العالمية بتاريخ ${date}`,
    citeLabel: "اقتبس هذه الصفحة (فانكوفر)",
    citeCopy: "نسخ الاقتباس",
    citeCopied: "تم النسخ!",
    staleBulletin: (d: number) => `لا يوجد نشرة رسمية منذ ${d} يوماً — قد يكون التفشي انتهى أو غير مُبلَّغ عنه.`,
  },
  id: {
    cases: "Kasus terkonfirmasi", deaths: "Kematian", cfr: "Tingkat kematian",
    date: "Tanggal laporan", region: "Wilayah",
    printReport: "Laporan PDF",
    lastSynced: "Terakhir dicek oleh HealthWatch",
    sourceLabel: "Sumber", sourceVerified: "Buletin resmi WHO", sourceOfficial: "Sumber resmi",
    pheic: "KEDARURATAN KESEHATAN MASYARAKAT YANG MERESAHKAN DUNIA (KKMMD)",
    archived: "Wabah selesai — data diarsipkan",
    ctaTitle: "Dapatkan peringatan wabah secara real-time",
    ctaSub: "Uji coba Pro 14 hari gratis — tanpa kartu kredit",
    ctaProBtn: "Mulai uji coba gratis →",
    ctaFree: "Atau buat akun gratis",
    back: "← Dasbor",
    compareLabel: "Bandingkan",
    chartTitle: "Tren kasus",
    noData: "T/S",
    risk: { high: "RISIKO TINGGI", medium: "RISIKO SEDANG", low: "RISIKO RENDAH" },
    fpGuidance: "Panduan Focal Point",
    tierLabels: { immediate: "SEGERA · WAJIB LAPOR IHR", rapid: "RESPONS CEPAT", monitor: "PEMANTAUAN STANDAR" },
    firstActions: "Tindakan pertama",
    reportingLag: "Tanggal laporan resmi — di zona terisolasi, onset di lapangan biasanya mendahului tanggal ini beberapa hari hingga minggu.",
    operationalDisclaimer: "Alat pemantauan saja — bukan pemicu operasional. Mobilisasi apa pun memerlukan verifikasi langsung ke WHO dan validasi melalui protokol institusional Anda.",
    cumulativeAs: (date: string) => `Kasus kumulatif sejak awal wabah — buletin WHO tanggal ${date}`,
    citeLabel: "Kutip halaman ini (Vancouver)",
    citeCopy: "Salin kutipan",
    citeCopied: "Disalin!",
    staleBulletin: (d: number) => `Tidak ada buletin resmi dalam ${d} hari — mungkin sudah selesai atau tidak dilaporkan.`,
  },
} satisfies Record<string, { cases: string; deaths: string; cfr: string; date: string; region: string; printReport: string; lastSynced: string; sourceLabel: string; sourceVerified: string; sourceOfficial: string; pheic: string; archived: string; ctaTitle: string; ctaSub: string; ctaProBtn: string; ctaFree: string; back: string; compareLabel: string; chartTitle: string; noData: string; risk: Record<string, string>; fpGuidance: string; tierLabels: Record<string, string>; firstActions: string; reportingLag: string; cumulativeAs: (date: string) => string; citeLabel: string; citeCopy: string; citeCopied: string; staleBulletin: (d: number) => string; operationalDisclaimer: string }>;

const RISK_STYLE: Record<string, string> = {
  high:   "text-red-400 bg-red-500/10 border-red-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  low:    "text-green-400 bg-green-500/10 border-green-500/30",
};

// cache() deduplicates within a single render (generateMetadata + page share the same fetch)
// No active filter — historical outbreaks are indexed in the sitemap and must render too.
const getOutbreak = cache(async (id: string): Promise<Outbreak | null> => {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  const { data } = await supabase
    .from("outbreaks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
});

const getSnapshots = cache(async (id: string) => {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  const { data } = await supabase
    .from("outbreak_snapshots")
    .select("cases, deaths, snapped_at")
    .eq("outbreak_id", id)
    .order("snapped_at", { ascending: true })
    .limit(90);
  return data ?? [];
});

const getTrend = cache(async (id: string) => {
  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  return getOutbreakTrend(supabase, id);
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
    ? `${o.cases.toLocaleString("en")} cases${o.deaths !== null ? `, ${o.deaths.toLocaleString("en")} deaths` : ""}.`
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
      locale: ({ en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID" } as Record<string, string>)[locale] ?? "en_US",
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
  const [o, snapshots, trend] = await Promise.all([getOutbreak(id), getSnapshots(id), getTrend(id)]);
  if (!o) notFound();

  const l       = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
  const isRtl   = locale === "ar";
  const disease = getLocalizedDisease(o, locale) ?? o.disease_en ?? o.disease;
  const country = getLocalizedCountry(o, locale) ?? o.country_en ?? o.country;
  const hasData = o.cases > 0;
  const cfr     = hasData && o.deaths !== null ? ((o.deaths / o.cases) * 100).toFixed(1) + "%" : l.noData;
  const donRef  = o.source ? DON_PATTERN.exec(o.source)?.[1] : null;
  const status  = sourceStatus(o);

  const diseaseSlug  = diseaseToSlug(normalizeDisease(o.disease_en || o.disease).name_en);
  const countrySlug  = o.country_en ? countryToSlug(o.country_en) : null;

  const diseaseCtaTitle =
    locale === "fr" ? `Alertes ${disease} en temps réel` :
    locale === "es" ? `Alertas ${disease} en tiempo real` :
    locale === "ar" ? `تنبيهات ${disease} في الوقت الفعلي` :
    locale === "id" ? `Peringatan ${disease} secara real-time` :
    `Get real-time ${disease} alerts`;
  const staleDays = staleOutbreakDays(o);
  const guidance = getResponseGuidance(o.disease_en || o.disease);
  const fpActions = RESPONSE_ACTIONS[guidance.tier][locale] ?? RESPONSE_ACTIONS[guidance.tier].en;
  const TIER_STYLE: Record<string, string> = {
    immediate: "text-red-400 bg-red-500/10 border-red-500/30",
    rapid:     "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    monitor:   "text-gray-300 bg-gray-600/20 border-gray-500/30",
  };
  const diseasesLabel: Record<string, string> = {
    fr: "Maladies", en: "Diseases", es: "Enfermedades", ar: "الأمراض", id: "Penyakit",
  };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${disease} outbreak in ${country}`,
      description: `${disease} outbreak tracking. ${hasData ? `${o.cases} cases${o.deaths !== null ? `, ${o.deaths} deaths` : ""}.` : ""}`,
      datePublished: o.date,
      dateModified: o.updated_at?.substring(0, 10) ?? o.date,
      image: `${BASE_URL}/api/outbreak-card/${id}?locale=${locale}`,
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
      {jsonLd.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      {/* Breadcrumb row */}
      <div className={`flex items-center gap-2 mb-6 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}>
        <Link href={`/${locale}`} className="text-sm text-gray-400 hover:text-white transition-colors">
          {l.back}
        </Link>
        {countrySlug && (
          <>
            <span className="text-gray-700">·</span>
            <Link
              href={`/${locale}/country/${countrySlug}`}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {country}
            </Link>
          </>
        )}
        <span className="text-gray-700">·</span>
        <Link
          href={`/${locale}/compare?a=${id}`}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {l.compareLabel} →
        </Link>
        <div className="ml-auto">
          <ShareOutbreakButton
            disease={disease}
            country={country}
            cases={o.cases}
            deaths={o.deaths ?? undefined}
            riskLevel={o.risk_level}
            locale={locale}
            outbreakId={id}
            compact={false}
            updatedAt={o.updated_at ?? undefined}
            reportDate={o.date ?? undefined}
          />
        </div>
      </div>

      {/* Operational disclaimer */}
      <div className="flex gap-2 items-start bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-2.5 mb-5 text-xs text-amber-400/80 leading-relaxed">
        <span className="shrink-0 mt-0.5">⚠</span>
        {l.operationalDisclaimer}
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${RISK_STYLE[o.risk_level] ?? RISK_STYLE.low}`}>
            {l.risk[o.risk_level] ?? o.risk_level}
          </span>
          {!o.active && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-gray-700/50 border-gray-600/50 text-gray-400">
              {l.archived}
            </span>
          )}
          <PhaseBadge trend={trend} staleDays={staleDays} locale={locale} />
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

      {/* Stats — blurred for anonymous visitors, unblurred client-side when authenticated */}
      <OutbreakStatsGrid
        cases={hasData ? o.cases.toLocaleString(locale === "ar" ? "ar-SA" : locale) : l.noData}
        deaths={hasData && o.deaths !== null ? o.deaths.toLocaleString(locale === "ar" ? "ar-SA" : locale) : l.noData}
        cfr={cfr}
        labels={{
          cases:      l.cases,
          deaths:     l.deaths,
          cfr:        l.cfr,
          ctaTitle:   diseaseCtaTitle,
          ctaSub:     l.ctaSub,
          ctaProBtn:  l.ctaProBtn,
          ctaFree:    l.ctaFree,
        }}
        locale={locale}
      />
      {hasData && o.date && (
        <p className="text-[11px] text-gray-500 -mt-3 mb-5 text-center">{l.cumulativeAs(o.date)}</p>
      )}

      {/* Meta */}
      <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mb-6 grid grid-cols-2 gap-3 text-sm">
        {o.date && (
          <div className="col-span-2 sm:col-span-1">
            <span className="text-gray-400">{l.date} : </span>
            <span className="text-white font-medium">{o.date}</span>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{l.reportingLag}</p>
          </div>
        )}
        {o.region && (
          <div>
            <span className="text-gray-400">{l.region} : </span>
            <Link
              href={`/${locale}/region/${o.region}`}
              className="text-white font-medium capitalize hover:text-red-400 transition-colors"
            >
              {o.region}
            </Link>
          </div>
        )}
      </div>

      {/* Stale bulletin warning */}
      {staleDays !== null && (
        <div className="flex items-start gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg px-4 py-3 mb-6 text-sm text-orange-300">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>{l.staleBulletin(staleDays)}</span>
        </div>
      )}

      {/* Description */}
      {o.description && (
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mb-6">
          <p className="text-gray-300 text-sm leading-relaxed">{o.description}</p>
        </div>
      )}

      {/* Case trend chart */}
      {snapshots.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{l.chartTitle}</p>
          <OutbreakCasesChart snapshots={snapshots} riskLevel={o.risk_level} locale={locale} />
        </div>
      )}

      {/* Focal Point Guidance — Respond tier */}
      {o.active && (
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mb-6">
          <div className={`flex items-center gap-2 mb-3 ${isRtl ? "flex-row-reverse" : ""}`}>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {l.fpGuidance}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${TIER_STYLE[guidance.tier]}`}>
              {l.tierLabels[guidance.tier]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">{l.firstActions}</p>
          <ul className={`space-y-1.5 ${isRtl ? "text-right" : ""}`}>
            {fpActions.map((action, i) => (
              <li key={i} className={`flex items-start gap-2 text-sm text-gray-300 ${isRtl ? "flex-row-reverse" : ""}`}>
                <span className="text-gray-500 mt-0.5 shrink-0">{isRtl ? "←" : "→"}</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Source link */}
      {status !== "unverified" && o.source && (
        <div className="mb-2 text-sm flex items-center gap-2">
          <a
            href={o.source}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline ${status === "don" ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-gray-200"}`}
          >
            {l.sourceLabel}: {sourceName(o.source)}
          </a>
          <span className="text-gray-600">↗</span>
        </div>
      )}
      {/* Last synced timestamp */}
      {o.updated_at && (
        <div className="mb-6 text-xs text-gray-500 flex items-center gap-1">
          <span>🔄</span>
          <span>{l.lastSynced} : {(() => {
            const mins = Math.round((Date.now() - new Date(o.updated_at!).getTime()) / 60_000);
            if (mins < 60)  return `${mins} min ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24)   return `${hrs}h ago`;
            return `${Math.floor(hrs / 24)}d ago`;
          })()}</span>
        </div>
      )}

      {/* PDF Report — Pro feature, print page handles auth/gating */}
      <div className={`mb-6 flex ${isRtl ? "justify-start" : "justify-end"}`}>
        <Link
          href={`/${locale}/outbreak/${id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          <span>🖨️</span>
          {l.printReport}
        </Link>
      </div>

      {/* Citation académique */}
      <CitationBlock
        label={l.citeLabel}
        copyLabel={l.citeCopy}
        copiedLabel={l.citeCopied}
        citation={`HealthWatch Global. ${disease} outbreak — ${country} [Internet]. ${o.date ?? ""} [cited YYYY Mon DD]. Available from: ${BASE_URL}/${locale}/outbreak/${id}. Data source: ${o.source ? sourceName(o.source) : "official surveillance sources"}.`}
      />

      {/* Data dispute link */}
      <div className="text-center mt-2">
        <a
          href={`mailto:contact@healthwatch-global.com?subject=${encodeURIComponent(`[Data dispute] ${disease} — ${country} (ID: ${id})`)}&body=${encodeURIComponent(`Hello,\n\nI would like to report a data issue on the following outbreak:\n\nDisease: ${disease}\nCountry: ${country}\nOutbreak ID: ${id}\nURL: ${BASE_URL}/${locale}/outbreak/${id}\n\nIssue description:\n[Please describe the issue and attach any official documentation]\n\nThank you.`)}`}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors underline underline-offset-2"
        >
          {locale === "fr" ? "Signaler une erreur sur ce foyer →" :
           locale === "es" ? "Reportar un error en este brote →" :
           locale === "ar" ? "← الإبلاغ عن خطأ في هذا التفشي" :
           locale === "id" ? "Laporkan kesalahan pada wabah ini →" :
           "Report a data error on this outbreak →"}
        </a>
      </div>

      {/* CTA — hidden after hydration for paid subscribers */}
      <OutbreakBottomCta
        locale={locale}
        ctaTitle={diseaseCtaTitle}
        ctaSub={l.ctaSub}
        ctaProBtn={l.ctaProBtn}
        ctaFree={l.ctaFree}
      />
    </div>
  );
}

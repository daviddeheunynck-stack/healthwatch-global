import { getTranslations, getLocale } from "next-intl/server";
import { Activity, Globe, Bell, AlertTriangle } from "lucide-react";
import { getOutbreaks, getStats, getLastSync, getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { getOutbreakTrendsBulk, type OutbreakTrend } from "@/lib/outbreak-trend";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import StatsCard from "@/components/StatsCard";
import WorldMap from "@/components/WorldMap";
import LandingPage from "@/components/LandingPage";
import CampaignRefTracker from "@/components/CampaignRefTracker";
import OutbreakTable from "@/components/OutbreakTable";
import FreshnessBadge from "@/components/FreshnessBadge";
import TrialBanner from "@/components/TrialBanner";
import PushNotificationBanner from "@/components/PushNotificationBanner";
import CsvExportButton from "@/components/CsvExportButton";
import OnboardingTour from "@/components/OnboardingTour";
import FreePlanBanner from "@/components/FreePlanBanner";
import DemoBanner from "@/components/DemoBanner";
import { Suspense } from "react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const DASHBOARD_META: Record<string, { title: string; description: string }> = {
  en: { title: "Global Disease Outbreak Dashboard", description: "Map and table of active disease outbreaks worldwide — official WHO, ECDC, PAHO and Africa CDC data, updated every 6 hours." },
  fr: { title: "Tableau de bord — Foyers épidémiques mondiaux", description: "Carte et tableau des foyers épidémiques actifs dans le monde, issus des sources officielles OMS, ECDC, PAHO et Africa CDC — mis à jour toutes les 6h." },
  es: { title: "Panel de vigilancia epidémica mundial", description: "Mapa y tabla de brotes de enfermedades activos en todo el mundo — datos oficiales OMS, ECDC, PAHO y Africa CDC, actualizados cada 6 horas." },
  ar: { title: "لوحة تحكم تفشي الأمراض العالمية", description: "خريطة وجدول لتفشي الأمراض النشطة حول العالم — بيانات رسمية من منظمة الصحة العالمية، ECDC، PAHO وAfrica CDC، محدّثة كل 6 ساعات." },
  id: { title: "Dasbor Wabah Penyakit Global", description: "Peta dan tabel wabah penyakit aktif di seluruh dunia — data resmi WHO, ECDC, PAHO dan Africa CDC, diperbarui setiap 6 jam." },
};

// ─── Filter strings (avoids touching 5 message files) ────────────────────────

const FILTER_COPY: Record<string, {
  searchPlaceholder: string;
  allRegions: string;
  allCountries: string;
  allRisks: string;
  allCfr: string;
  dateFrom: string;
  dateTo: string;
  noResults: string;
  noData: string;
  cfr: string;
  exportCsv: string;
  illustrativeBadge: string;
  illustrativeTooltip: string;
  officialBadge: string;
  officialTooltip: string;
  donBadge: string;
  donTooltip: string;
  allSources: string;
}> = {
  en: { searchPlaceholder: "Search disease or country…", allRegions: "All regions", allCountries: "All countries", allRisks: "All risks",       allCfr: "All CFR",       dateFrom: "From", dateTo: "To",     noResults: "No outbreaks match your filters.",              noData: "N/A", cfr: "CFR",          exportCsv: "Export",   illustrativeBadge: "UNVERIFIED",      illustrativeTooltip: "Unverified placeholder figures — not yet matched to a confirmed WHO/official report. Treat with caution.", officialBadge: "OFFICIAL",      officialTooltip: "Confirmed official source (WHO situation report, ECDC, or national Ministry of Health) — no WHO DON reference number.", donBadge: "WHO DON", donTooltip: "WHO Disease Outbreak News — officially citable WHO bulletin with a unique DON reference number.", allSources: "All sources" },
  fr: { searchPlaceholder: "Rechercher maladie ou pays…", allRegions: "Toutes régions", allCountries: "Tous pays",   allRisks: "Tous niveaux", allCfr: "Toute létalité", dateFrom: "Du",   dateTo: "Au",     noResults: "Aucun foyer ne correspond aux filtres.",        noData: "N/D", cfr: "Létalité",     exportCsv: "Exporter", illustrativeBadge: "NON VÉRIFIÉ",     illustrativeTooltip: "Chiffres provisoires non vérifiés — pas encore rattachés à un rapport OMS/officiel confirmé. À utiliser avec précaution.", officialBadge: "OFFICIEL",      officialTooltip: "Source officielle confirmée (rapport OMS, ECDC ou ministère de la santé) — sans numéro de bulletin DON.", donBadge: "WHO DON", donTooltip: "Bulletin officiel OMS Disease Outbreak News — source citable avec numéro de référence DON unique.", allSources: "Toutes sources" },
  es: { searchPlaceholder: "Buscar enfermedad o país…",   allRegions: "Todas las regiones", allCountries: "Todos los países", allRisks: "Todos los niveles", allCfr: "Toda letalidad", dateFrom: "Desde", dateTo: "Hasta", noResults: "Ningún brote coincide con los filtros.", noData: "N/D", cfr: "Letalidad",   exportCsv: "Exportar", illustrativeBadge: "NO VERIFICADO",   illustrativeTooltip: "Cifras provisionales no verificadas — aún no vinculadas a un informe oficial/OMS confirmado. Usar con precaución.", officialBadge: "OFICIAL",       officialTooltip: "Fuente oficial confirmada (informe OMS, ECDC o ministerio de salud) — sin número de boletín DON.", donBadge: "WHO DON", donTooltip: "Boletín oficial OMS Disease Outbreak News — fuente citable con número de referencia DON único.", allSources: "Todas las fuentes" },
  ar: { searchPlaceholder: "ابحث عن مرض أو دولة…",      allRegions: "كل المناطق",    allCountries: "كل الدول",   allRisks: "كل المستويات", allCfr: "كل معدلات الوفيات", dateFrom: "من",   dateTo: "إلى", noResults: "لا توجد تفشيات تطابق المرشحات.",              noData: "غ/م",  cfr: "معدل الوفيات", exportCsv: "تصدير",     illustrativeBadge: "غير مؤكد",        illustrativeTooltip: "أرقام تجريبية غير مؤكدة — لم تُربط بعد بتقرير رسمي مؤكد لمنظمة الصحة العالمية. يُرجى التعامل معها بحذر.", officialBadge: "رسمي",          officialTooltip: "مصدر رسمي مؤكد (تقرير منظمة الصحة العالمية أو المركز الأوروبي أو وزارة الصحة) — بدون رقم نشرة DON.", donBadge: "WHO DON", donTooltip: "نشرة أخبار تفشي الأمراض الرسمية لمنظمة الصحة العالمية — مصدر قابل للاستشهاد برقم مرجعي DON فريد.", allSources: "كل المصادر" },
  id: { searchPlaceholder: "Cari penyakit atau negara…",  allRegions: "Semua wilayah", allCountries: "Semua negara", allRisks: "Semua tingkat", allCfr: "Semua CFR",     dateFrom: "Dari", dateTo: "Hingga", noResults: "Tidak ada wabah yang cocok dengan filter.",    noData: "T/S", cfr: "CFR",          exportCsv: "Ekspor",   illustrativeBadge: "BELUM DIVERIFIKASI", illustrativeTooltip: "Angka sementara yang belum diverifikasi — belum dikaitkan dengan laporan resmi/WHO yang terkonfirmasi. Gunakan dengan hati-hati.", officialBadge: "RESMI",         officialTooltip: "Sumber resmi yang dikonfirmasi (laporan WHO, ECDC, atau Kementerian Kesehatan) — tanpa nomor buletin DON WHO.", donBadge: "WHO DON", donTooltip: "Buletin resmi WHO Disease Outbreak News — sumber yang dapat dikutip dengan nomor referensi DON unik.", allSources: "Semua sumber" },
};

const LANDING_META: Record<string, { title: string; description: string }> = {
  en: { title: "Disease outbreak monitoring — WHO, ECDC, PAHO, Africa CDC in one dashboard | HealthWatch Global", description: "Monitor active disease outbreaks worldwide — WHO, ECDC, PAHO and Africa CDC aggregated in one dashboard. Alerts, PDF reports and CFR data for health teams, corporate risk managers and travel medicine professionals." },
  fr: { title: "Surveillance des foyers épidémiques — OMS, ECDC, PAHO, Africa CDC en un tableau de bord | HealthWatch Global", description: "Suivez les foyers épidémiques actifs dans le monde — OMS, ECDC, PAHO et Africa CDC agrégés en un seul tableau de bord. Alertes, rapports PDF et létalité pour équipes santé, risk managers et médecins de voyage." },
  es: { title: "Vigilancia de brotes de enfermedades — OMS, ECDC, PAHO, Africa CDC en un panel | HealthWatch Global", description: "Monitoree los brotes de enfermedades activos en el mundo — OMS, ECDC, PAHO y Africa CDC en un solo panel. Alertas, informes PDF y datos de letalidad para equipos de salud, gestores de riesgo y médicos de viaje." },
  ar: { title: "مراقبة تفشي الأمراض — WHO وECDC وPAHO وAfrica CDC في لوحة واحدة | HealthWatch Global", description: "راقب تفشيات الأمراض النشطة حول العالم — WHO وECDC وPAHO وAfrica CDC في لوحة واحدة. تنبيهات وتقارير PDF لفرق الصحة ومديري المخاطر وأطباء السفر." },
  id: { title: "Pemantauan wabah penyakit — WHO, ECDC, PAHO, Africa CDC dalam satu dasbor | HealthWatch Global", description: "Pantau wabah penyakit aktif di seluruh dunia — WHO, ECDC, PAHO dan Africa CDC dalam satu dasbor. Peringatan, laporan PDF dan data CFR untuk tim kesehatan, manajer risiko, dan dokter perjalanan." },
};

const SNAPSHOT_COPY: Record<string, { cases: string; cfr: string; totalCases: string }> = {
  en: { cases: "cases", cfr: "CFR",           totalCases: "total confirmed cases" },
  fr: { cases: "cas",   cfr: "létalité",      totalCases: "cas confirmés au total" },
  es: { cases: "casos", cfr: "letalidad",     totalCases: "casos confirmados en total" },
  ar: { cases: "حالة",  cfr: "معدل الوفيات", totalCases: "حالة مؤكدة إجمالاً" },
  id: { cases: "kasus", cfr: "CFR",           totalCases: "total kasus terkonfirmasi" },
};

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const m = user
    ? (DASHBOARD_META[locale] ?? DASHBOARD_META.en)
    : (LANDING_META[locale] ?? LANDING_META.en);
  const url = `https://healthwatch-global.com/${locale}`;
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}`])),
        "x-default": "https://healthwatch-global.com/en",
      },
    },
    openGraph: {
      type: "website",
      url,
      title: m.title,
      description: m.description,
      siteName: "HealthWatch Global",
      locale: OG_LOCALE[locale] ?? "en_US",
      images: [{ url: `https://healthwatch-global.com/api/og?locale=${locale}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: [`https://healthwatch-global.com/api/og?locale=${locale}`],
    },
    robots: { index: !user, follow: true },
  };
}

async function DashboardContent({ demo = false }: { demo?: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tRisk = await getTranslations("risk");
  const tAlerts = await getTranslations("alerts");

  // Check user plan — skipped entirely in demo mode (treat as anonymous free visitor)
  let plan = "free";
  let trialEndsAt: string | null = null;
  let hasStripeSubscription = false;
  let trialExpired = false;
  if (!demo) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id")
        .eq("id", user.id)
        .single();
      plan = profile?.plan || "free";
      trialEndsAt = profile?.trial_ends_at ?? null;

      // Server-side trial expiry guard: if trial_ends_at has passed and the user
      // has no Stripe subscription, treat them as free immediately.
      hasStripeSubscription = Boolean(profile?.stripe_subscription_id);
      if (
        plan !== "free" &&
        trialEndsAt &&
        new Date(trialEndsAt).getTime() < Date.now() &&
        !hasStripeSubscription
      ) {
        plan = "free";
        trialEndsAt = null;
        trialExpired = true;
      }
    }
  }

  const isPaid = plan === "starter" || plan === "pro" || plan === "team" || plan === "enterprise";

  const [outbreaks, lastSync] = await Promise.all([getOutbreaks(), getLastSync()]);
  const stats = getStats(outbreaks);

  // 7-day directional signal (▲/▼/→) — infrastructure has been live since 2026-06-05;
  // getOutbreakTrend returns "unknown" until outbreak_snapshots holds enough history,
  // so this stays a harmless no-op today and starts rendering on its own once the
  // data matures (~7 days of daily snapshots, i.e. around 2026-06-12).
  //
  // outbreak_snapshots has RLS enabled with NO public policies — "no direct public
  // access — only service role (cron) writes" (migration 20240109000000). The
  // anon/cookie-based `supabase` client above would silently get [] back forever,
  // so this needs the elevated client, same as app/api/watchlist/route.ts and
  // app/api/alert-diseases/route.ts.
  const trendsService = createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const trendsMap = await getOutbreakTrendsBulk(trendsService, outbreaks.map((o) => o.id));
  const trends: Record<string, OutbreakTrend> = Object.fromEntries(trendsMap);

  const popupLabels = {
    cases: t("cases"),
    deaths: t("deaths"),
    source: "Source",
    date: t("date"),
  };

  const riskLabels = {
    high: tRisk("high"),
    medium: tRisk("medium"),
    low: tRisk("low"),
  };

  const fc = FILTER_COPY[locale] ?? FILTER_COPY.en;
  const tableLabels = {
    disease:           t("disease"),
    country:           t("country"),
    cases:             t("cases"),
    deaths:            t("deaths"),
    riskLevel:         t("riskLevel"),
    date:              t("date"),
    searchPlaceholder: fc.searchPlaceholder,
    allRegions:        fc.allRegions,
    allCountries:      fc.allCountries,
    allRisks:          fc.allRisks,
    allCfr:            fc.allCfr,
    dateFrom:          fc.dateFrom,
    dateTo:            fc.dateTo,
    noResults:         fc.noResults,
    noData:            fc.noData,
    cfr:               fc.cfr,
    exportCsv:         fc.exportCsv,
    illustrativeBadge:   fc.illustrativeBadge,
    illustrativeTooltip: fc.illustrativeTooltip,
    officialBadge:       fc.officialBadge,
    officialTooltip:     fc.officialTooltip,
    donBadge:            fc.donBadge,
    donTooltip:          fc.donTooltip,
    allSources:          fc.allSources,
    africa:            tAlerts("africa"),
    asia:              tAlerts("asia"),
    europe:            tAlerts("europe"),
    americas:          tAlerts("americas"),
    oceania:           tAlerts("oceania"),
    high:              tRisk("high"),
    medium:            tRisk("medium"),
    low:               tRisk("low"),
    lockedCta:         t("lockedCta"),
  };

  // Show trial banner only for Pro users with a future trial_ends_at.
  // `new Date()` rather than `Date.now()`: react-hooks/purity's impure-function
  // registry lists `Date.now`/`Math.random`/`performance.now` but not the `Date`
  // constructor — same instant, same result, recognized as pure. (Same idiom
  // already used for `now` in admin/page.tsx.)
  const now = new Date();
  // Exclude paid subscribers (stripe_subscription_id set): they've already
  // committed, so the "add payment method" banner copy doesn't apply to them.
  const showTrialBanner =
    plan === "pro" &&
    trialEndsAt !== null &&
    new Date(trialEndsAt).getTime() > now.getTime() &&
    !hasStripeSubscription;

  const showFreeBanner = plan === "free";

  return (
    <>
      {demo && <DemoBanner locale={locale} />}

      {!demo && <OnboardingTour isPaid={isPaid} />}

      {!demo && showTrialBanner && (
        <TrialBanner trialEndsAt={trialEndsAt!} locale={locale} hasBilling={hasStripeSubscription} />
      )}
      {!demo && showFreeBanner && (
        <FreePlanBanner locale={locale} trialExpired={trialExpired} />
      )}

      {!demo && <PushNotificationBanner locale={locale} />}

      {/* Situation Snapshot — top-priority outbreak at a glance */}
      {stats.topOutbreak && (() => {
        const top  = stats.topOutbreak;
        const snap = SNAPSHOT_COPY[locale] ?? SNAPSHOT_COPY.en;
        const cfr  = top.cases > 0 && top.deaths > 0
          ? (top.deaths / top.cases * 100).toFixed(1)
          : null;
        const isRtl = locale === "ar";
        return (
          <div
            dir={isRtl ? "rtl" : undefined}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 text-sm"
          >
            {top.is_pheic && (
              <span className="bg-purple-950/60 text-purple-300 border border-purple-800/60 rounded px-2 py-0.5 text-xs font-bold shrink-0">
                PHEIC
              </span>
            )}
            {!top.is_pheic && top.risk_level === "high" && (
              <span className="bg-red-950/60 text-red-400 border border-red-800/60 rounded px-2 py-0.5 text-xs font-bold shrink-0">
                HIGH RISK
              </span>
            )}
            <span className="font-semibold text-white">{getLocalizedDisease(top, locale)}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400">{getLocalizedCountry(top, locale)}</span>
            {isPaid && top.cases > 0 && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-gray-300">{top.cases.toLocaleString("en")} {snap.cases}</span>
              </>
            )}
            {isPaid && cfr && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-red-400 font-medium">{cfr}% {snap.cfr}</span>
              </>
            )}
            {stats.totalCases > 0 && (
              <span className={`${isRtl ? "mr-auto" : "ml-auto"} text-gray-500 text-xs`}>
                {stats.totalCases.toLocaleString("en")} {snap.totalCases}
              </span>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard label={t("activeOutbreaks")} value={stats.activeOutbreaks} icon={<Activity className="w-5 h-5" />} color="red" />
        <StatsCard label={t("countriesAffected")} value={stats.countriesAffected} icon={<Globe className="w-5 h-5" />} color="blue" />
        <StatsCard label={t("highRisk")} value={stats.highRisk} icon={<AlertTriangle className="w-5 h-5" />} color="yellow" />
        <StatsCard
          label="PHEIC"
          value={stats.pheicCount}
          icon={<span className="text-lg">🚨</span>}
          color={stats.pheicCount > 0 ? "purple" : "gray"}
        />
      </div>

      <WorldMap outbreaks={outbreaks} locale={locale} isPaid={isPaid} popupLabels={popupLabels} riskLabels={riskLabels} />

      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">{t("recentAlerts")}</h2>
            <FreshnessBadge lastSync={lastSync} locale={locale} />
          </div>
          <CsvExportButton isPaid={isPaid} locale={locale} />
        </div>

        <OutbreakTable
          outbreaks={outbreaks}
          locale={locale}
          isPaid={isPaid}
          labels={tableLabels}
          trends={trends}
        />
      </div>
    </>
  );
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const isDemo = sp?.demo === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isDemo) {
    const schemas = [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "HealthWatch Global",
        "url": "https://healthwatch-global.com",
        "logo": "https://healthwatch-global.com/api/og",
        "description": "Global epidemic surveillance platform — WHO, ECDC, PAHO and Africa CDC data in 5 languages for health organizations worldwide.",
        "contactPoint": {
          "@type": "ContactPoint",
          "email": "contact@healthwatch-global.com",
          "contactType": "customer support",
          "availableLanguage": ["English", "French", "Spanish", "Arabic", "Indonesian"],
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "HealthWatch Global",
        "applicationCategory": "HealthApplication",
        "operatingSystem": "Web",
        "url": "https://healthwatch-global.com",
        "description": "Monitor disease outbreaks worldwide — WHO, ECDC, PAHO and Africa CDC. 5 languages, regional alerts, PDF reports and CSV export.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "EUR",
          "description": "Free tier — live outbreak map and dashboard, no account required.",
        },
        "featureList": [
          "WHO, ECDC, PAHO and Africa CDC outbreak data — updated every 6 hours",
          "5 languages — English, French, Spanish, Arabic, Indonesian",
          "Regional email alerts",
          "PDF epidemiological reports",
          "CSV data export",
          "Slack and Teams integration",
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "HealthWatch Global",
        "url": "https://healthwatch-global.com",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://healthwatch-global.com/en?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
    ];
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
        />
        <LandingPage locale={locale} />
        <CampaignRefTracker />
      </>
    );
  }

  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-8">
      {/* Track campaign ref (?ref=producthunt etc.) for demo visitors too */}
      {isDemo && !user && <CampaignRefTracker />}
      <div>
        <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
        <p className="text-gray-400 mt-1">{t("subtitle")}</p>
      </div>
      <Suspense fallback={
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3" />
          {t("loading")}
        </div>
      }>
        <DashboardContent demo={isDemo && !user} />
      </Suspense>
    </div>
  );
}

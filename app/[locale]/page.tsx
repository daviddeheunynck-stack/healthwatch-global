import { getTranslations, getLocale } from "next-intl/server";
import { Activity, Globe, Bell, AlertTriangle } from "lucide-react";
import { getOutbreaks, getStats, getLastSync } from "@/lib/outbreaks";
import { getOutbreakTrendsBulk, type OutbreakTrend } from "@/lib/outbreak-trend";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import StatsCard from "@/components/StatsCard";
import WorldMap from "@/components/WorldMap";
import LandingPage from "@/components/LandingPage";
import OutbreakTable from "@/components/OutbreakTable";
import FreshnessBadge from "@/components/FreshnessBadge";
import TrialBanner from "@/components/TrialBanner";
import PushNotificationBanner from "@/components/PushNotificationBanner";
import CsvExportButton from "@/components/CsvExportButton";
import OnboardingTour from "@/components/OnboardingTour";
import { Suspense } from "react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const DASHBOARD_META: Record<string, { title: string; description: string }> = {
  en: { title: "Global Disease Outbreak Dashboard", description: "Real-time map and table of active disease outbreaks worldwide. Data sourced from the WHO Disease Outbreak News API." },
  fr: { title: "Tableau de bord — Foyers épidémiques mondiaux", description: "Carte et tableau en temps réel des foyers épidémiques actifs dans le monde. Données issues de l'API WHO Disease Outbreak News." },
  es: { title: "Panel de vigilancia epidémica mundial", description: "Mapa y tabla en tiempo real de brotes de enfermedades activos en todo el mundo. Datos de la API WHO Disease Outbreak News." },
  ar: { title: "لوحة تحكم تفشي الأمراض العالمية", description: "خريطة وجدول في الوقت الفعلي لتفشي الأمراض النشطة حول العالم. بيانات من واجهة أخبار تفشي أمراض منظمة الصحة العالمية." },
  id: { title: "Dasbor Wabah Penyakit Global", description: "Peta dan tabel real-time wabah penyakit aktif di seluruh dunia. Data dari API WHO Disease Outbreak News." },
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
}> = {
  en: { searchPlaceholder: "Search disease or country…", allRegions: "All regions", allCountries: "All countries", allRisks: "All risks",       allCfr: "All CFR",       dateFrom: "From", dateTo: "To",     noResults: "No outbreaks match your filters.",              noData: "N/A", cfr: "CFR",          exportCsv: "Export" },
  fr: { searchPlaceholder: "Rechercher maladie ou pays…", allRegions: "Toutes régions", allCountries: "Tous pays",   allRisks: "Tous niveaux", allCfr: "Toute létalité", dateFrom: "Du",   dateTo: "Au",     noResults: "Aucun foyer ne correspond aux filtres.",        noData: "N/D", cfr: "Létalité",     exportCsv: "Exporter" },
  es: { searchPlaceholder: "Buscar enfermedad o país…",   allRegions: "Todas las regiones", allCountries: "Todos los países", allRisks: "Todos los niveles", allCfr: "Toda letalidad", dateFrom: "Desde", dateTo: "Hasta", noResults: "Ningún brote coincide con los filtros.", noData: "N/D", cfr: "Letalidad",   exportCsv: "Exportar" },
  ar: { searchPlaceholder: "ابحث عن مرض أو دولة…",      allRegions: "كل المناطق",    allCountries: "كل الدول",   allRisks: "كل المستويات", allCfr: "كل معدلات الوفيات", dateFrom: "من",   dateTo: "إلى", noResults: "لا توجد تفشيات تطابق المرشحات.",              noData: "غ/م",  cfr: "معدل الوفيات", exportCsv: "تصدير" },
  id: { searchPlaceholder: "Cari penyakit atau negara…",  allRegions: "Semua wilayah", allCountries: "Semua negara", allRisks: "Semua tingkat", allCfr: "Semua CFR",     dateFrom: "Dari", dateTo: "Hingga", noResults: "Tidak ada wabah yang cocok dengan filter.",    noData: "T/S", cfr: "CFR",          exportCsv: "Ekspor" },
};

const LANDING_META: Record<string, { title: string; description: string }> = {
  en: { title: "WHO outbreak tracker for health professionals | HealthWatch Global", description: "All WHO Disease Outbreak News, aggregated and translated — without the manual research. Real-time alerts, PDF reports and CFR data for travel medicine doctors, health consultants and epidemiologists." },
  fr: { title: "Surveillance épidémique OMS pour professionnels de santé | HealthWatch Global", description: "Toutes les données OMS sur les foyers épidémiques, agrégées et traduites — sans les heures de recherche. Alertes temps réel, rapports PDF et données de létalité pour médecins, consultants et épidémiologistes." },
  es: { title: "Vigilancia de brotes OMS para profesionales de salud | HealthWatch Global", description: "Todos los datos OMS sobre brotes, agregados y traducidos — sin horas de investigación. Alertas en tiempo real, informes PDF y datos de letalidad para médicos, consultores y epidemiólogos." },
  ar: { title: "متابعة تفشيات منظمة الصحة العالمية للمتخصصين الصحيين | HealthWatch Global", description: "جميع بيانات تفشي الأمراض من منظمة الصحة العالمية، مجمعة ومترجمة — دون ساعات البحث. تنبيهات فورية وتقارير PDF لأطباء السفر والمستشارين وعلماء الأوبئة." },
  id: { title: "Pemantau wabah WHO untuk profesional kesehatan | HealthWatch Global", description: "Semua data wabah WHO, diagregasi dan diterjemahkan — tanpa berjam-jam penelitian. Peringatan real-time, laporan PDF untuk dokter, konsultan, dan epidemiolog." },
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
  return { title: m.title, description: m.description };
}

async function DashboardContent() {
  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tRisk = await getTranslations("risk");
  const tAlerts = await getTranslations("alerts");

  // Check user plan
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let plan = "free";
  let trialEndsAt: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, trial_ends_at")
      .eq("id", user.id)
      .single();
    plan = profile?.plan || "free";
    trialEndsAt = (profile as any)?.trial_ends_at ?? null;
  }

  const isPaid = plan === "starter" || plan === "pro" || plan === "enterprise";

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
  // Cast: getOutbreakTrendsBulk types its param as `ReturnType<typeof createClient>`
  // (no explicit generics) — TS resolves that against a different overload than the
  // one a real `createClient(url, key)` call hits, so even this textbook-correct
  // client doesn't structurally match on paper. Same friction the function already
  // works around with `(supabase as any)` internally (lib/outbreak-trend.ts:87,95);
  // the object underneath is a perfectly valid SupabaseClient — a paper mismatch only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendsMap = await getOutbreakTrendsBulk(trendsService as any, outbreaks.map((o) => o.id));
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

  // Show trial banner only for Pro users with a future trial_ends_at
  const showTrialBanner =
    plan === "pro" &&
    trialEndsAt !== null &&
    new Date(trialEndsAt).getTime() > Date.now();

  return (
    <>
      {showTrialBanner && (
        <TrialBanner trialEndsAt={trialEndsAt!} locale={locale} />
      )}

      {/* Push opt-in nudge — self-hides (unsupported / already subscribed /
          dismissed / denied), so it only ever reaches someone for whom one
          click becomes a live "it actually pinged me" demo. See
          PushNotificationBanner for the full marketing rationale. */}
      <PushNotificationBanner locale={locale} />

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const schemas = [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "HealthWatch Global",
        "url": "https://healthwatch-global.com",
        "logo": "https://healthwatch-global.com/api/og",
        "description": "Real-time global epidemic surveillance platform. WHO data in 5 languages for health organizations worldwide.",
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
        "description": "Monitor disease outbreaks worldwide in real time. Official WHO data, 5 languages, regional alerts, PDF reports and CSV export.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "EUR",
          "description": "Free tier — live outbreak map and dashboard, no account required.",
        },
        "featureList": [
          "Real-time WHO disease outbreak map",
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
      </>
    );
  }

  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-8">
      {/* Onboarding tour — shown once to new users, client-side only */}
      <OnboardingTour />

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
        <DashboardContent />
      </Suspense>
    </div>
  );
}

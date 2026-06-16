import { getTranslations, getLocale } from "next-intl/server";
import { Activity, Globe, Bell, AlertTriangle } from "lucide-react";
import { getOutbreaks, getStats, getLastSync } from "@/lib/outbreaks";
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
import { Suspense } from "react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const DASHBOARD_META: Record<string, { title: string; description: string }> = {
  en: { title: "Global Disease Outbreak Dashboard", description: "Map and table of active disease outbreaks worldwide — updated every 6 hours from the WHO Disease Outbreak News API." },
  fr: { title: "Tableau de bord — Foyers épidémiques mondiaux", description: "Carte et tableau des foyers épidémiques actifs dans le monde, mis à jour toutes les 6h via l'API WHO Disease Outbreak News." },
  es: { title: "Panel de vigilancia epidémica mundial", description: "Mapa y tabla de brotes de enfermedades activos en todo el mundo — actualizados cada 6 horas desde la API WHO Disease Outbreak News." },
  ar: { title: "لوحة تحكم تفشي الأمراض العالمية", description: "خريطة وجدول لتفشي الأمراض النشطة حول العالم — تُحدَّث كل 6 ساعات من واجهة أخبار تفشي أمراض منظمة الصحة العالمية." },
  id: { title: "Dasbor Wabah Penyakit Global", description: "Peta dan tabel wabah penyakit aktif di seluruh dunia — diperbarui setiap 6 jam dari API WHO Disease Outbreak News." },
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
}> = {
  en: { searchPlaceholder: "Search disease or country…", allRegions: "All regions", allCountries: "All countries", allRisks: "All risks",       allCfr: "All CFR",       dateFrom: "From", dateTo: "To",     noResults: "No outbreaks match your filters.",              noData: "N/A", cfr: "CFR",          exportCsv: "Export",   illustrativeBadge: "UNVERIFIED",      illustrativeTooltip: "Unverified placeholder figures — not yet matched to a confirmed WHO/official report. Treat with caution.", officialBadge: "OFFICIAL",      officialTooltip: "Confirmed official source (WHO situation report, ECDC, or national Ministry of Health) — no WHO DON reference number." },
  fr: { searchPlaceholder: "Rechercher maladie ou pays…", allRegions: "Toutes régions", allCountries: "Tous pays",   allRisks: "Tous niveaux", allCfr: "Toute létalité", dateFrom: "Du",   dateTo: "Au",     noResults: "Aucun foyer ne correspond aux filtres.",        noData: "N/D", cfr: "Létalité",     exportCsv: "Exporter", illustrativeBadge: "NON VÉRIFIÉ",     illustrativeTooltip: "Chiffres provisoires non vérifiés — pas encore rattachés à un rapport OMS/officiel confirmé. À utiliser avec précaution.", officialBadge: "OFFICIEL",      officialTooltip: "Source officielle confirmée (rapport OMS, ECDC ou ministère de la santé) — sans numéro de bulletin DON." },
  es: { searchPlaceholder: "Buscar enfermedad o país…",   allRegions: "Todas las regiones", allCountries: "Todos los países", allRisks: "Todos los niveles", allCfr: "Toda letalidad", dateFrom: "Desde", dateTo: "Hasta", noResults: "Ningún brote coincide con los filtros.", noData: "N/D", cfr: "Letalidad",   exportCsv: "Exportar", illustrativeBadge: "NO VERIFICADO",   illustrativeTooltip: "Cifras provisionales no verificadas — aún no vinculadas a un informe oficial/OMS confirmado. Usar con precaución.", officialBadge: "OFICIAL",       officialTooltip: "Fuente oficial confirmada (informe OMS, ECDC o ministerio de salud) — sin número de boletín DON." },
  ar: { searchPlaceholder: "ابحث عن مرض أو دولة…",      allRegions: "كل المناطق",    allCountries: "كل الدول",   allRisks: "كل المستويات", allCfr: "كل معدلات الوفيات", dateFrom: "من",   dateTo: "إلى", noResults: "لا توجد تفشيات تطابق المرشحات.",              noData: "غ/م",  cfr: "معدل الوفيات", exportCsv: "تصدير",     illustrativeBadge: "غير مؤكد",        illustrativeTooltip: "أرقام تجريبية غير مؤكدة — لم تُربط بعد بتقرير رسمي مؤكد لمنظمة الصحة العالمية. يُرجى التعامل معها بحذر.", officialBadge: "رسمي",          officialTooltip: "مصدر رسمي مؤكد (تقرير منظمة الصحة العالمية أو المركز الأوروبي أو وزارة الصحة) — بدون رقم نشرة DON." },
  id: { searchPlaceholder: "Cari penyakit atau negara…",  allRegions: "Semua wilayah", allCountries: "Semua negara", allRisks: "Semua tingkat", allCfr: "Semua CFR",     dateFrom: "Dari", dateTo: "Hingga", noResults: "Tidak ada wabah yang cocok dengan filter.",    noData: "T/S", cfr: "CFR",          exportCsv: "Ekspor",   illustrativeBadge: "BELUM DIVERIFIKASI", illustrativeTooltip: "Angka sementara yang belum diverifikasi — belum dikaitkan dengan laporan resmi/WHO yang terkonfirmasi. Gunakan dengan hati-hati.", officialBadge: "RESMI",         officialTooltip: "Sumber resmi yang dikonfirmasi (laporan WHO, ECDC, atau Kementerian Kesehatan) — tanpa nomor buletin DON WHO." },
};

const LANDING_META: Record<string, { title: string; description: string }> = {
  en: { title: "WHO outbreak tracker for health professionals | HealthWatch Global", description: "All WHO Disease Outbreak News, aggregated and translated — without the manual research. Instant alerts, PDF reports and CFR data for travel medicine doctors, health consultants and epidemiologists." },
  fr: { title: "Surveillance épidémique OMS pour professionnels de santé | HealthWatch Global", description: "Toutes les données OMS sur les foyers épidémiques, agrégées et traduites — sans les heures de recherche. Alertes instantanées, rapports PDF et données de létalité pour médecins, consultants et épidémiologistes." },
  es: { title: "Vigilancia de brotes OMS para profesionales de salud | HealthWatch Global", description: "Todos los datos OMS sobre brotes, agregados y traducidos — sin horas de investigación. Alertas instantáneas, informes PDF y datos de letalidad para médicos, consultores y epidemiólogos." },
  ar: { title: "متابعة تفشيات منظمة الصحة العالمية للمتخصصين الصحيين | HealthWatch Global", description: "جميع بيانات تفشي الأمراض من منظمة الصحة العالمية، مجمعة ومترجمة — دون ساعات البحث. تنبيهات فورية وتقارير PDF لأطباء السفر والمستشارين وعلماء الأوبئة." },
  id: { title: "Pemantau wabah WHO untuk profesional kesehatan | HealthWatch Global", description: "Semua data wabah WHO, diagregasi dan diterjemahkan — tanpa berjam-jam penelitian. Peringatan instan, laporan PDF untuk dokter, konsultan, dan epidemiolog." },
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
  let hasStripeSubscription = false;
  let trialExpired = false;
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
    // (The expire-trials cron also handles this async, but this catches the gap
    // on every page load so there's zero grace period after trial expiry.)
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
  const showTrialBanner =
    plan === "pro" &&
    trialEndsAt !== null &&
    new Date(trialEndsAt).getTime() > now.getTime();

  const showFreeBanner = plan === "free";

  return (
    <>
      <OnboardingTour isPaid={isPaid} />

      {showTrialBanner && (
        <TrialBanner trialEndsAt={trialEndsAt!} locale={locale} hasBilling={hasStripeSubscription} />
      )}
      {showFreeBanner && (
        <FreePlanBanner locale={locale} trialExpired={trialExpired} />
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
        "description": "Global epidemic surveillance platform — WHO data updated every 6 hours, in 5 languages for health organizations worldwide.",
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
        "description": "Monitor disease outbreaks worldwide — WHO data updated every 6 hours. 5 languages, regional alerts, PDF reports and CSV export.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "EUR",
          "description": "Free tier — live outbreak map and dashboard, no account required.",
        },
        "featureList": [
          "WHO disease outbreak map — updated every 6 hours",
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

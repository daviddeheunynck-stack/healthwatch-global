import { getTranslations, getLocale } from "next-intl/server";
import { headers } from "next/headers";
import Link from "next/link";
import { Activity, Globe, AlertTriangle } from "lucide-react";
import { getOutbreaks, getStats, getLastSync, getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { ISO_REGION } from "@/lib/geo-data";
import { getOutbreakTrendsBulk, type OutbreakTrend } from "@/lib/outbreak-trend";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import StatsCard from "@/components/StatsCard";
import WorldMap from "@/components/WorldMap";
import LandingPage from "@/components/LandingPage";
import CampaignRefTracker from "@/components/CampaignRefTracker";
import OutbreakTable from "@/components/OutbreakTable";
import FreshnessBadge from "@/components/FreshnessBadge";
import NewThisWeekWidget from "@/components/NewThisWeekWidget";
import PushNotificationBanner from "@/components/PushNotificationBanner";
import CsvExportButton from "@/components/CsvExportButton";
import SignalsFeed from "@/components/SignalsFeed";
import DataStatusWidget from "@/components/DataStatusWidget";
import OnboardingTour from "@/components/OnboardingTour";
import FreePlanBanner from "@/components/FreePlanBanner";
import DemoBanner from "@/components/DemoBanner";
import CountryScorecardTab from "@/components/CountryScorecardTab";
import ResolvedOutbreaksWidget from "@/components/ResolvedOutbreaksWidget";
import FeatureHub from "@/components/FeatureHub";
import DashboardAlertsWidget from "@/components/DashboardAlertsWidget";
import RegionalPulseSummary from "@/components/RegionalPulseSummary";
import AlertSetupBanner from "@/components/AlertSetupBanner";
import DiseaseAlertSetupBanner from "@/components/DiseaseAlertSetupBanner";
import ProQuickStart from "@/components/ProQuickStart";
import { Suspense } from "react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const DASHBOARD_META: Record<string, { title: string; description: string }> = {
  en: { title: "Global Disease Outbreak Dashboard", description: "Map and table of active disease outbreaks worldwide — official WHO (hourly), ECDC, PAHO and Africa CDC data (weekly)." },
  fr: { title: "Tableau de bord — Foyers épidémiques mondiaux", description: "Carte et tableau des foyers épidémiques actifs dans le monde, issus des sources officielles OMS (toutes les heures), ECDC, PAHO et Africa CDC (hebdomadaire)." },
  es: { title: "Panel de vigilancia epidémica mundial", description: "Mapa y tabla de brotes de enfermedades activos en todo el mundo — datos oficiales OMS (cada hora), ECDC, PAHO y Africa CDC (semanal)." },
  ar: { title: "لوحة تحكم تفشي الأمراض العالمية", description: "خريطة وجدول لتفشي الأمراض النشطة حول العالم — بيانات رسمية من WHO (كل ساعة) وECDC وPAHO وAfrica CDC (أسبوعياً)." },
  id: { title: "Dasbor Wabah Penyakit Global", description: "Peta dan tabel wabah penyakit aktif di seluruh dunia — data resmi WHO (setiap jam), ECDC, PAHO dan Africa CDC (mingguan)." },
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

const SNAPSHOT_COPY: Record<string, { cases: string; cfr: string }> = {
  en: { cases: "cases", cfr: "CFR"           },
  fr: { cases: "cas",   cfr: "létalité"      },
  es: { cases: "casos", cfr: "letalidad"     },
  ar: { cases: "حالة",  cfr: "معدل الوفيات" },
  id: { cases: "kasus", cfr: "CFR"           },
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
  let m = user
    ? (DASHBOARD_META[locale] ?? DASHBOARD_META.en)
    : (LANDING_META[locale] ?? LANDING_META.en);

  if (!user) {
    try {
      const svc = createService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { count } = await svc
        .from("outbreaks")
        .select("*", { count: "exact", head: true })
        .eq("active", true);
      if (count && count > 0) {
        const prefix: Record<string, string> = {
          en: `${count} active outbreaks tracked — `,
          fr: `${count} foyers épidémiques actifs — `,
          es: `${count} brotes activos — `,
          ar: `${count} تفشٍّ نشط — `,
          id: `${count} wabah aktif — `,
        };
        m = { ...m, description: (prefix[locale] ?? prefix.en) + m.description };
      }
    } catch { /* static description as fallback */ }
  }

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

const VALID_REGIONS = new Set(["all","africa","asia","americas","europe","oceania"]);
const VALID_RISKS   = new Set(["all","high","medium","low"]);

async function DashboardContent({ demo = false, urlRegion, urlRisk }: { demo?: boolean; urlRegion?: string; urlRisk?: string }) {
  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tRisk = await getTranslations("risk");
  const tAlerts = await getTranslations("alerts");

  // Geo-detect visitor region from Vercel edge header (falls back to "all" locally or if unknown)
  const reqHeaders = await headers();
  const geoCountry = (reqHeaders.get("x-vercel-ip-country") ?? "").toUpperCase();
  const geoRegion: string = ISO_REGION[geoCountry] ?? "all";

  // Check user plan — skipped entirely in demo mode (treat as anonymous free visitor)
  let plan = "free";
  let trialEndsAt: string | null = null;
  let hasStripeSubscription = false;
  let trialExpired = false;
  let displayFilters: { region: string; country: string } | null = null;
  let diseaseWatchlist: string[] = [];
  const countryTagsMap: Record<string, string> = {};
  let orgMemberAccess = false;
  let hasNoAlerts = false;
  let hasDiseaseAlerts = false;
  let currentUserId: string | null = null;
  if (!demo) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      currentUserId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id, display_filters, disease_watchlist")
        .eq("id", user.id)
        .single();
      plan = profile?.plan || "free";
      trialEndsAt = profile?.trial_ends_at ?? null;

      // Server-side trial expiry guard: covers two cases —
      // (a) expire-trials cron hasn't run yet: plan=pro, trial_ends_at < now
      // (b) cron already ran: plan=free, trial_ends_at < now (preserved by cron)
      // Both should show "Subscribe" copy, not "Start free trial".
      hasStripeSubscription = Boolean(profile?.stripe_subscription_id);
      if (
        trialEndsAt &&
        new Date(trialEndsAt).getTime() < Date.now() &&
        !hasStripeSubscription
      ) {
        plan = "free";
        trialEndsAt = null;
        trialExpired = true;
      }

      const isPaidPlan = ["starter", "pro", "team", "enterprise"].includes(plan);
      if (isPaidPlan && profile?.display_filters) {
        displayFilters = profile.display_filters as { region: string; country: string };
      }
      if (isPaidPlan) {
        diseaseWatchlist = (profile?.disease_watchlist as string[] | null) ?? [];
        const [tagResult, alertRegionResult, diseaseAlertResult] = await Promise.all([
          supabase.from("user_country_tags").select("country_en, label").eq("user_id", user.id),
          supabase.from("user_alert_regions").select("region", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("user_alert_diseases").select("disease_en", { count: "exact", head: true }).eq("user_id", user.id),
        ]);
        for (const t of (tagResult.data ?? []) as { country_en: string; label: string }[]) {
          countryTagsMap[t.country_en] = t.label;
        }
        hasNoAlerts = (alertRegionResult.count ?? 0) === 0;
        hasDiseaseAlerts = (diseaseAlertResult.count ?? 0) > 0;
      }
      // Org members inherit Team-level access even if their own plan is free
      if (!isPaidPlan) {
        const { data: orgMembership } = await supabase
          .from("organization_members")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        orgMemberAccess = !!orgMembership;
      }
    }
  }

  const isPaid = plan === "starter" || plan === "pro" || plan === "team" || plan === "enterprise" || orgMemberAccess;

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
  const showFreeBanner = plan === "free";

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const missedAlertOutbreaks = showFreeBanner
    ? outbreaks
        .filter(o =>
          o.active &&
          ["high", "medium"].includes(o.risk_level) &&
          (geoRegion === "all" || o.region === geoRegion) &&
          o.updated_at && new Date(o.updated_at) > sevenDaysAgo
        )
        .sort((a, b) => (b.is_pheic ? 1 : 0) - (a.is_pheic ? 1 : 0) || (b.cases - a.cases))
        .slice(0, 3)
    : [];
  const missedAlerts = missedAlertOutbreaks.length;

  return (
    <>
      {demo && <DemoBanner locale={locale} />}

      {!demo && <OnboardingTour isPaid={isPaid} />}

      {!demo && showFreeBanner && (
        <FreePlanBanner
          locale={locale}
          trialExpired={trialExpired}
          missedAlerts={missedAlerts}
          missedAlertNames={missedAlertOutbreaks.map(o => ({
            disease: getLocalizedDisease(o, locale),
            country: getLocalizedCountry(o, locale),
            delta24h: trends[o.id]?.delta24h ?? null,
          }))}
        />
      )}

      {!demo && <PushNotificationBanner locale={locale} />}

      {!demo && isPaid && currentUserId && !hasStripeSubscription && trialEndsAt && (
        <ProQuickStart locale={locale} userId={currentUserId} hasAlerts={!hasNoAlerts} hasDiseaseAlerts={hasDiseaseAlerts} />
      )}
      {!demo && isPaid && hasNoAlerts && <AlertSetupBanner locale={locale} />}
      {!demo && isPaid && !hasNoAlerts && !hasStripeSubscription && (
        <DiseaseAlertSetupBanner locale={locale} />
      )}

      {/* Situation Snapshot — top-priority outbreak at a glance */}
      {stats.topOutbreak && (() => {
        const top  = stats.topOutbreak;
        const snap = SNAPSHOT_COPY[locale] ?? SNAPSHOT_COPY.en;
        const cfr  = top.cases > 0 && top.deaths !== null && top.deaths > 0
          ? (top.deaths / top.cases * 100).toFixed(1)
          : null;
        const topTrend    = trends[top.id];
        const d7pct       = topTrend?.direction === "up" || topTrend?.direction === "down"
          ? topTrend.deltaPercent
          : null;
        const d24h        = topTrend?.delta24h ?? null;
        const numLocale   = locale === "ar" ? "ar-SA" : locale;
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
                {riskLabels.high}
              </span>
            )}
            <span className="font-semibold text-white">{getLocalizedDisease(top, locale)}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400">{getLocalizedCountry(top, locale)}</span>
            {top.cases > 0 && (
              <>
                <span className="text-gray-600">·</span>
                {isPaid ? (
                  <span className="text-gray-300">{top.cases.toLocaleString(numLocale)} {snap.cases}</span>
                ) : (
                  <span className="blur-sm select-none text-gray-500">{top.cases.toLocaleString(numLocale)} {snap.cases}</span>
                )}
              </>
            )}
            {cfr && (
              <>
                <span className="text-gray-600">·</span>
                {isPaid ? (
                  <span className="text-red-400 font-medium">{cfr}% {snap.cfr}</span>
                ) : (
                  <span className="blur-sm select-none text-gray-500">{cfr}% {snap.cfr}</span>
                )}
              </>
            )}
            {/* 7-day trend — visible to all users (qualitative signal, same as TrendBadge) */}
            {d7pct !== null && (
              <>
                <span className="text-gray-600">·</span>
                <span className={`text-xs font-semibold tabular-nums ${d7pct > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {d7pct > 0 ? "↑" : "↓"} {d7pct > 0 ? "+" : ""}{d7pct}%
                  <span className="text-gray-600 font-normal ml-1">
                    {locale === "fr" ? "7j" : locale === "es" ? "7d" : locale === "ar" ? "٧ أيام" : locale === "id" ? "7h" : "7d"}
                  </span>
                </span>
              </>
            )}
            {/* 24h delta — visible to all, signals the data is live */}
            {d24h !== null && d24h !== 0 && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-xs font-semibold tabular-nums text-sky-400">
                  {d24h > 0 ? "+" : ""}{d24h.toLocaleString(numLocale)}
                  <span className="text-gray-600 font-normal ml-1">/24h</span>
                </span>
              </>
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

      {/* Active PHEIC bar — names the specific PHEICs, visible to all, drives clicks */}
      {outbreaks.filter(o => o.is_pheic).length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-purple-300/80">
          <span className="text-purple-400 font-bold shrink-0">🚨 PHEIC</span>
          <span className="text-gray-700">·</span>
          {outbreaks.filter(o => o.is_pheic).map((o, i, arr) => (
            <span key={o.id} className="inline-flex items-center gap-1">
              <span className="font-medium text-purple-200">{getLocalizedDisease(o, locale)}</span>
              <span className="text-gray-600">{getLocalizedCountry(o, locale)}</span>
              {i < arr.length - 1 && <span className="text-gray-700 ml-1">·</span>}
            </span>
          ))}
          <span className="text-gray-700">·</span>
          <span className="text-gray-600 italic">
            {locale === "fr" ? "Urgence sanitaire internationale — niveau maximal OMS"
             : locale === "es" ? "Emergencia sanitaria internacional — nivel máximo OMS"
             : locale === "ar" ? "طوارئ صحية دولية — أعلى مستوى إنذار WHO"
             : locale === "id" ? "Darurat kesehatan internasional — level tertinggi WHO"
             : "International health emergency — highest WHO alert level"}
          </span>
        </div>
      )}

      {isPaid && currentUserId && (
        <DashboardAlertsWidget locale={locale} userId={currentUserId} />
      )}

      <NewThisWeekWidget outbreaks={outbreaks} locale={locale} trends={trends} isPaid={isPaid} />

      <WorldMap outbreaks={outbreaks} locale={locale} isPaid={isPaid} popupLabels={popupLabels} riskLabels={riskLabels} />

      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">{t("recentAlerts")}</h2>
            <FreshnessBadge lastSync={lastSync} locale={locale} />
          </div>
          <CsvExportButton isPaid={isPaid} locale={locale} />
        </div>

        {isPaid && <RegionalPulseSummary outbreaks={outbreaks} locale={locale} />}

        {!isPaid && !demo && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-800/30 bg-amber-950/20 px-4 py-2.5 text-xs">
            <span className="text-amber-300/80">
              {trialExpired
                ? (locale === "fr" ? "Votre essai a expiré — cas, décès et CFR masqués." :
                   locale === "es" ? "Tu prueba expiró — casos, muertes y CFR ocultos." :
                   locale === "ar" ? "انتهت تجربتك — الحالات والوفيات وCFR مخفية." :
                   locale === "id" ? "Uji coba Anda berakhir — kasus, kematian, dan CFR tersembunyi." :
                   "Your trial ended — case counts, deaths and CFR are hidden.")
                : (locale === "fr" ? "Plan gratuit — cas, décès et létalité masqués." :
                   locale === "es" ? "Plan gratuito — casos, muertes y letalidad ocultos." :
                   locale === "ar" ? "الخطة المجانية — الحالات والوفيات وCFR مخفية." :
                   locale === "id" ? "Paket gratis — kasus, kematian, dan CFR tersembunyi." :
                   "Free plan — case counts, deaths and CFR hidden.")}
            </span>
            <Link href={`/${locale}/pricing`} className="shrink-0 font-semibold text-amber-300 hover:text-white transition-colors whitespace-nowrap">
              {locale === "fr" ? "Passer à Pro →" :
               locale === "es" ? "Actualizar a Pro →" :
               locale === "ar" ? "← الترقية إلى Pro" :
               locale === "id" ? "Upgrade ke Pro →" :
               "Upgrade to Pro →"}
            </Link>
          </div>
        )}

        <OutbreakTable
          outbreaks={outbreaks}
          locale={locale}
          isPaid={isPaid}
          labels={tableLabels}
          trends={trends}
          defaultFilters={{
            region:  (VALID_REGIONS.has(urlRegion ?? "") ? urlRegion : displayFilters?.region ?? "all") as "all" | "africa" | "asia" | "europe" | "americas" | "oceania",
            country: displayFilters?.country ?? "all",
            risk:    (VALID_RISKS.has(urlRisk ?? "") ? urlRisk : "all") as "all" | "high" | "medium" | "low",
          }}
          diseaseWatchlist={diseaseWatchlist.length > 0 ? diseaseWatchlist : undefined}
          countryTags={Object.keys(countryTagsMap).length > 0 ? countryTagsMap : undefined}
        />

        <p className="text-xs text-gray-600 mt-3 text-right">
          <Link href={`/${locale}/methodology`} className="hover:text-gray-400 transition-colors">
            {locale === "fr" ? "Sources & méthodologie →" : locale === "es" ? "Fuentes y metodología →" : locale === "ar" ? "المصادر والمنهجية ←" : locale === "id" ? "Sumber & metodologi →" : "Data sources & methodology →"}
          </Link>
        </p>
      </div>

      {isPaid && <CountryScorecardTab locale={locale} />}
      {isPaid && <ResolvedOutbreaksWidget locale={locale} />}
      {isPaid && <DataStatusWidget locale={locale} />}

      {isPaid && (
        <div className="rounded-xl border border-amber-800/20 bg-amber-950/10 p-4">
          <SignalsFeed locale={locale} />
        </div>
      )}

      {isPaid && <FeatureHub locale={locale} />}
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
          "WHO, ECDC, PAHO and Africa CDC outbreak data — WHO updated hourly, ECDC/PAHO/Africa CDC weekly",
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
        {schemas.map((s, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
        ))}
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
        <DashboardContent
          demo={isDemo && !user}
          urlRegion={typeof sp.region === "string" ? sp.region : undefined}
          urlRisk={typeof sp.risk === "string" ? sp.risk : undefined}
        />
      </Suspense>
    </div>
  );
}

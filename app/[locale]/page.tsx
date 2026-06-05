import { getTranslations, getLocale } from "next-intl/server";
import { Activity, Globe, Bell, AlertTriangle } from "lucide-react";
import { getOutbreaks, getStats, getLastSync } from "@/lib/outbreaks";
import { createClient } from "@/lib/supabase-server";
import StatsCard from "@/components/StatsCard";
import WorldMap from "@/components/WorldMap";
import LandingPage from "@/components/LandingPage";
import OutbreakTable from "@/components/OutbreakTable";
import FreshnessBadge from "@/components/FreshnessBadge";
import TrialBanner from "@/components/TrialBanner";
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
  dateFrom: string;
  dateTo: string;
  noResults: string;
  noData: string;
  cfr: string;
}> = {
  en: { searchPlaceholder: "Search disease or country…", allRegions: "All regions", allCountries: "All countries", allRisks: "All risks",       dateFrom: "From", dateTo: "To", noResults: "No outbreaks match your filters.",              noData: "N/A", cfr: "CFR" },
  fr: { searchPlaceholder: "Rechercher maladie ou pays…", allRegions: "Toutes régions", allCountries: "Tous pays",   allRisks: "Tous niveaux", dateFrom: "Du",   dateTo: "Au", noResults: "Aucun foyer ne correspond aux filtres.",        noData: "N/D", cfr: "Létalité" },
  es: { searchPlaceholder: "Buscar enfermedad o país…",   allRegions: "Todas las regiones", allCountries: "Todos los países", allRisks: "Todos los niveles", dateFrom: "Desde", dateTo: "Hasta", noResults: "Ningún brote coincide con los filtros.", noData: "N/D", cfr: "Letalidad" },
  ar: { searchPlaceholder: "ابحث عن مرض أو دولة…",      allRegions: "كل المناطق",    allCountries: "كل الدول",   allRisks: "كل المستويات", dateFrom: "من",   dateTo: "إلى", noResults: "لا توجد تفشيات تطابق المرشحات.",              noData: "غ/م",  cfr: "معدل الوفيات" },
  id: { searchPlaceholder: "Cari penyakit atau negara…",  allRegions: "Semua wilayah", allCountries: "Semua negara", allRisks: "Semua tingkat", dateFrom: "Dari", dateTo: "Hingga", noResults: "Tidak ada wabah yang cocok dengan filter.",    noData: "T/S", cfr: "CFR" },
};

const LANDING_META: Record<string, { title: string; description: string }> = {
  en: { title: "Real-time epidemic surveillance for health organizations | HealthWatch Global", description: "Anticipate outbreaks before they reach your region. Live WHO data, real-time alerts, regional PDF reports — built for NGOs, health ministries and international organizations." },
  fr: { title: "Surveillance épidémique en temps réel pour les organisations de santé | HealthWatch Global", description: "Anticipez les épidémies avant qu'elles n'atteignent votre région. Données OMS en direct, alertes temps réel, rapports PDF régionaux — conçu pour les ONG, ministères de la santé et organisations internationales." },
  es: { title: "Vigilancia epidémica en tiempo real para organizaciones de salud | HealthWatch Global", description: "Anticipe los brotes antes de que lleguen a su región. Datos OMS en vivo, alertas en tiempo real, informes PDF regionales." },
  ar: { title: "مراقبة وبائية في الوقت الفعلي للمنظمات الصحية | HealthWatch Global", description: "استبق التفشيات قبل أن تصل إلى منطقتك. بيانات منظمة الصحة العالمية مباشرة، تنبيهات فورية، تقارير PDF إقليمية." },
  id: { title: "Pemantauan epidemi real-time untuk organisasi kesehatan | HealthWatch Global", description: "Antisipasi wabah sebelum mencapai wilayah Anda. Data WHO langsung, peringatan real-time, laporan PDF regional." },
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
    dateFrom:          fc.dateFrom,
    dateTo:            fc.dateTo,
    noResults:         fc.noResults,
    noData:            fc.noData,
    cfr:               fc.cfr,
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard label={t("activeOutbreaks")} value={stats.activeOutbreaks} icon={<Activity className="w-5 h-5" />} color="red" />
        <StatsCard label={t("countriesAffected")} value={stats.countriesAffected} icon={<Globe className="w-5 h-5" />} color="blue" />
        <StatsCard label={t("alertsToday")} value={stats.alertsToday} icon={<Bell className="w-5 h-5" />} color="orange" />
        <StatsCard label={t("highRisk")} value={stats.highRisk} icon={<AlertTriangle className="w-5 h-5" />} color="yellow" />
      </div>

      <WorldMap outbreaks={outbreaks} locale={locale} popupLabels={popupLabels} riskLabels={riskLabels} />

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
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "HealthWatch Global",
      "url": "https://healthwatch-global.com",
      "logo": "https://healthwatch-global.com/icon-512.png",
      "description": "Real-time global epidemic surveillance platform. WHO, CDC & ECDC data in 5 languages for health organizations worldwide.",
      "sameAs": [],
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "contact@healthwatch-global.com",
        "contactType": "customer support",
      },
    };
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
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

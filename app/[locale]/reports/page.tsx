import { getTranslations, getLocale } from "next-intl/server";
import { FileText, Lock } from "lucide-react";
import { getOutbreaks, getLocalizedDisease, getLocalizedCountry, dedupeAggregateOutbreakRows, magnitudeBand } from "@/lib/outbreaks";
import { MagnitudeDots } from "@/components/MagnitudeIndicator";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";
import { Suspense } from "react";
import ReportDownloadButton from "@/components/ReportDownloadButton";
import LockedUpgradeButton from "@/components/LockedUpgradeButton";
import CsvExportButton from "@/components/CsvExportButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

const REPORTS_META: Record<string, { title: string; description: string }> = {
  en: { title: "Epidemiological Reports", description: "Download regional epidemiological reports covering active outbreaks, case counts and risk levels by continent." },
  fr: { title: "Rapports épidémiologiques", description: "Téléchargez les rapports épidémiologiques régionaux couvrant les foyers actifs, le nombre de cas et les niveaux de risque par continent." },
  es: { title: "Informes epidemiológicos", description: "Descargue informes epidemiológicos regionales que cubren brotes activos, recuentos de casos y niveles de riesgo por continente." },
  ar: { title: "التقارير الوبائية", description: "قم بتنزيل التقارير الوبائية الإقليمية التي تغطي التفشيات النشطة وأعداد الحالات ومستويات الخطر حسب القارة." },
  id: { title: "Laporan Epidemiologi", description: "Unduh laporan epidemiologi regional yang mencakup wabah aktif, jumlah kasus, dan tingkat risiko per benua." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = REPORTS_META[locale] ?? REPORTS_META.en;
  const url = `https://healthwatch-global.com/${locale}/reports`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/reports`])),
        "x-default": "https://healthwatch-global.com/en/reports",
      },
    },
    openGraph: {
      type: "website",
      url,
      title: `${m.title} | HealthWatch Global`,
      description: m.description,
      siteName: "HealthWatch Global",
      locale: OG_LOCALE[locale] ?? "en_US",
      images: [
        {
          url: `https://healthwatch-global.com/api/og?locale=${locale}`,
          width: 1200,
          height: 630,
          alt: `${m.title} — HealthWatch Global`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${m.title} | HealthWatch Global`,
      description: m.description,
      images: [`https://healthwatch-global.com/api/og?locale=${locale}`],
    },
    robots: { index: true, follow: true },
  };
}

// Inline copy for paywall UI — avoids touching 5 message files
const PAYWALL_COPY: Record<string, { desc: string; descExpired: string; cta: string; lockedDownload: string; lockedList: string }> = {
  en: {
    desc: "Exact case counts and fatality rates reveal how fast each outbreak is evolving. Available on Pro — 7-day free trial, no credit card.",
    descExpired: "Your trial ended. Subscribe to Pro to get back access to exact case counts, fatality rates and PDF reports.",
    cta: "Unlock Pro →",
    lockedDownload: "Pro/Team — unlock to download",
    lockedList: "Pro/Team — unlock full list",
  },
  fr: {
    desc: "Les chiffres exacts et les taux de létalité révèlent la vitesse d'évolution de chaque foyer. Disponibles sur Pro — 7 jours gratuits, sans CB.",
    descExpired: "Votre essai est terminé. Abonnez-vous à Pro pour retrouver l'accès aux chiffres exacts, létalité et rapports PDF.",
    cta: "Débloquer Pro →",
    lockedDownload: "Pro/Team — débloquer le téléchargement",
    lockedList: "Pro/Team — voir la liste complète",
  },
  es: {
    desc: "Los datos exactos y la tasa de letalidad revelan la rapidez de evolución de cada brote. Disponibles en Pro — 7 días gratis, sin tarjeta.",
    descExpired: "Su prueba ha terminado. Suscríbase a Pro para recuperar el acceso a datos exactos, letalidad e informes PDF.",
    cta: "Desbloquear Pro →",
    lockedDownload: "Pro/Team — desbloquear descarga",
    lockedList: "Pro/Team — lista completa",
  },
  ar: {
    desc: "الأرقام الدقيقة ومعدلات الوفيات تكشف مدى سرعة تطور كل تفشٍّ. متاحة في Pro — 7 أيام مجاناً، بدون بطاقة.",
    descExpired: "انتهت فترة تجربتك. اشترك في Pro لاستعادة الوصول إلى الأرقام الدقيقة ومعدلات الوفيات وتنزيلات PDF.",
    cta: "← فتح Pro",
    lockedDownload: "Pro/Team — فتح التنزيل",
    lockedList: "Pro/Team — عرض القائمة الكاملة",
  },
  id: {
    desc: "Angka kasus dan tingkat fatalitas mengungkap seberapa cepat setiap wabah berkembang. Tersedia di Pro — 7 hari gratis, tanpa kartu.",
    descExpired: "Masa percobaan Anda telah berakhir. Berlangganan Pro untuk mendapatkan kembali akses ke angka kasus, tingkat fatalitas, dan laporan PDF.",
    cta: "Buka Pro →",
    lockedDownload: "Pro/Team — buka untuk mengunduh",
    lockedList: "Pro/Team — lihat daftar lengkap",
  },
};

const REGIONS = ["africa", "asia", "americas", "europe", "oceania"] as const;

async function ReportsContent() {
  const locale = await getLocale();
  const t = await getTranslations("reports");
  const tAlerts = await getTranslations("alerts");

  // ── Auth + plan check ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan = "free";
  let trialExpired = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, trial_ends_at, stripe_subscription_id")
      .eq("id", user.id)
      .single();
    plan = resolvedPlan(profile);
    trialExpired = (profile?.plan ?? "free") !== "free" && plan === "free";
  }

  const isPaid = plan === "starter" || plan === "pro" || plan === "team" || plan === "enterprise";
  const pc = PAYWALL_COPY[locale] ?? PAYWALL_COPY.en;

  const outbreaks = await getOutbreaks();
  const localeTag = locale === "ar" ? "ar-SA" : locale;
  const dateStr = new Date().toLocaleDateString(localeTag, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">

      {/* Upgrade banner — free users only */}
      {!isPaid && (
        <div className="rounded-xl border border-amber-700/40 bg-gradient-to-r from-amber-950/50 via-amber-900/20 to-transparent p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-amber-300">{trialExpired ? pc.descExpired : pc.desc}</p>
            </div>
            <LockedUpgradeButton feature="pdf" label={pc.cta} variant="banner" />
          </div>
        </div>
      )}

      {/* Toolbar — CSV / JSON export */}
      <div className="flex justify-end gap-2">
        <CsvExportButton isPaid={isPaid} locale={locale} format="csv" />
        <CsvExportButton isPaid={isPaid} locale={locale} format="json" />
      </div>

      {/* Report cards grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {REGIONS.map((region) => {
          // getOutbreaks() also returns recently-closed rows (60-day display grace
          // period for the full dashboard table) — wrong here: `activeOutbreaks`
          // below is rendered as-is under "Active outbreaks". Found 2026-08-02
          // alongside the identical bug in LandingPage.tsx.
          const regionOutbreaks = outbreaks.filter((o) => o.active && o.region === region);
          // Same dedup as the report route this card links to — otherwise a "Global" roll-up
          // row (Mpox, MERS-CoV...) inflates totalCases on top of its own country-level rows.
          // Found 2026-08-12, see dedupeAggregateOutbreakRows in lib/outbreaks.ts.
          const totalCases = dedupeAggregateOutbreakRows(regionOutbreaks).reduce((sum, o) => sum + o.cases, 0);
          const highRisk = regionOutbreaks.filter((o) => o.risk_level === "high").length;
          const regionLabel = tAlerts(region);

          const reportData = {
            region,
            regionLabel,
            date: dateStr,
            activeOutbreaks: regionOutbreaks.length,
            totalCases,
            highRisk,
            diseases: regionOutbreaks.map((o) => ({
              name: getLocalizedDisease(o, locale),
              country: getLocalizedCountry(o, locale),
              cases: o.cases,
              deaths: o.deaths,
              risk: o.risk_level,
            })),
          };

          return (
            <div
              key={region}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors"
            >
              {/* Card header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{regionLabel}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("generated")} {dateStr}
                  </p>
                </div>
                <ReportDownloadButton
                  data={reportData}
                  label={t("download")}
                  isPaid={isPaid}
                  locale={locale}
                  lockedLabel={pc.lockedDownload}
                  userId={user?.id}
                />
              </div>

              {/* Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>{t("activeCases")}</span>
                  <span className="text-white font-medium">{regionOutbreaks.length}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t("totalCases")}</span>
                  {isPaid ? (
                    <span className="text-white font-medium">{totalCases.toLocaleString(locale === "ar" ? "ar-SA" : locale)}</span>
                  ) : (
                    // A CSS blur over the real digits still ships them in the
                    // page's own HTML — extractable via curl/view-source
                    // exactly like the number it's meant to hide (found
                    // 2026-09-06, same leak class as maskOutbreakRow's own
                    // doc comment in lib/outbreaks.ts describes). The dot
                    // scale used everywhere else never carries a real number
                    // to begin with.
                    <MagnitudeDots band={magnitudeBand(totalCases)} />
                  )}
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t("highRiskAlerts")}</span>
                  {isPaid ? (
                    <span className="text-red-400 font-medium">{highRisk}</span>
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-gray-600" aria-label={pc.lockedList} />
                  )}
                </div>
              </div>

              {/* Outbreak list */}
              {regionOutbreaks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  {isPaid ? (
                    <div className="space-y-1">
                      {regionOutbreaks.map((o) => (
                        <a
                          key={o.id}
                          href={`/${locale}/outbreak/${o.id}`}
                          className="text-xs text-gray-400 flex justify-between hover:text-gray-200 transition-colors group"
                        >
                          <span className="group-hover:text-white transition-colors">{getLocalizedDisease(o, locale)}</span>
                          <span className={o.risk_level === "high" ? "text-red-400" : "text-yellow-400"}>
                            {getLocalizedCountry(o, locale)}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <LockedUpgradeButton feature="list" label={pc.lockedList} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function ReportsPage() {
  const t = await getTranslations("reports");
  const tDashboard = await getTranslations("dashboard");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <FileText className="text-red-500 w-8 h-8" />
          {t("title")}
        </h1>
        <p className="text-gray-400 mt-2">{t("subtitle")}</p>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3" />
            {tDashboard("loading")}
          </div>
        }
      >
        <ReportsContent />
      </Suspense>
    </div>
  );
}

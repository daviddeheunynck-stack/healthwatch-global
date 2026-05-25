import { getTranslations, getLocale } from "next-intl/server";
import { FileText, Lock } from "lucide-react";
import { getOutbreaks, getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { createClient } from "@/lib/supabase-server";
import { Suspense } from "react";
import Link from "next/link";
import ReportDownloadButton from "@/components/ReportDownloadButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

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
  return { title: m.title, description: m.description };
}

// Inline copy for paywall UI — avoids touching 5 message files
const PAYWALL_COPY: Record<string, { desc: string; cta: string; lockedDownload: string; lockedList: string }> = {
  en: {
    desc: "Case counts, deaths and PDF downloads are available on Starter and Pro plans.",
    cta: "See plans →",
    lockedDownload: "Upgrade to download",
    lockedList: "Upgrade to see full outbreak list",
  },
  fr: {
    desc: "Les chiffres de cas, décès et téléchargements PDF sont disponibles avec les plans Starter et Pro.",
    cta: "Voir les plans →",
    lockedDownload: "Passer à un plan supérieur",
    lockedList: "Passer à un plan supérieur pour voir la liste complète",
  },
  es: {
    desc: "Los recuentos de casos, fallecidos y descargas PDF están disponibles en los planes Starter y Pro.",
    cta: "Ver planes →",
    lockedDownload: "Mejorar para descargar",
    lockedList: "Mejorar para ver la lista completa",
  },
  ar: {
    desc: "أعداد الحالات والوفيات وتنزيلات PDF متاحة في خطط Starter وPro.",
    cta: "عرض الخطط →",
    lockedDownload: "ترقية للتنزيل",
    lockedList: "ترقية لرؤية القائمة الكاملة",
  },
  id: {
    desc: "Jumlah kasus, kematian, dan unduhan PDF tersedia di paket Starter dan Pro.",
    cta: "Lihat paket →",
    lockedDownload: "Upgrade untuk mengunduh",
    lockedList: "Upgrade untuk melihat daftar lengkap",
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
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    plan = profile?.plan ?? "free";
  }

  const isPaid = plan === "starter" || plan === "pro" || plan === "enterprise";
  const pc = PAYWALL_COPY[locale] ?? PAYWALL_COPY.en;

  const outbreaks = await getOutbreaks();
  const dateStr = new Date().toLocaleDateString(locale, {
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
              <p className="text-sm font-semibold text-amber-300">{pc.desc}</p>
            </div>
            <Link
              href={`/${locale}/pricing`}
              className="shrink-0 text-xs bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {pc.cta}
            </Link>
          </div>
        </div>
      )}

      {/* Report cards grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {REGIONS.map((region) => {
          const regionOutbreaks = outbreaks.filter((o) => o.region === region);
          const totalCases = regionOutbreaks.reduce((sum, o) => sum + o.cases, 0);
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
                    <span className="text-white font-medium">{totalCases.toLocaleString()}</span>
                  ) : (
                    <span className="blur-sm select-none text-gray-500 font-medium">
                      {totalCases.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t("highRiskAlerts")}</span>
                  {isPaid ? (
                    <span className="text-red-400 font-medium">{highRisk}</span>
                  ) : (
                    <span className="blur-sm select-none text-gray-500 font-medium">{highRisk}</span>
                  )}
                </div>
              </div>

              {/* Outbreak list */}
              {regionOutbreaks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  {isPaid ? (
                    <div className="space-y-1">
                      {regionOutbreaks.map((o) => (
                        <div key={o.id} className="text-xs text-gray-400 flex justify-between">
                          <span>{getLocalizedDisease(o, locale)}</span>
                          <span className={o.risk_level === "high" ? "text-red-400" : "text-yellow-400"}>
                            {getLocalizedCountry(o, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-600/80">
                      <Lock className="w-3 h-3 shrink-0" />
                      <Link href={`/${locale}/pricing`} className="hover:text-amber-400 transition-colors">
                        {pc.lockedList}
                      </Link>
                    </div>
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

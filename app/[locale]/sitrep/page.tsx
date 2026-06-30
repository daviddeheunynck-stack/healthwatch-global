import { getOutbreaks, getStats, getLocalizedDisease, getLocalizedCountry, sourceStatus } from "@/lib/outbreaks";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { wilsonCI } from "@/lib/cfr-ci";
import Link from "next/link";
import SitrepPrintButton from "@/components/SitrepPrintButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Situation Report", robots: { index: false, follow: false } };
}

const COPY: Record<string, {
  title: string; subtitle: string;
  active: string; highRisk: string; pheic: string; newWeek: string;
  disease: string; country: string; cases: string; deaths: string;
  cfr: string; ci95: string; risk: string; date: string; source: string;
  generated: string; disclaimer: string; noData: string; back: string;
  riskLabels: Record<string, string>;
  srcLabels: { don: string; official: string; unverified: string };
}> = {
  en: {
    title: "Weekly Epidemiological Situation Report",
    subtitle: "Active disease outbreaks — WHO, ECDC, PAHO & Africa CDC official sources",
    active: "Active outbreaks", highRisk: "High risk", pheic: "PHEIC", newWeek: "New this week",
    disease: "Disease", country: "Country", cases: "Cases", deaths: "Deaths",
    cfr: "CFR %", ci95: "95% CI", risk: "Risk", date: "Date", source: "Source",
    generated: "Generated", noData: "N/A", back: "Dashboard",
    disclaimer: "For information only. Always verify with official WHO and national health authority sources before operational decisions.",
    riskLabels: { high: "HIGH", medium: "MEDIUM", low: "LOW" },
    srcLabels: { don: "WHO DON", official: "Official", unverified: "Unverified" },
  },
  fr: {
    title: "Rapport de situation épidémiologique hebdomadaire",
    subtitle: "Foyers épidémiques actifs — sources officielles OMS, ECDC, PAHO & Africa CDC",
    active: "Foyers actifs", highRisk: "Risque élevé", pheic: "USPPI", newWeek: "Nouveaux cette semaine",
    disease: "Maladie", country: "Pays", cases: "Cas", deaths: "Décès",
    cfr: "Létalité %", ci95: "IC95%", risk: "Risque", date: "Date", source: "Source",
    generated: "Généré le", noData: "N/D", back: "Tableau de bord",
    disclaimer: "À titre informatif uniquement. Toujours vérifier avec les sources officielles OMS et autorités sanitaires avant toute décision opérationnelle.",
    riskLabels: { high: "ÉLEVÉ", medium: "MODÉRÉ", low: "FAIBLE" },
    srcLabels: { don: "WHO DON", official: "Officiel", unverified: "Non vérifié" },
  },
  es: {
    title: "Informe de situación epidemiológica semanal",
    subtitle: "Brotes activos — fuentes oficiales OMS, ECDC, PAHO & Africa CDC",
    active: "Brotes activos", highRisk: "Riesgo alto", pheic: "ESPII", newWeek: "Nuevos esta semana",
    disease: "Enfermedad", country: "País", cases: "Casos", deaths: "Fallecidos",
    cfr: "Letalidad %", ci95: "IC95%", risk: "Riesgo", date: "Fecha", source: "Fuente",
    generated: "Generado el", noData: "N/D", back: "Panel",
    disclaimer: "Solo para información. Verificar siempre con fuentes oficiales de la OMS antes de decisiones operativas.",
    riskLabels: { high: "ALTO", medium: "MEDIO", low: "BAJO" },
    srcLabels: { don: "WHO DON", official: "Oficial", unverified: "Sin verificar" },
  },
  ar: {
    title: "التقرير الأسبوعي للوضع الوبائي",
    subtitle: "تفشيات الأمراض النشطة — مصادر رسمية: WHO، ECDC، PAHO وAfrica CDC",
    active: "تفشيات نشطة", highRisk: "خطر عالٍ", pheic: "طوارئ دولية", newWeek: "جديد هذا الأسبوع",
    disease: "المرض", country: "الدولة", cases: "الحالات", deaths: "الوفيات",
    cfr: "معدل الوفيات %", ci95: "فترة ثقة 95%", risk: "المخاطر", date: "التاريخ", source: "المصدر",
    generated: "تم التوليد في", noData: "غ/م", back: "لوحة التحكم",
    disclaimer: "للمعلومات فقط. يُرجى التحقق من المصادر الرسمية قبل أي قرار تشغيلي.",
    riskLabels: { high: "مرتفع", medium: "متوسط", low: "منخفض" },
    srcLabels: { don: "WHO DON", official: "رسمي", unverified: "غير موثق" },
  },
  id: {
    title: "Laporan Situasi Epidemiologi Mingguan",
    subtitle: "Wabah penyakit aktif — sumber resmi WHO, ECDC, PAHO & Africa CDC",
    active: "Wabah aktif", highRisk: "Risiko tinggi", pheic: "KKMMD", newWeek: "Baru minggu ini",
    disease: "Penyakit", country: "Negara", cases: "Kasus", deaths: "Kematian",
    cfr: "CFR %", ci95: "IK 95%", risk: "Risiko", date: "Tanggal", source: "Sumber",
    generated: "Dibuat", noData: "T/S", back: "Dasbor",
    disclaimer: "Hanya untuk informasi. Selalu verifikasi dengan sumber resmi WHO sebelum keputusan operasional.",
    riskLabels: { high: "TINGGI", medium: "SEDANG", low: "RENDAH" },
    srcLabels: { don: "WHO DON", official: "Resmi", unverified: "Belum diverifikasi" },
  },
};

function srcKey(source?: string | null): "don" | "official" | "unverified" {
  const s = sourceStatus({ source } as Parameters<typeof sourceStatus>[0]);
  if (s === "don")      return "don";
  if (s === "official") return "official";
  return "unverified";
}

export default async function SitrepPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const outbreaks = await getOutbreaks();
    const stats     = getStats(outbreaks);
    const c         = COPY[locale] ?? COPY.en;
    const isRtl     = locale === "ar";
    const now       = new Date();
    const weekAgo   = new Date(now.getTime() - 7 * 86_400_000).toISOString().split("T")[0];
    const newWeek   = outbreaks.filter((o) => o.date >= weekAgo).length;
    const genDate   = now.toLocaleDateString(
      locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : locale === "ar" ? "ar-SA" : locale === "id" ? "id-ID" : "en-GB",
      { weekday: "long", year: "numeric", month: "long", day: "numeric" }
    );
    const preview = [...outbreaks]
      .sort((a, b) => {
        if (a.is_pheic && !b.is_pheic) return -1;
        if (!a.is_pheic && b.is_pheic) return 1;
        const r: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (r[a.risk_level] ?? 3) - (r[b.risk_level] ?? 3);
      })
      .slice(0, 5);

    const TC: Record<string, { headline: string; sub: string; pilot: string; trial: string; home: string; haveAccount: string; signIn: string }> = {
      en: { headline: "Full report — restricted access", sub: "14-day free trial or request institutional pilot access.", pilot: "Institutional pilot →", trial: "Free trial →", home: "Home", haveAccount: "Already have an account?", signIn: "Sign in" },
      fr: { headline: "Rapport complet — accès restreint", sub: "Essai gratuit 14 jours ou demandez un accès pilote institutionnel.", pilot: "Pilote institutionnel →", trial: "Essai gratuit →", home: "Accueil", haveAccount: "Déjà un compte ?", signIn: "Se connecter" },
      es: { headline: "Informe completo — acceso restringido", sub: "Prueba gratuita 14 días o solicite acceso piloto institucional.", pilot: "Piloto institucional →", trial: "Prueba gratuita →", home: "Inicio", haveAccount: "¿Ya tiene cuenta?", signIn: "Iniciar sesión" },
      ar: { headline: "التقرير الكامل — وصول مقيّد", sub: "تجربة مجانية 14 يوماً أو اطلب وصولاً تجريبياً مؤسسياً.", pilot: "← التجريبي المؤسسي", trial: "← تجربة مجانية", home: "الرئيسية", haveAccount: "لديك حساب؟", signIn: "تسجيل الدخول" },
      id: { headline: "Laporan lengkap — akses terbatas", sub: "Uji coba gratis 14 hari atau minta akses pilot institusional.", pilot: "Pilot institusional →", trial: "Uji coba gratis →", home: "Beranda", haveAccount: "Sudah punya akun?", signIn: "Masuk" },
    };
    const tc = TC[locale] ?? TC.en;

    return (
      <>
        <div className="flex items-center mb-6">
          <Link href={`/${locale}`} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← {tc.home}
          </Link>
        </div>

        <div dir={isRtl ? "rtl" : undefined} className="border-b-2 border-red-600 pb-4 mb-6">
          <p className="text-red-500 font-bold text-lg tracking-tight">HealthWatch Global</p>
          <h1 className="text-2xl font-bold text-white mt-1">{c.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{c.subtitle}</p>
          <p className="text-gray-600 text-xs mt-2">{c.generated} : {genDate}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: c.active,   value: stats.activeOutbreaks, color: "text-white" },
            { label: c.highRisk, value: stats.highRisk,        color: "text-red-400" },
            { label: c.pheic,    value: stats.pheicCount,      color: stats.pheicCount > 0 ? "text-purple-400" : "text-white" },
            { label: c.newWeek,  value: newWeek,               color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="border border-gray-800 rounded-xl px-4 py-3 bg-gray-900/40">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-800 overflow-x-auto mb-6">
          <table className="w-full text-xs min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-gray-900 text-gray-500 uppercase text-[10px] tracking-wide">
                <th className="text-left px-3 py-2">{c.disease}</th>
                <th className="text-left px-3 py-2">{c.country}</th>
                <th className="text-right px-3 py-2">{c.cases}</th>
                <th className="text-right px-3 py-2">{c.deaths}</th>
                <th className="text-right px-3 py-2">{c.cfr}</th>
                <th className="text-center px-3 py-2">{c.risk}</th>
                <th className="text-left px-3 py-2">{c.date}</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((o, i) => {
                const cfr    = o.cases > 0 && o.deaths !== null ? (o.deaths / o.cases * 100).toFixed(1) : null;
                const cfrNum = cfr ? parseFloat(cfr) : null;
                const cfrCls = cfrNum !== null && cfrNum > 10 ? "text-red-400 font-bold" :
                               cfrNum !== null && cfrNum > 3  ? "text-amber-400 font-semibold" : "text-gray-300";
                return (
                  <tr key={o.id} className={`border-t border-gray-800 ${i % 2 === 0 ? "bg-gray-900/20" : ""}`}>
                    <td className="px-3 py-2 font-medium text-white max-w-[180px]">
                      <span className="truncate block">{getLocalizedDisease(o, locale)}</span>
                      {o.is_pheic && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/50">{c.pheic}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-300 max-w-[130px]">
                      <span className="truncate block">{getLocalizedCountry(o, locale)}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {o.cases > 0 ? o.cases.toLocaleString() : <span className="text-gray-600">{c.noData}</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-red-400">
                      {o.deaths !== null && o.deaths > 0 ? o.deaths.toLocaleString() : <span className="text-gray-600">{c.noData}</span>}
                    </td>
                    <td className={`px-3 py-2 text-right ${cfrCls}`}>
                      {cfr ? `${cfr}%` : <span className="text-gray-600">{c.noData}</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        o.risk_level === "high"   ? "bg-red-900/40 border border-red-700/50 text-red-400"       :
                        o.risk_level === "medium" ? "bg-amber-900/30 border border-amber-700/40 text-amber-400" :
                                                    "bg-green-900/30 border border-green-700/40 text-green-400"
                      }`}>
                        {c.riskLabels[o.risk_level] ?? o.risk_level?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{o.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center mx-auto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{tc.headline}</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">{tc.sub}</p>
          </div>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href={`/${locale}/pilot`} className="px-5 py-2.5 text-sm font-semibold text-amber-400 border border-amber-500/40 rounded-lg hover:border-amber-400/70 transition-colors">
              {tc.pilot}
            </Link>
            <Link href={`/${locale}/signup`} className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors">
              {tc.trial}
            </Link>
          </div>
          <p className="text-xs text-gray-600">
            {tc.haveAccount}{" "}
            <Link href={`/${locale}/login`} className="text-gray-400 hover:text-white underline">
              {tc.signIn}
            </Link>
          </p>
        </div>
      </>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  let plan = profile?.plan ?? "free";
  if (
    profile?.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() < Date.now() &&
    !profile?.stripe_subscription_id
  ) plan = "free";

  const isPaid = ["starter", "pro", "team", "enterprise"].includes(plan);
  if (!isPaid) redirect(`/${locale}`);

  const outbreaks = await getOutbreaks();
  const stats     = getStats(outbreaks);
  const c         = COPY[locale] ?? COPY.en;

  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7 * 86_400_000).toISOString().split("T")[0];
  const newWeek  = outbreaks.filter((o) => o.date >= weekAgo).length;
  const isRtl    = locale === "ar";
  const genDate  = now.toLocaleDateString(
    locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : locale === "ar" ? "ar-SA" : locale === "id" ? "id-ID" : "en-GB",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  const sorted = [...outbreaks].sort((a, b) => {
    if (a.is_pheic && !b.is_pheic) return -1;
    if (!a.is_pheic && b.is_pheic) return 1;
    const r: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (r[a.risk_level] ?? 3) - (r[b.risk_level] ?? 3);
  });


  return (
    <>
      {/* Print CSS — hides layout chrome, resets colors */}
      <style>{`
        @media print {
          nav, footer, [class*="phlaunch"], [class*="PHLaunch"],
          [class*="cookie"], [class*="Cookie"],
          [class*="banner"], [class*="Banner"],
          .no-print { display: none !important; }
          body { background: #fff !important; color: #111 !important; }
          main { max-width: none !important; padding: 8mm !important; margin: 0 !important; }
          @page { margin: 12mm; size: A4 landscape; }
          table { font-size: 9pt; }
          th, td { padding: 3pt 5pt; }
        }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print flex items-center justify-between mb-6 gap-3 flex-wrap">
        <Link
          href={`/${locale}`}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          ← {c.back}
        </Link>
        <SitrepPrintButton locale={locale} />
      </div>

      {/* ── Report header ───────────────────────────────────────────────── */}
      <div
        dir={isRtl ? "rtl" : undefined}
        className="border-b-2 border-red-600 pb-4 mb-6"
      >
        <p className="text-red-500 font-bold text-lg tracking-tight">HealthWatch Global</p>
        <h1 className="text-2xl font-bold text-white mt-1">{c.title}</h1>
        <p className="text-gray-400 text-sm mt-1">{c.subtitle}</p>
        <p className="text-gray-600 text-xs mt-2">{c.generated} : {genDate}</p>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: c.active,    value: stats.activeOutbreaks,   color: "text-white"     },
          { label: c.highRisk,  value: stats.highRisk,          color: "text-red-400"   },
          { label: c.pheic,     value: stats.pheicCount,        color: stats.pheicCount > 0 ? "text-purple-400" : "text-white" },
          { label: c.newWeek,   value: newWeek,                 color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="border border-gray-800 rounded-xl px-4 py-3 bg-gray-900/40">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 overflow-x-auto mb-6">
        <table className="w-full text-xs min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-gray-900 text-gray-500 uppercase text-[10px] tracking-wide">
              <th className="text-left px-3 py-2">{c.disease}</th>
              <th className="text-left px-3 py-2">{c.country}</th>
              <th className="text-right px-3 py-2">{c.cases}</th>
              <th className="text-right px-3 py-2">{c.deaths}</th>
              <th className="text-right px-3 py-2">{c.cfr}</th>
              <th className="text-center px-3 py-2">{c.ci95}</th>
              <th className="text-center px-3 py-2">{c.risk}</th>
              <th className="text-left px-3 py-2">{c.date}</th>
              <th className="text-left px-3 py-2">{c.source}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o, i) => {
              const cfr    = o.cases > 0 && o.deaths !== null ? (o.deaths / o.cases * 100).toFixed(1) : null;
              const ci     = wilsonCI(o.deaths, o.cases);
              const cfrNum = cfr ? parseFloat(cfr) : null;
              const cfrCls = cfrNum !== null && cfrNum > 10 ? "text-red-400 font-bold" :
                             cfrNum !== null && cfrNum > 3  ? "text-amber-400 font-semibold" :
                                                              "text-gray-300";
              const src = srcKey(o.source);
              return (
                <tr
                  key={o.id}
                  className={`border-t border-gray-800 ${i % 2 === 0 ? "bg-gray-900/20" : ""}`}
                >
                  <td className="px-3 py-2 font-medium text-white max-w-[200px]">
                    <Link
                      href={`/${locale}/outbreak/${o.id}`}
                      className="truncate block hover:text-red-300 transition-colors"
                    >
                      {getLocalizedDisease(o, locale)}
                    </Link>
                    {o.is_pheic && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/50 ml-1">{c.pheic}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-300 max-w-[140px]">
                    <span className="truncate block">{getLocalizedCountry(o, locale)}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">
                    {o.cases > 0 ? o.cases.toLocaleString(locale === "ar" ? "ar-SA" : locale) : <span className="text-gray-600">{c.noData}</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400">
                    {o.deaths !== null ? o.deaths.toLocaleString(locale === "ar" ? "ar-SA" : locale) : <span className="text-gray-600">{c.noData}</span>}
                  </td>
                  <td className={`px-3 py-2 text-right ${cfrCls}`}>
                    {cfr ? `${cfr}%` : <span className="text-gray-600">{c.noData}</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                    {ci ? `[${ci[0]}–${ci[1]}%]` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      o.risk_level === "high"   ? "bg-red-900/40 border border-red-700/50 text-red-400"    :
                      o.risk_level === "medium" ? "bg-amber-900/30 border border-amber-700/40 text-amber-400" :
                                                  "bg-green-900/30 border border-green-700/40 text-green-400"
                    }`}>
                      {c.riskLabels[o.risk_level] ?? o.risk_level.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{o.date}</td>
                  <td className={`px-3 py-2 whitespace-nowrap ${
                    src === "don"      ? "text-blue-400"   :
                    src === "official" ? "text-amber-400"  :
                                        "text-gray-600"
                  }`}>
                    {c.srcLabels[src]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-800 pt-4 text-xs text-gray-600 space-y-1">
        <p>HealthWatch Global — healthwatch-global.com · {c.generated} : {genDate}</p>
        <p>{c.disclaimer}</p>
      </div>
    </>
  );
}

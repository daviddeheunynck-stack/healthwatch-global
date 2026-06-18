"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { track } from "@vercel/analytics/react";
import { X, FileText, Radio, List, BarChart2, TableProperties, ArrowLeftRight, Zap, CheckCircle } from "lucide-react";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import type { UpgradeFeature } from "@/lib/upgrade-modal-context";

// ─── Copy ─────────────────────────────────────────────────────────────────────

type FeatureCopy = { title: string; desc: string; plan: string };

const COPY: Record<string, {
  pdf: FeatureCopy;
  realtime: FeatureCopy;
  list: FeatureCopy;
  cases: FeatureCopy;
  csv: FeatureCopy;
  compare: FeatureCopy;
  proFeatures: string[];
  cta: string;
  ctaExpired: string;
  trial: string;
  trialExpired: string;
}> = {
  fr: {
    pdf:      { title: "Rapports PDF régionaux",      desc: "Téléchargez des rapports épidémiologiques prêts à partager avec vos équipes ou bailleurs.",   plan: "Disponible — Pro" },
    realtime: { title: "Alertes instantanées",        desc: "Notification instantanée dès que notre synchronisation (toutes les 6h) détecte un nouveau foyer OMS.", plan: "Disponible — Pro uniquement" },
    list:     { title: "Liste complète des foyers",   desc: "Accédez à tous les foyers actifs par région avec chiffres exacts.",                            plan: "Disponible — Pro" },
    cases:    { title: "Chiffres confirmés",          desc: "Cas confirmés, décès et détails épidémiologiques complets pour chaque foyer.",                 plan: "Disponible — Pro" },
    csv:      { title: "Export CSV des données",      desc: "Téléchargez l'ensemble des foyers actifs en CSV pour Excel, R, Python ou vos outils internes.", plan: "Disponible — Pro" },
    compare:  { title: "Comparateur de foyers chiffré", desc: "Comparez cas, décès, létalité et incidence entre deux épidémies, foyer par foyer.",            plan: "Disponible — Pro" },
    proFeatures: [
      "Alertes instantanées — OMS, ECDC, PAHO & Africa CDC, toutes les 6h",
      "Rapports PDF par région en 1 clic",
      "Export CSV pour vos analyses internes",
      "Toutes les régions mondiales couvertes",
    ],
    cta:         "Commencer l'essai gratuit",
    ctaExpired:  "S'abonner à Pro →",
    trial:       "14 jours gratuits · Sans carte bancaire",
    trialExpired:"À partir de 29 €/mois ou 249 €/an",
  },
  en: {
    pdf:      { title: "Regional PDF reports",     desc: "Download shareable epidemiological reports ready for your teams or donors.",             plan: "Available — Pro" },
    realtime: { title: "Instant alerts",           desc: "Get notified within hours the moment our WHO, ECDC, PAHO & Africa CDC sync (every 6h) detects a new outbreak.", plan: "Available — Pro only" },
    list:     { title: "Full outbreak list",       desc: "Access all active outbreaks per region with exact case and death figures.",              plan: "Available — Pro" },
    cases:    { title: "Confirmed figures",        desc: "Confirmed cases, deaths and full epidemiological details for every outbreak.",           plan: "Available — Pro" },
    csv:      { title: "CSV data export",          desc: "Download all active outbreaks as CSV for Excel, R, Python or your internal tools.",      plan: "Available — Pro" },
    compare:  { title: "Outbreak data comparison", desc: "Compare cases, deaths, fatality rate and incidence between two epidemics, side by side.", plan: "Available — Pro" },
    proFeatures: [
      "Instant alerts — WHO, ECDC, PAHO & Africa CDC",
      "Regional PDF reports in 1 click",
      "CSV export for your internal analyses",
      "All global regions covered",
    ],
    cta:         "Start free trial",
    ctaExpired:  "Subscribe to Pro →",
    trial:       "14 days free · No credit card",
    trialExpired:"From €29/month or €249/year",
  },
  es: {
    pdf:      { title: "Informes PDF regionales",     desc: "Descargue informes epidemiológicos listos para compartir con su equipo o financiadores.",    plan: "Disponible — Pro" },
    realtime: { title: "Alertas instantáneas",        desc: "Reciba una notificación en horas, en cuanto nuestra sincronización cada 6h detecte un nuevo brote de la OMS.", plan: "Disponible — solo Pro" },
    list:     { title: "Lista completa de brotes",    desc: "Acceda a todos los brotes activos por región con cifras exactas.",                           plan: "Disponible — Pro" },
    cases:    { title: "Cifras confirmadas",          desc: "Casos confirmados, fallecidos y detalles epidemiológicos completos.",                         plan: "Disponible — Pro" },
    csv:      { title: "Exportación de datos CSV",    desc: "Descargue todos los brotes activos en CSV para Excel, R, Python o sus herramientas internas.", plan: "Disponible — Pro" },
    compare:  { title: "Comparador de brotes con cifras", desc: "Compare casos, muertes, letalidad e incidencia entre dos epidemias, lado a lado.",            plan: "Disponible — Pro" },
    proFeatures: [
      "Alertas instantáneas — sincronizadas cada 6h desde la OMS",
      "Informes PDF regionales en 1 clic",
      "Exportación CSV para análisis internos",
      "Todas las regiones globales cubiertas",
    ],
    cta:         "Iniciar prueba gratuita",
    ctaExpired:  "Suscribirse a Pro →",
    trial:       "14 días gratis · Sin tarjeta",
    trialExpired:"Desde 29 €/mes o 249 €/año",
  },
  ar: {
    pdf:      { title: "تقارير PDF إقليمية",           desc: "حمّل تقارير وبائية جاهزة للمشاركة مع فرقك أو المموّلين بنقرة واحدة.",            plan: "متاح — Pro" },
    realtime: { title: "تنبيهات فورية",                desc: "احصل على إشعار في غضون ساعات بمجرد أن تكتشف مزامنتنا (كل 6 ساعات) تفشّياً جديداً من WHO أو ECDC أو PAHO أو Africa CDC.", plan: "متاح — Pro فقط" },
    list:     { title: "قائمة كاملة بالتفشيات",        desc: "اطلع على جميع التفشيات النشطة بالمنطقة مع الأرقام الدقيقة.",                   plan: "متاح — Pro" },
    cases:    { title: "الأرقام المؤكدة",              desc: "الحالات المؤكدة والوفيات والتفاصيل الوبائية الكاملة لكل تفشٍّ.",                plan: "متاح — Pro" },
    csv:      { title: "تصدير بيانات CSV",             desc: "حمّل جميع التفشيات النشطة بصيغة CSV لـ Excel أو R أو Python أو أدواتك الداخلية.", plan: "متاح — Pro" },
    compare:  { title: "مقارنة بيانات التفشيات",         desc: "قارن الحالات والوفيات ومعدل الفتك ومعدل الإصابة بين وباءين جنباً إلى جنب.",        plan: "متاح — Pro" },
    proFeatures: [
      "تنبيهات فورية — WHO وECDC وPAHO وAfrica CDC",
      "تقارير PDF إقليمية بنقرة واحدة",
      "تصدير CSV للتحليلات الداخلية",
      "جميع المناطق العالمية مشمولة",
    ],
    cta:         "ابدأ التجربة المجانية",
    ctaExpired:  "اشترك في Pro ←",
    trial:       "14 يوماً مجاناً · بدون بطاقة بنكية",
    trialExpired:"من 29 €/شهر أو 249 €/سنة",
  },
  id: {
    pdf:      { title: "Laporan PDF regional",        desc: "Unduh laporan epidemiologi siap dibagikan ke tim atau donor Anda.",                      plan: "Tersedia — Pro" },
    realtime: { title: "Peringatan instan",           desc: "Dapatkan notifikasi dalam hitungan jam begitu sinkronisasi 6 jam kami mendeteksi wabah baru dari WHO, ECDC, PAHO atau Africa CDC.", plan: "Tersedia — Pro saja" },
    list:     { title: "Daftar wabah lengkap",        desc: "Akses semua wabah aktif per wilayah dengan angka kasus dan kematian yang tepat.",        plan: "Tersedia — Pro" },
    cases:    { title: "Angka terkonfirmasi",         desc: "Kasus terkonfirmasi, kematian, dan detail epidemiologi lengkap setiap wabah.",           plan: "Tersedia — Pro" },
    csv:      { title: "Ekspor data CSV",             desc: "Unduh semua wabah aktif sebagai CSV untuk Excel, R, Python, atau alat internal Anda.",   plan: "Tersedia — Pro" },
    compare:  { title: "Perbandingan data wabah",     desc: "Bandingkan kasus, kematian, tingkat fatalitas, dan insidensi antara dua epidemi secara berdampingan.", plan: "Tersedia — Pro" },
    proFeatures: [
      "Peringatan instan — WHO, ECDC, PAHO & Africa CDC",
      "Laporan PDF regional dalam 1 klik",
      "Ekspor CSV untuk analisis internal",
      "Semua wilayah global tercakup",
    ],
    cta:         "Mulai uji coba gratis",
    ctaExpired:  "Berlangganan Pro →",
    trial:       "14 hari gratis · Tanpa kartu kredit",
    trialExpired:"Mulai €29/bulan atau €249/tahun",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FEATURE_CONFIG: Record<UpgradeFeature, {
  Icon: React.ComponentType<{ className?: string }>;
  ring: string;
  iconColor: string;
  bg: string;
}> = {
  pdf:      { Icon: FileText,         ring: "border-purple-500/30", iconColor: "text-purple-400", bg: "bg-purple-500/10" },
  realtime: { Icon: Radio,            ring: "border-red-500/30",    iconColor: "text-red-400",    bg: "bg-red-500/10"    },
  list:     { Icon: List,             ring: "border-blue-500/30",   iconColor: "text-blue-400",   bg: "bg-blue-500/10"   },
  cases:    { Icon: BarChart2,        ring: "border-yellow-500/30", iconColor: "text-yellow-400", bg: "bg-yellow-500/10" },
  csv:      { Icon: TableProperties,  ring: "border-green-500/30",  iconColor: "text-green-400",  bg: "bg-green-500/10"  },
  compare:  { Icon: ArrowLeftRight,   ring: "border-cyan-500/30",   iconColor: "text-cyan-400",   bg: "bg-cyan-500/10"   },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  feature: UpgradeFeature;
  onClose: () => void;
}

export default function UpgradeModal({ feature, onClose }: Props) {
  const locale = useLocale();
  const c = COPY[locale] ?? COPY.en;
  const feat = c[feature];
  const { Icon, ring, iconColor, bg } = FEATURE_CONFIG[feature];

  const [trialExpired, setTrialExpired] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single()
        .then(({ data }) => {
          if (data?.plan !== "free" && data?.trial_ends_at && new Date(data.trial_ends_at).getTime() < Date.now() && !data?.stripe_subscription_id) {
            setTrialExpired(true);
          }
        });
    });
  }, []);

  // Track modal open
  useEffect(() => {
    track("upgrade_modal_open", { feature, locale });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-2xl p-7 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Feature icon + title */}
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-xl border ${ring} ${bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg leading-snug">{feat.title}</h2>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">{feat.desc}</p>
          </div>
        </div>

        {/* Plan badge */}
        <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border border-amber-700/30 rounded-lg">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300 font-medium">{feat.plan}</span>
        </div>

        {/* What's unlocked */}
        <ul className="space-y-2.5 mb-7">
          {c.proFeatures.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA — direct checkout, no pricing page friction */}
        <div onClick={() => { track("upgrade_modal_cta", { feature, locale }); onClose(); }}>
          <CheckoutButton
            plan="pro"
            locale={locale}
            label={trialExpired ? c.ctaExpired : c.cta}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-900/30 text-sm"
          />
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">{trialExpired ? c.trialExpired : c.trial}</p>
        <p className="text-center">
          <Link
            href={`/${locale}/pricing`}
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-400 underline underline-offset-2"
          >
            {locale === "fr" ? "Voir tous les plans →" : locale === "es" ? "Ver todos los planes →" : locale === "ar" ? "← عرض جميع الخطط" : locale === "id" ? "Lihat semua paket →" : "See all plans →"}
          </Link>
        </p>
      </div>
    </div>
  );
}

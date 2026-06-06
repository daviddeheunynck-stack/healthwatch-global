"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { track } from "@vercel/analytics/react";
import { X, FileText, Radio, List, BarChart2, TableProperties, Zap, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";
import type { UpgradeFeature } from "@/lib/upgrade-modal-context";

// ─── Copy ─────────────────────────────────────────────────────────────────────

type FeatureCopy = { title: string; desc: string; plan: string };

const COPY: Record<string, {
  pdf: FeatureCopy;
  realtime: FeatureCopy;
  list: FeatureCopy;
  cases: FeatureCopy;
  csv: FeatureCopy;
  proFeatures: string[];
  cta: string;
  trial: string;
}> = {
  fr: {
    pdf:      { title: "Rapports PDF régionaux",      desc: "Téléchargez des rapports épidémiologiques prêts à partager avec vos équipes ou bailleurs.",   plan: "Disponible — Pro" },
    realtime: { title: "Alertes en temps réel",       desc: "Recevez chaque nouveau foyer OMS en quelques secondes, avant tout le monde.",                  plan: "Disponible — Pro uniquement" },
    list:     { title: "Liste complète des foyers",   desc: "Accédez à tous les foyers actifs par région avec chiffres exacts.",                            plan: "Disponible — Pro" },
    cases:    { title: "Chiffres confirmés",          desc: "Cas confirmés, décès et détails épidémiologiques complets pour chaque foyer.",                 plan: "Disponible — Pro" },
    csv:      { title: "Export CSV des données",      desc: "Téléchargez l'ensemble des foyers actifs en CSV pour Excel, R, Python ou vos outils internes.", plan: "Disponible — Pro" },
    proFeatures: [
      "Alertes temps réel — flux OMS direct",
      "Rapports PDF par région en 1 clic",
      "Export CSV pour vos analyses internes",
      "Toutes les régions mondiales couvertes",
    ],
    cta:   "Voir les offres",
    trial: "Essai Pro 14 jours · Sans carte bancaire",
  },
  en: {
    pdf:      { title: "Regional PDF reports",     desc: "Download shareable epidemiological reports ready for your teams or donors.",             plan: "Available — Pro" },
    realtime: { title: "Real-time alerts",         desc: "Receive every new WHO outbreak in seconds — before anyone else.",                        plan: "Available — Pro only" },
    list:     { title: "Full outbreak list",       desc: "Access all active outbreaks per region with exact case and death figures.",              plan: "Available — Pro" },
    cases:    { title: "Confirmed figures",        desc: "Confirmed cases, deaths and full epidemiological details for every outbreak.",           plan: "Available — Pro" },
    csv:      { title: "CSV data export",          desc: "Download all active outbreaks as CSV for Excel, R, Python or your internal tools.",      plan: "Available — Pro" },
    proFeatures: [
      "Real-time alerts — direct WHO feed",
      "Regional PDF reports in 1 click",
      "CSV export for your internal analyses",
      "All global regions covered",
    ],
    cta:   "See plans",
    trial: "14-day Pro trial · No credit card",
  },
  es: {
    pdf:      { title: "Informes PDF regionales",     desc: "Descargue informes epidemiológicos listos para compartir con su equipo o financiadores.",    plan: "Disponible — Pro" },
    realtime: { title: "Alertas en tiempo real",      desc: "Reciba cada nuevo brote de la OMS en segundos, antes que nadie.",                            plan: "Disponible — solo Pro" },
    list:     { title: "Lista completa de brotes",    desc: "Acceda a todos los brotes activos por región con cifras exactas.",                           plan: "Disponible — Pro" },
    cases:    { title: "Cifras confirmadas",          desc: "Casos confirmados, fallecidos y detalles epidemiológicos completos.",                         plan: "Disponible — Pro" },
    csv:      { title: "Exportación de datos CSV",    desc: "Descargue todos los brotes activos en CSV para Excel, R, Python o sus herramientas internas.", plan: "Disponible — Pro" },
    proFeatures: [
      "Alertas en tiempo real — flujo OMS directo",
      "Informes PDF regionales en 1 clic",
      "Exportación CSV para análisis internos",
      "Todas las regiones globales cubiertas",
    ],
    cta:   "Ver planes",
    trial: "Prueba Pro 14 días · Sin tarjeta",
  },
  ar: {
    pdf:      { title: "تقارير PDF إقليمية",           desc: "حمّل تقارير وبائية جاهزة للمشاركة مع فرقك أو المموّلين بنقرة واحدة.",            plan: "متاح — Pro" },
    realtime: { title: "تنبيهات فورية",                desc: "استقبل كل تفشٍّ جديد من منظمة الصحة العالمية في ثوانٍ، قبل الجميع.",             plan: "متاح — Pro فقط" },
    list:     { title: "قائمة كاملة بالتفشيات",        desc: "اطلع على جميع التفشيات النشطة بالمنطقة مع الأرقام الدقيقة.",                   plan: "متاح — Pro" },
    cases:    { title: "الأرقام المؤكدة",              desc: "الحالات المؤكدة والوفيات والتفاصيل الوبائية الكاملة لكل تفشٍّ.",                plan: "متاح — Pro" },
    csv:      { title: "تصدير بيانات CSV",             desc: "حمّل جميع التفشيات النشطة بصيغة CSV لـ Excel أو R أو Python أو أدواتك الداخلية.", plan: "متاح — Pro" },
    proFeatures: [
      "تنبيهات فورية — بث مباشر من المنظمة",
      "تقارير PDF إقليمية بنقرة واحدة",
      "تصدير CSV للتحليلات الداخلية",
      "جميع المناطق العالمية مشمولة",
    ],
    cta:   "عرض الخطط",
    trial: "تجربة Pro 14 يوماً · بدون بطاقة بنكية",
  },
  id: {
    pdf:      { title: "Laporan PDF regional",        desc: "Unduh laporan epidemiologi siap dibagikan ke tim atau donor Anda.",                      plan: "Tersedia — Pro" },
    realtime: { title: "Peringatan real-time",        desc: "Terima setiap wabah baru WHO dalam hitungan detik — lebih cepat dari siapapun.",         plan: "Tersedia — Pro saja" },
    list:     { title: "Daftar wabah lengkap",        desc: "Akses semua wabah aktif per wilayah dengan angka kasus dan kematian yang tepat.",        plan: "Tersedia — Pro" },
    cases:    { title: "Angka terkonfirmasi",         desc: "Kasus terkonfirmasi, kematian, dan detail epidemiologi lengkap setiap wabah.",           plan: "Tersedia — Pro" },
    csv:      { title: "Ekspor data CSV",             desc: "Unduh semua wabah aktif sebagai CSV untuk Excel, R, Python, atau alat internal Anda.",   plan: "Tersedia — Pro" },
    proFeatures: [
      "Peringatan real-time — feed WHO langsung",
      "Laporan PDF regional dalam 1 klik",
      "Ekspor CSV untuk analisis internal",
      "Semua wilayah global tercakup",
    ],
    cta:   "Lihat paket",
    trial: "Uji coba Pro 14 hari · Tanpa kartu kredit",
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

        {/* CTA */}
        <Link
          href={`/${locale}/pricing`}
          onClick={() => { track("upgrade_modal_cta", { feature, locale }); onClose(); }}
          className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-900/30 text-sm"
        >
          {c.cta}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-center text-xs text-gray-600 mt-3">{c.trial}</p>
      </div>
    </div>
  );
}

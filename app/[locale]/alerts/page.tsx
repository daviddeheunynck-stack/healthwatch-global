"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";
import { Bell, CheckCircle, Loader2, Info, Zap, Globe, FileDown } from "lucide-react";
import RealtimeAlertFeed from "@/components/RealtimeAlertFeed";
import CheckoutButton from "@/components/CheckoutButton";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { resolvedPlan } from "@/lib/resolved-plan";
import { PRICE_DISPLAY } from "@/lib/pricing";

const PRO_ALERT_LINK: Record<string, { label: string; sub: string; btn: string }> = {
  fr: {
    label: "Vos alertes Pro sont actives",
    sub: "Configurez vos régions et maladies surveillées dans les paramètres du compte.",
    btn: "Gérer mes alertes →",
  },
  en: {
    label: "Your Pro alerts are active",
    sub: "Configure your monitored regions and diseases in account settings.",
    btn: "Manage my alerts →",
  },
  es: {
    label: "Sus alertas Pro están activas",
    sub: "Configure sus regiones y enfermedades monitoreadas en los ajustes de cuenta.",
    btn: "Gestionar mis alertas →",
  },
  ar: {
    label: "تنبيهاتك Pro نشطة",
    sub: "قم بضبط المناطق والأمراض المراقبة في إعدادات الحساب.",
    btn: "← إدارة تنبيهاتي",
  },
  id: {
    label: "Peringatan Pro Anda aktif",
    sub: "Konfigurasikan wilayah dan penyakit yang dipantau di pengaturan akun.",
    btn: "Kelola peringatan saya →",
  },
};

const PRO_COPY: Record<string, {
  badge: string; title: string; sub: string;
  items: string[]; cta: string; ctaExpired: string;
  note: string; noteExpired: string;
  divider: string; freeLabel: string;
}> = {
  fr: {
    badge: "Pro",
    title: "Alertes régionales quotidiennes · Toutes les régions",
    sub: "Recevez un résumé quotidien dès qu'un nouveau foyer est signalé ou qu'un foyer existant s'aggrave, d'après l'OMS, l'ECDC, l'OPAS ou l'Africa CDC — pour chaque région du monde.",
    items: ["Alertes email quotidiennes (toutes régions)", "Rapports PDF automatiques", "Intégration Slack / Teams"],
    cta: "Commencer l'essai gratuit →",
    ctaExpired: "S'abonner à Pro →",
    note: "7 jours gratuits · carte requise, aucun débit avant la fin de l'essai",
    noteExpired: `À partir de ${PRICE_DISPLAY.fr.proMonthly}/mois ou ${PRICE_DISPLAY.fr.proAnnual}/an`,
    divider: "ou continuer avec l'offre gratuite",
    freeLabel: "Digest hebdomadaire gratuit — 1 région",
  },
  en: {
    badge: "Pro",
    title: "Daily regional alerts · All regions",
    sub: "Get a daily summary as soon as a new outbreak is reported or an existing one escalates, sourced from WHO, ECDC, PAHO or Africa CDC — for every region on earth.",
    items: ["Daily email alerts (all regions)", "Automatic PDF reports", "Slack / Teams integration"],
    cta: "Start free trial →",
    ctaExpired: "Subscribe to Pro →",
    note: "7 days free · card required, no charge until it ends",
    noteExpired: `From ${PRICE_DISPLAY.en_eur.proMonthly}/month or ${PRICE_DISPLAY.en_eur.proAnnual}/year`,
    divider: "or continue with the free plan",
    freeLabel: "Free weekly digest — 1 region",
  },
  es: {
    badge: "Pro",
    title: "Alertas regionales diarias · Todas las regiones",
    sub: "Reciba un resumen diario en cuanto se reporte un nuevo brote o uno existente se agrave, según la OMS, ECDC, PAHO o Africa CDC — en cualquier región del mundo.",
    items: ["Alertas email diarias (todas las regiones)", "Informes PDF automáticos", "Integración Slack / Teams"],
    cta: "Iniciar prueba gratuita →",
    ctaExpired: "Suscribirse a Pro →",
    note: "7 días gratis · tarjeta requerida, sin cobro hasta que termine",
    noteExpired: `Desde ${PRICE_DISPLAY.es.proMonthly}/mes o ${PRICE_DISPLAY.es.proAnnual}/año`,
    divider: "o continuar con el plan gratuito",
    freeLabel: "Digest semanal gratuito — 1 región",
  },
  ar: {
    badge: "Pro",
    title: "تنبيهات إقليمية يومية · جميع المناطق",
    sub: "احصل على ملخص يومي بمجرد الإبلاغ عن تفشٍّ جديد أو تفاقم تفشٍّ قائم، من WHO أو ECDC أو PAHO أو Africa CDC — في كل منطقة في العالم.",
    items: ["تنبيهات بريد إلكتروني يومية (جميع المناطق)", "تقارير PDF تلقائية", "تكامل Slack / Teams"],
    cta: "← ابدأ التجربة المجانية",
    ctaExpired: "← الاشتراك في Pro",
    note: "7 أيام مجاناً · البطاقة مطلوبة، لا خصم قبل انتهاء التجربة",
    noteExpired: `من ${PRICE_DISPLAY.ar.proMonthly}/شهر أو ${PRICE_DISPLAY.ar.proAnnual}/سنة`,
    divider: "أو تابع مع الخطة المجانية",
    freeLabel: "ملخص أسبوعي مجاني — منطقة واحدة",
  },
  id: {
    badge: "Pro",
    title: "Peringatan regional harian · Semua wilayah",
    sub: "Dapatkan ringkasan harian segera setelah wabah baru dilaporkan atau wabah yang ada memburuk, oleh WHO, ECDC, PAHO atau Africa CDC — di setiap wilayah di bumi.",
    items: ["Peringatan email harian (semua wilayah)", "Laporan PDF otomatis", "Integrasi Slack / Teams"],
    cta: "Mulai uji coba gratis →",
    ctaExpired: "Berlangganan Pro →",
    note: "7 hari gratis · kartu diperlukan, tidak ada tagihan sebelum berakhir",
    noteExpired: `Mulai dari ${PRICE_DISPLAY.id.proMonthly}/bulan atau ${PRICE_DISPLAY.id.proAnnual}/tahun`,
    divider: "atau lanjutkan dengan paket gratis",
    freeLabel: "Digest mingguan gratis — 1 wilayah",
  },
};

const REGIONS = ["allRegions", "africa", "asia", "europe", "americas", "oceania"] as const;

export default function AlertsPage() {
  const t = useTranslations("alerts");
  const locale = useLocale();
  const pc = PRO_COPY[locale] ?? PRO_COPY.en;
  const isRtl = locale === "ar";

  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("allRegions");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setPlan("free"); return; }
      supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single()
        .then(({ data }) => {
          const p = resolvedPlan(data);
          if ((data?.plan ?? "free") !== "free" && p === "free") setTrialExpired(true);
          setPlan(p);
        });
    });
  }, []);

  const isPaid = plan === "starter" || plan === "pro" || plan === "team" || plan === "enterprise";
  const pal = PRO_ALERT_LINK[locale] ?? PRO_ALERT_LINK.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, region, locale }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errorGeneric"));
        return;
      }

      setSubmitted(true);
      setEmail("");
    } catch {
      setError(t("errorServer"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8" dir={isRtl ? "rtl" : undefined}>
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Bell className="text-red-500 w-8 h-8 shrink-0" />
          {t("title")}
        </h1>
        <p className="text-gray-400 mt-2">{t("subtitle")}</p>
      </div>

      {/* ── Pro alert management link — Pro/Team/Enterprise users ─────── */}
      {isPaid && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-300">{pal.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{pal.sub}</p>
            </div>
          </div>
          <Link
            href={`/${locale}/account#regional-alerts`}
            className="shrink-0 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors whitespace-nowrap"
          >
            {pal.btn}
          </Link>
        </div>
      )}

      {/* ── Pro upsell — only for free users ───────────────────────────── */}
      {!isPaid && <div className="bg-gray-900 border-2 border-red-500/60 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">{pc.badge}</span>
          <Zap className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">{pc.title}</h2>
          <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">{pc.sub}</p>
        </div>
        <ul className="space-y-2">
          {[
            { icon: Zap,      text: pc.items[0] },
            { icon: FileDown, text: pc.items[1] },
            { icon: Globe,    text: pc.items[2] },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm text-gray-300">
              <Icon className="w-4 h-4 text-red-400 shrink-0" />
              {text}
            </li>
          ))}
        </ul>
        <CheckoutButton
          billing="monthly"
          plan="pro"
          locale={locale}
          label={trialExpired ? pc.ctaExpired : pc.cta}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/30 text-sm"
        />
        <p className="text-center text-xs text-gray-600">{trialExpired ? pc.noteExpired : pc.note}</p>
      </div>}

      {/* ── Divider — only between upsell and free form ─────────────────── */}
      {!isPaid && <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-xs text-gray-600">{pc.divider}</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>}

      {/* ── Free subscription form — hidden for paid users who already have instant alerts ── */}
      {!isPaid && <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          {pc.freeLabel}
        </p>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
          {submitted ? (
            <div className="flex flex-col items-center py-8 gap-3 text-green-400">
              <CheckCircle className="w-12 h-12" />
              <p className="text-lg font-medium">{t("success")}</p>
              <p className="text-sm text-gray-400">{t("checkEmail")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t("email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t("region")}</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  disabled={loading}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(r)}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("subscribe")}
              </button>
            </form>
          )}
        </div>
      </div>}

      <RealtimeAlertFeed />

      <div className="text-center text-xs text-gray-600">
        Sources : WHO · ECDC · PAHO · Africa CDC
      </div>
    </div>
  );
}

import { CheckCircle, Clock, Users, Shield, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const SUCCESS_TITLES: Record<string, string> = {
  en: "Subscription Confirmed",
  fr: "Abonnement confirmé",
  es: "Suscripción confirmada",
  ar: "تأكيد الاشتراك",
  id: "Langganan Dikonfirmasi",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: SUCCESS_TITLES[locale] ?? SUCCESS_TITLES.en,
    robots: { index: false, follow: false },
  };
}

const PLAN_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  starter:    { label: "Pro",         icon: <Shield className="w-5 h-5" />, color: "text-red-400 bg-red-500/10 border-red-500/30" },
  pro:        { label: "Pro",         icon: <Shield className="w-5 h-5" />, color: "text-red-400 bg-red-500/10 border-red-500/30" },
  team:       { label: "Team",        icon: <Users   className="w-5 h-5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  enterprise: { label: "Enterprise",  icon: <Zap    className="w-5 h-5" />, color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
};

type LocaleLabels = {
  trial:    { title: string; subtitle: string; note: string };
  paid:     { title: string; subtitle: string };
  planLabel: string;
  readyTitle: string;
  readyItems: string[];
  cta: string;
  setupAlerts: string;
  guarantee: string;
  retryNote: string;
};

const LABELS: Record<string, LocaleLabels> = {
  en: {
    trial: {
      title:    "Free trial activated!",
      subtitle: "Your 7-day Pro trial starts now.",
      note:     "No payment required. You'll be notified before the trial ends.",
    },
    paid: {
      title:    "Payment confirmed!",
      subtitle: "Your subscription is now active.",
    },
    planLabel:  "Your plan",
    readyTitle: "You now have access to:",
    readyItems: ["Exact case & death figures", "Full regional reports (PDF)", "Instant alerts", "All global regions", "Disease-specific alerts (Mpox, Ebola, Cholera...)"],
    cta:          "Go to dashboard →",
    setupAlerts:  "Configure your alert regions →",
    guarantee:    "14-day money-back guarantee — no questions asked.",
    retryNote:    "If your plan does not appear immediately, refresh the page in a few seconds.",
  },
  fr: {
    trial: {
      title:    "Essai gratuit activé !",
      subtitle: "Votre essai Pro de 7 jours commence maintenant.",
      note:     "Aucun paiement requis. Vous serez prévenu avant la fin de l'essai.",
    },
    paid: {
      title:    "Paiement confirmé !",
      subtitle: "Votre abonnement est maintenant actif.",
    },
    planLabel:  "Votre formule",
    readyTitle: "Vous avez maintenant accès à :",
    readyItems: ["Chiffres exacts (cas & décès)", "Rapports régionaux complets (PDF)", "Alertes instantanées", "Toutes les régions mondiales", "Alertes par maladie (Mpox, Ebola, Choléra...)"],
    cta:          "Aller au tableau de bord →",
    setupAlerts:  "Configurer vos régions d'alerte →",
    guarantee:    "Satisfait ou remboursé 14 jours — sans condition.",
    retryNote:    "Si votre plan n'apparaît pas immédiatement, rafraîchissez la page dans quelques secondes.",
  },
  es: {
    trial: {
      title:    "¡Prueba gratuita activada!",
      subtitle: "Su prueba Pro de 7 días comienza ahora.",
      note:     "Sin pago requerido. Se le notificará antes del fin de la prueba.",
    },
    paid: {
      title:    "¡Pago confirmado!",
      subtitle: "Su suscripción ya está activa.",
    },
    planLabel:  "Su plan",
    readyTitle: "Ahora tiene acceso a:",
    readyItems: ["Cifras exactas (casos y fallecimientos)", "Informes regionales completos (PDF)", "Alertas instantáneas", "Todas las regiones mundiales", "Alertas por enfermedad (Mpox, Ébola, Cólera...)"],
    cta:          "Ir al panel →",
    setupAlerts:  "Configurar sus regiones de alerta →",
    guarantee:    "Garantía de devolución 14 días — sin preguntas.",
    retryNote:    "Si su plan no aparece de inmediato, actualice la página en unos segundos.",
  },
  ar: {
    trial: {
      title:    "تم تفعيل التجربة المجانية!",
      subtitle: "تبدأ تجربتك المجانية لمدة 7 أيام الآن.",
      note:     "لا يلزم دفع أي مبلغ. ستُخطَر قبل انتهاء الفترة التجريبية.",
    },
    paid: {
      title:    "تم تأكيد الدفع!",
      subtitle: "اشتراكك نشط الآن.",
    },
    planLabel:  "خطتك",
    readyTitle: "يمكنك الآن الوصول إلى:",
    readyItems: ["أرقام دقيقة (الحالات والوفيات)", "تقارير إقليمية كاملة (PDF)", "تنبيهات فورية", "جميع المناطق العالمية", "تنبيهات خاصة بالأمراض (Mpox، إيبولا، كوليرا...)"],
    cta:          "→ الذهاب إلى لوحة التحكم",
    setupAlerts:  "← ضبط مناطق التنبيه",
    guarantee:    "ضمان استرداد الأموال خلال 14 يوماً — دون أسئلة.",
    retryNote:    "إذا لم تظهر خطتك فورًا، يرجى تحديث الصفحة بعد بضع ثوانٍ.",
  },
  id: {
    trial: {
      title:    "Uji coba gratis diaktifkan!",
      subtitle: "Uji coba Pro 7 hari Anda dimulai sekarang.",
      note:     "Tidak perlu pembayaran. Anda akan diberitahu sebelum masa uji coba berakhir.",
    },
    paid: {
      title:    "Pembayaran dikonfirmasi!",
      subtitle: "Langganan Anda sekarang aktif.",
    },
    planLabel:  "Paket Anda",
    readyTitle: "Anda sekarang memiliki akses ke:",
    readyItems: ["Angka tepat (kasus & kematian)", "Laporan regional lengkap (PDF)", "Peringatan instan", "Semua wilayah global", "Peringatan per penyakit (Mpox, Ebola, Kolera...)"],
    cta:          "Buka dasbor →",
    setupAlerts:  "Konfigurasikan wilayah peringatan Anda →",
    guarantee:    "Garansi uang kembali 14 hari — tanpa pertanyaan.",
    retryNote:    "Jika paket Anda tidak muncul segera, segarkan halaman dalam beberapa detik.",
  },
};

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

async function getSubscriptionStatus(sessionId: string): Promise<"trialing" | "active" | null> {
  try {
    const secretKey = clean(process.env.STRIPE_SECRET_KEY);
    if (!secretKey) return null;
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=subscription`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Stripe-Version": "2026-04-22.dahlia",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const session = await res.json();
    const sub = session.subscription;
    if (sub && typeof sub === "object") {
      return sub.status === "trialing" ? "trialing" : "active";
    }
    return null;
  } catch {
    return null;
  }
}

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale } = await params;
  const { session_id } = await searchParams;
  const l = LABELS[locale] ?? LABELS.en;

  // Read current plan from DB
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let plan = "pro"; // optimistic fallback before DB read
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    if (profile?.plan && profile.plan !== "free") plan = profile.plan;
  }

  // Determine trial vs paid — query Stripe if session_id is available.
  // Default to trialing: all our checkouts start with a 7-day free trial.
  let isTrial = true;
  if (session_id) {
    const status = await getSubscriptionStatus(session_id);
    if (status === "active")   isTrial = false;
    if (status === "trialing") isTrial = true;
    // null (error) → keep default (trial)
  }

  const title    = isTrial ? l.trial.title    : l.paid.title;
  const subtitle = isTrial ? l.trial.subtitle : l.paid.subtitle;
  const meta     = PLAN_META[plan] ?? PLAN_META.pro;
  const isRtl    = locale === "ar";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4" dir={isRtl ? "rtl" : undefined}>
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center border ${
              isTrial
                ? "bg-blue-500/10 border-blue-500/20"
                : "bg-green-500/10 border-green-500/20"
            }`}>
              {isTrial
                ? <Clock       className="w-10 h-10 text-blue-400" />
                : <CheckCircle className="w-10 h-10 text-green-400" />
              }
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="text-gray-400">{subtitle}</p>
        </div>

        {/* Trial note */}
        {isTrial && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-300 text-center">
            {l.trial.note}
          </div>
        )}

        {/* Plan badge + features */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{l.planLabel}</p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${meta.color}`}>
            {meta.icon}
            {meta.label}
          </div>
          <div className="pt-2 border-t border-gray-800">
            <p className="text-sm text-gray-400 mb-3">{l.readyTitle}</p>
            <ul className="space-y-2">
              {l.readyItems.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <ArrowRight className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={`/${locale}`}
          className="block w-full text-center bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {l.cta}
        </Link>

        <Link
          href={`/${locale}/account#regional-alerts`}
          className="block w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors py-1"
        >
          {l.setupAlerts}
        </Link>

        {!isTrial && (
          <p className="text-center text-xs text-gray-600">{l.guarantee}</p>
        )}
        <p className="text-center text-xs text-gray-600">{l.retryNote}</p>

      </div>
    </div>
  );
}

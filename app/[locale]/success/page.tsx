import { getTranslations, getLocale } from "next-intl/server";
import { CheckCircle, Zap, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscription Confirmed",
  robots: { index: false, follow: false },
};

const PLAN_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  // "starter" kept for backward compat (legacy subscriptions)
  starter: { label: "Pro",     icon: <Shield className="w-5 h-5" />, color: "text-red-400 bg-red-500/10 border-red-500/30" },
  pro:     { label: "Pro",     icon: <Shield className="w-5 h-5" />, color: "text-red-400 bg-red-500/10 border-red-500/30" },
  enterprise: { label: "Enterprise", icon: <Zap className="w-5 h-5" />, color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
};

const LABELS: Record<string, {
  title: string; subtitle: string; planLabel: string;
  readyTitle: string; readyItems: string[]; cta: string; retryNote: string;
}> = {
  en: {
    title: "Payment confirmed!",
    subtitle: "Your subscription is now active.",
    planLabel: "Your plan",
    readyTitle: "You now have access to:",
    readyItems: ["Exact case & death figures", "Full regional reports (PDF)", "Instant alerts", "All global regions"],
    cta: "Go to dashboard →",
    retryNote: "If your plan does not appear immediately, refresh the page in a few seconds.",
  },
  fr: {
    title: "Paiement confirmé !",
    subtitle: "Votre abonnement est maintenant actif.",
    planLabel: "Votre formule",
    readyTitle: "Vous avez maintenant accès à :",
    readyItems: ["Chiffres exacts (cas & décès)", "Rapports régionaux complets (PDF)", "Alertes instantanées", "Toutes les régions mondiales"],
    cta: "Aller au tableau de bord →",
    retryNote: "Si votre plan n'apparaît pas immédiatement, rafraîchissez la page dans quelques secondes.",
  },
  es: {
    title: "¡Pago confirmado!",
    subtitle: "Su suscripción ya está activa.",
    planLabel: "Su plan",
    readyTitle: "Ahora tiene acceso a:",
    readyItems: ["Cifras exactas (casos y fallecimientos)", "Informes regionales completos (PDF)", "Alertas instantáneas", "Todas las regiones mundiales"],
    cta: "Ir al panel →",
    retryNote: "Si su plan no aparece de inmediato, actualice la página en unos segundos.",
  },
  ar: {
    title: "تم تأكيد الدفع!",
    subtitle: "اشتراكك نشط الآن.",
    planLabel: "خطتك",
    readyTitle: "يمكنك الآن الوصول إلى:",
    readyItems: ["أرقام دقيقة (الحالات والوفيات)", "تقارير إقليمية كاملة (PDF)", "تنبيهات فورية", "جميع المناطق العالمية"],
    cta: "→ الذهاب إلى لوحة التحكم",
    retryNote: "إذا لم تظهر خطتك فورًا، يرجى تحديث الصفحة بعد بضع ثوانٍ.",
  },
  id: {
    title: "Pembayaran dikonfirmasi!",
    subtitle: "Langganan Anda sekarang aktif.",
    planLabel: "Paket Anda",
    readyTitle: "Anda sekarang memiliki akses ke:",
    readyItems: ["Angka tepat (kasus & kematian)", "Laporan regional lengkap (PDF)", "Peringatan instan", "Semua wilayah global"],
    cta: "Buka dasbor →",
    retryNote: "Jika paket Anda tidak muncul segera, segarkan halaman dalam beberapa detik.",
  },
};

export default async function SuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = LABELS[locale] ?? LABELS.en;
  const t = await getTranslations("success");

  // Read the current plan — the webhook may have already fired by the time the user lands here
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let plan = "pro"; // default optimistic assumption post-checkout (only Pro exists now)
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    if (profile?.plan && profile.plan !== "free") {
      plan = profile.plan;
    }
  }

  const meta = PLAN_META[plan] ?? PLAN_META.pro;
  const isRtl = locale === "ar";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4" dir={isRtl ? "rtl" : undefined}>
      <div className="w-full max-w-lg space-y-6">

        {/* Success header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">{l.title}</h1>
          <p className="text-gray-400">{l.subtitle}</p>
        </div>

        {/* Plan badge */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{l.planLabel}</p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${meta.color}`}>
            {meta.icon}
            {meta.label}
          </div>

          {/* Feature list */}
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

        {/* Race condition note */}
        <p className="text-center text-xs text-gray-600">{l.retryNote}</p>

      </div>
    </div>
  );
}

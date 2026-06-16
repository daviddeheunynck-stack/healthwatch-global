"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Activity, Loader2, CheckCircle, BarChart2, Bell, FileDown, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";

const VALUE_PROPS: Record<string, { trial: string; items: string[]; noCard: string; gdpr: string }> = {
  en: {
    trial: "14-day Pro trial included — no credit card",
    items: [
      "Exact case & death figures (Pro)",
      "Instant regional alerts (Pro)",
      "PDF reports & CSV export (Pro)",
    ],
    noCard: "No credit card required",
    gdpr: "GDPR compliant · Data never sold",
  },
  fr: {
    trial: "Essai Pro 14 jours inclus — sans carte bancaire",
    items: [
      "Chiffres exacts cas & décès (Pro)",
      "Alertes régionales instantanées (Pro)",
      "Rapports PDF & export CSV (Pro)",
    ],
    noCard: "Sans carte bancaire",
    gdpr: "Conforme RGPD · Données jamais revendues",
  },
  es: {
    trial: "Prueba Pro 14 días incluida — sin tarjeta",
    items: [
      "Cifras exactas de casos y fallecidos (Pro)",
      "Alertas regionales instantáneas (Pro)",
      "Informes PDF y exportación CSV (Pro)",
    ],
    noCard: "Sin tarjeta de crédito",
    gdpr: "Cumple GDPR · Datos nunca vendidos",
  },
  ar: {
    trial: "تجربة Pro 14 يوماً مجاناً — بدون بطاقة بنكية",
    items: [
      "أرقام دقيقة للحالات والوفيات (Pro)",
      "تنبيهات إقليمية فورية (Pro)",
      "تقارير PDF وتصدير CSV (Pro)",
    ],
    noCard: "لا حاجة لبطاقة ائتمانية",
    gdpr: "متوافق مع GDPR · بياناتك لن تُباع أبداً",
  },
  id: {
    trial: "Uji coba Pro 14 hari termasuk — tanpa kartu kredit",
    items: [
      "Angka kasus & kematian tepat (Pro)",
      "Peringatan regional instan (Pro)",
      "Laporan PDF & ekspor CSV (Pro)",
    ],
    noCard: "Tanpa kartu kredit",
    gdpr: "Sesuai GDPR · Data tidak pernah dijual",
  },
};

const ICONS = [BarChart2, Bell, FileDown];

export default function SignupPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const vp = VALUE_PROPS[locale] ?? VALUE_PROPS.en;
  const isRtl = locale === "ar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const userId = signUpData.user?.id;

    // Save locale to profile so all transactional emails use the right language
    if (userId) {
      supabase.from("profiles").update({ locale }).eq("id", userId).then(() => {});
    }

    // Fire welcome email — non-blocking
    fetch("/api/send-welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    }).catch(() => {});

    // When mailer_autoconfirm is ON, Supabase returns a session immediately —
    // the /auth/callback route is never called, so the trial must be activated here.
    // Redirect straight to the dashboard so the user doesn't see "check your email".
    if (signUpData.session && userId) {
      await fetch("/api/activate-trial", { method: "POST" }).catch(() => {});
      router.push(`/${locale}`);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center" dir={isRtl ? "rtl" : undefined}>

        {/* Left — value proposition */}
        <div className="space-y-6 hidden md:block">
          <div className="flex items-center gap-2.5">
            <Activity className="text-red-500 w-7 h-7 shrink-0" />
            <span className="font-bold text-white text-xl">HealthWatch Global</span>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-semibold text-green-400">{vp.trial}</span>
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              {t("signupTitle")}
            </h2>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              {vp.gdpr}
            </p>
          </div>

          <ul className="space-y-3">
            {vp.items.map((item, i) => {
              const Icon = ICONS[i];
              return (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-600/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-red-400" />
                  </div>
                  {item}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2 text-xs text-gray-600 pt-2">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            {vp.gdpr}
          </div>
        </div>

        {/* Right — form */}
        <div>
          {/* Mobile header */}
          <div className="text-center mb-6 md:hidden">
            <Activity className="text-red-500 w-9 h-9 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-white">{t("signupTitle")}</h1>
            <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5 mt-3">
              <Sparkles className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-semibold text-green-400">{vp.trial}</span>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            {success ? (
              <div className="flex flex-col items-center py-8 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{t("successSignup")}</p>
                  <p className="text-sm text-gray-400 mt-1">{t("checkEmailSignup")}</p>
                </div>
                <Link
                  href={`/${locale}/login`}
                  className="mt-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  {t("loginLink")} →
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-5">
                  <OAuthButtons locale={locale} />
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-800" />
                    <span className="text-xs text-gray-600">{t("or")}</span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>
                </div>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{t("email")}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                      placeholder="you@organization.org"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">{t("password")}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={8}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                      placeholder="••••••••"
                    />
                    <p className="text-xs text-gray-600 mt-1">{t("passwordHint")}</p>
                  </div>

                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t("signup")}
                  </button>
                </form>

                <div className="mt-5 space-y-3">
                  <p className="text-center text-xs text-gray-600 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    {vp.noCard} · {vp.gdpr}
                  </p>
                  <p className="text-center text-sm text-gray-500">
                    {t("alreadyHaveAccount")}{" "}
                    <Link href={`/${locale}/login`} className="text-red-400 hover:text-red-300 font-medium">
                      {t("loginLink")}
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

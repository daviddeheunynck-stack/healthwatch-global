"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { Activity, Loader2, CheckCircle, ShieldCheck, Globe, Bell, Lock } from "lucide-react";
import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";

const VALUE_PROPS: Record<string, { items: string[]; noCard: string; gdpr: string }> = {
  en: {
    items: [
      "Live WHO disease outbreak map",
      "Risk scoring per pathogen",
      "Weekly digest by region",
    ],
    noCard: "No credit card required",
    gdpr: "GDPR compliant · Data never sold",
  },
  fr: {
    items: [
      "Carte OMS des épidémies en direct",
      "Score de risque par pathogène",
      "Digest hebdomadaire par région",
    ],
    noCard: "Sans carte bancaire",
    gdpr: "Conforme RGPD · Données jamais revendues",
  },
  es: {
    items: [
      "Mapa OMS de brotes en vivo",
      "Puntuación de riesgo por patógeno",
      "Resumen semanal por región",
    ],
    noCard: "Sin tarjeta de crédito",
    gdpr: "Cumple GDPR · Datos nunca vendidos",
  },
  ar: {
    items: [
      "خريطة تفشي أمراض منظمة الصحة العالمية مباشرة",
      "تقييم المخاطر لكل مسبب مرض",
      "ملخص أسبوعي حسب المنطقة",
    ],
    noCard: "لا حاجة لبطاقة ائتمانية",
    gdpr: "متوافق مع GDPR · بياناتك لن تُباع أبداً",
  },
  id: {
    items: [
      "Peta wabah WHO secara langsung",
      "Penilaian risiko per patogen",
      "Digest mingguan per wilayah",
    ],
    noCard: "Tanpa kartu kredit",
    gdpr: "Sesuai GDPR · Data tidak pernah dijual",
  },
};

const ICONS = [Globe, ShieldCheck, Bell];

export default function SignupPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/${locale}` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Fire welcome email — non-blocking
    fetch("/api/send-welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    }).catch(() => {});

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
            <h2 className="text-2xl font-bold text-white leading-tight">
              {t("signupTitle")}
            </h2>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              {vp.noCard} — {vp.gdpr}
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
                    <span className="text-xs text-gray-600">ou</span>
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

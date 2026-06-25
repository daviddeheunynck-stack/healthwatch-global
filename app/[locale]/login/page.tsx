"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { track } from "@vercel/analytics/react";
import { Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";

const OAUTH_ERROR: Record<string, string> = {
  fr: "Connexion Google échouée. Vérifiez que le provider Google est activé dans Supabase.",
  en: "Google sign-in failed. Check that the Google provider is enabled in Supabase.",
  es: "Error con Google. Compruebe que el proveedor Google está activado en Supabase.",
  ar: "فشل تسجيل الدخول عبر Google. تحقق من تفعيل مزود Google في Supabase.",
  id: "Gagal masuk dengan Google. Periksa bahwa provider Google diaktifkan di Supabase.",
};

function OAuthErrorBanner({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const oauthFailed = searchParams.get("error") === "oauth";
  const oauthReason = searchParams.get("reason") ?? "";
  if (!oauthFailed) return null;
  return (
    <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 space-y-1">
      <p className="text-red-300 text-sm">{OAUTH_ERROR[locale] ?? OAUTH_ERROR.en}</p>
      {oauthReason && (
        <p className="text-red-400/70 text-xs font-mono">{oauthReason}</p>
      )}
    </div>
  );
}

function OAuthButtonsWithNext({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? searchParams.get("redirect");
  return <OAuthButtons locale={locale} context="login" redirectTo={next ?? undefined} />;
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    track("login_attempt", { method: "email", locale });

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(t("errorInvalid"));
      setLoading(false);
      return;
    }

    track("login_success", { method: "email", locale });
    const sp = new URLSearchParams(window.location.search);
    const redirectTo = sp.get("next") ?? sp.get("redirect");
    // Only follow relative redirects — reject external and protocol-relative URLs
    if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      // API routes (e.g. team invite accept) need a full page load, not client nav
      window.location.href = redirectTo;
    } else {
      router.push(`/${locale}`);
      router.refresh();
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Activity className="text-red-500 w-10 h-10 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">{t("loginTitle")}</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-5">
          <Suspense fallback={null}>
            <OAuthErrorBanner locale={locale} />
          </Suspense>
          <Suspense fallback={<OAuthButtons locale={locale} context="login" />}>
            <OAuthButtonsWithNext locale={locale} />
          </Suspense>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">{t("or")}</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-gray-400">{t("password")}</label>
                <Link
                  href={`/${locale}/forgot-password`}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("login")}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t("dontHaveAccount")}{" "}
            <Link href={`/${locale}/signup`} className="text-red-400 hover:text-red-300">
              {t("signupLink")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

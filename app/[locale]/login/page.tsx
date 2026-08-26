"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { track } from "@vercel/analytics/react";
import { Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";
import InstitutionalContactLink from "@/components/InstitutionalContactLink";

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

// A leading "/" is not enough to prove a redirect target is internal. The WHATWG
// URL parser treats "\" as "/" in special schemes, so "/\evil.com" passes a
// startsWith("/") && !startsWith("//") check yet resolves to https://evil.com —
// verified 2026-08-12 against Node's parser, which is the same spec browsers
// implement. Resolve against the real origin instead and keep the target only if
// the result is still same-origin. Call this from event handlers only: it reads
// window.location, which does not exist while this client component prerenders.
function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
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
  // Fallback for admin-invited users whose one-time magic link expired or was
  // burned by an email scanner prefetching it before the human clicked it —
  // see app/api/admin/invite/route.ts, which now emails this same code
  // (Supabase's native email_otp, returned alongside generateLink()) and
  // links here with ?otp=1&email=... . Not tied to the magiclink's own expiry:
  // the OTP is checked directly against Supabase via verifyOtp, no redirect hop.
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("otp") === "1") {
      setOtpMode(true);
      const prefillEmail = sp.get("email");
      if (prefillEmail) setEmail(prefillEmail);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    track("login_attempt", { method: "email", locale });

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Same gap as signup (see app/[locale]/signup/page.tsx): before this,
      // login_attempt/login_success were tracked but no failure ever was.
      // Domain only, never the full address.
      fetch("/api/track-auth-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: "login",
          method: "password",
          errorCode: error.code ?? "unknown",
          emailDomain: email.split("@")[1]?.toLowerCase() ?? null,
        }),
      }).catch(() => {});
      setError(t("errorInvalid"));
      setLoading(false);
      return;
    }

    track("login_success", { method: "email", locale });
    const sp = new URLSearchParams(window.location.search);
    // Only follow same-origin redirects — see safeInternalPath() above
    const redirectTo = safeInternalPath(sp.get("next") ?? sp.get("redirect"));
    if (redirectTo) {
      // API routes (e.g. team invite accept) need a full page load, not client nav
      window.location.href = redirectTo;
    } else {
      router.push(`/${locale}`);
      router.refresh();
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    track("login_attempt", { method: "otp", locale });

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "email" });

    if (error) {
      fetch("/api/track-auth-failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: "login",
          method: "otp",
          errorCode: error.code ?? "unknown",
          emailDomain: email.split("@")[1]?.toLowerCase() ?? null,
        }),
      }).catch(() => {});
      setError(t("otpInvalid"));
      setLoading(false);
      return;
    }

    track("login_success", { method: "otp", locale });
    const sp = new URLSearchParams(window.location.search);
    // Only follow same-origin redirects — see safeInternalPath() above
    const redirectTo = safeInternalPath(sp.get("next") ?? sp.get("redirect"));
    if (redirectTo) {
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
          {otpMode ? (
            <form onSubmit={handleOtpVerify} className="space-y-4">
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
                <label className="block text-sm text-gray-400 mb-1">{t("otpCodeLabel")}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  disabled={loading}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-center text-xl tracking-[0.5em] focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                  placeholder="000000"
                />
                <p className="text-xs text-gray-600 mt-1">{t("otpHint")}</p>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("otpSubmit")}
              </button>

              <button
                type="button"
                onClick={() => { setOtpMode(false); setError(""); }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                {t("otpBackToPassword")}
              </button>
            </form>
          ) : (
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
                <p className="text-xs text-gray-600 mt-1">{t("noPasswordHint")}</p>
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

              <button
                type="button"
                onClick={() => { setOtpMode(true); setError(""); }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                {t("otpToggle")}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            {t("dontHaveAccount")}{" "}
            <Link href={`/${locale}/signup`} className="text-red-400 hover:text-red-300">
              {t("signupLink")}
            </Link>
          </p>
          {/* 2026-08-26 : « sans carte bancaire » disait vrai de la creation de
              compte et faux de l'abonnement. Depuis le 19/08, le checkout
              collecte toujours la carte (payment_method_collection: "always"),
              et la carte Pro de /pricing annonce « carte requise, aucun debit
              avant la fin de l'essai ». Lire « sans carte » ici puis tomber sur
              un formulaire de carte, c'est le sentiment d'appat au pire endroit
              du parcours. Le libelle dit desormais ce qui est sans carte : la
              creation du compte. */}
          <p className="text-center text-xs text-gray-600 -mt-4">
            {locale === "fr" ? "14 jours d'accès Pro offerts · Aucune carte pour créer un compte" :
             locale === "es" ? "14 días de acceso Pro gratis · Sin tarjeta para crear una cuenta" :
             locale === "ar" ? "14 يوماً من الوصول إلى Pro مجاناً · لا حاجة لبطاقة لإنشاء حساب" :
             locale === "id" ? "14 hari akses Pro gratis · Tanpa kartu untuk membuat akun" :
             "14 days of Pro access, free · No card to create an account"}
          </p>
          <InstitutionalContactLink locale={locale} source="login" />
        </div>
      </div>
    </div>
  );
}

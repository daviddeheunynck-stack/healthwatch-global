"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { track } from "@vercel/analytics/react";
import { Loader2 } from "lucide-react";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const LABELS: Record<string, { google: string; github: string }> = {
  en: { google: "Continue with Google", github: "Continue with GitHub" },
  fr: { google: "Continuer avec Google", github: "Continuer avec GitHub" },
  es: { google: "Continuar con Google",  github: "Continuar con GitHub"  },
  ar: { google: "المتابعة عبر Google",   github: "المتابعة عبر GitHub"   },
  id: { google: "Lanjutkan dengan Google", github: "Lanjutkan dengan GitHub" },
};

const ERROR_LABELS: Record<string, string> = {
  en: "Google sign-in failed. Please try again or use email.",
  fr: "Connexion Google échouée. Réessayez ou utilisez l'email.",
  es: "Error con Google. Inténtelo de nuevo o use el correo.",
  ar: "فشل تسجيل الدخول عبر Google. حاول مرة أخرى أو استخدم البريد.",
  id: "Gagal masuk dengan Google. Coba lagi atau gunakan email.",
};

type Props = { locale: string; redirectTo?: string; context?: "signup" | "login" };

export default function OAuthButtons({ locale, redirectTo, context = "signup" }: Props) {
  const [loading, setLoading] = useState<"google" | "github" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const l = LABELS[locale] ?? LABELS.en;

  const handleOAuth = async (provider: "google" | "github") => {
    setLoading(provider);
    setOauthError(null);
    track(`${context}_oauth_click`, { provider, locale });
    const supabase = createClient();
    const next = redirectTo ?? `/${locale}`;
    const result = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    console.log("[OAuth debug]", JSON.stringify({ error: result.error, url: result.data?.url }));
    if (result.error) {
      setOauthError(`${ERROR_LABELS[locale] ?? ERROR_LABELS.en} (${result.error.message})`);
      setLoading(null);
    }
    // On success: browser redirects — no need to reset loading
  };

  return (
    <div className="space-y-2.5">
      {oauthError && (
        <p className="text-red-400 text-sm text-center">{oauthError}</p>
      )}
      <button
        onClick={() => handleOAuth("google")}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-60 text-gray-800 font-medium py-2.5 rounded-lg transition-colors text-sm"
      >
        {loading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
        {l.google}
      </button>
      <button
        onClick={() => handleOAuth("github")}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors border border-gray-700 text-sm"
      >
        {loading === "github" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitHubIcon />}
        {l.github}
      </button>
    </div>
  );
}

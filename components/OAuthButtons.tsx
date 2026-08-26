"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { track } from "@vercel/analytics/react";
import * as Sentry from "@sentry/nextjs";
import { Loader2 } from "lucide-react";

// GitHub retire le 2026-08-26. C'etait un signal de produit pour developpeurs sur
// une page dont les visiteurs sont health.ny.gov, georgetown.edu, pasteur.ma ou
// l'ANSS — et une option de plus a arbitrer au pire moment du tunnel. Verifie
// avant retrait : aucun compte n'utilisait ce fournisseur. Le bon candidat de
// remplacement est Microsoft (les .gov/.edu vises sont sur Microsoft 365, pas sur
// Google), mais l'OAuth Microsoft en tenant institutionnel demande souvent un
// consentement administrateur — donc un ticket au service informatique du
// prospect, exactement l'obstacle que l'OAuth devait supprimer. A cabler le jour
// ou un prospect ecrit qu'il ne peut pas creer de compte avec son adresse, pas
// avant. Cote Supabase, le provider GitHub est a desactiver dans le tableau de
// bord (Authentication > Providers) : ce fichier ne peut pas le faire.

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const LABELS: Record<string, string> = {
  en: "Continue with Google",
  fr: "Continuer avec Google",
  es: "Continuar con Google",
  ar: "المتابعة عبر Google",
  id: "Lanjutkan dengan Google",
};

const ERROR_LABELS: Record<string, string> = {
  en: "Google sign-in failed. Please try again or use email.",
  fr: "Connexion Google échouée. Réessayez ou utilisez l'email.",
  es: "Error con Google. Inténtelo de nuevo o use el correo.",
  ar: "فشل تسجيل الدخول عبر Google. حاول مرة أخرى أو استخدم البريد.",
  id: "Gagal masuk dengan Google. Coba lagi atau gunakan email.",
};

type Props = {
  locale: string;
  redirectTo?: string;
  context?: "signup" | "login";
  // Region prioritaire choisie sur le formulaire d'inscription, transmise a
  // /auth/callback pour que activateTrial() l'applique des la premiere
  // activation. Sans elle, un compte OAuth est inscrit aux cinq regions et
  // recoit un digest de signup sur cinq continents avant meme d'avoir pu
  // repondre a la question — c'est la pression d'alerte plate mesuree le
  // 2026-08-25. "all" et undefined valent explicitement "toutes les regions".
  priorityRegion?: string;
  // Rendue false, la connexion OAuth est annulee et le parent affiche son
  // propre message (region non choisie). Le bouton reste actif : un bouton
  // desactive sans explication coute plus qu'une erreur au clic.
  onBeforeOAuth?: () => boolean;
};

export default function OAuthButtons({
  locale,
  redirectTo,
  context = "signup",
  priorityRegion,
  onBeforeOAuth,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const label = LABELS[locale] ?? LABELS.en;

  const handleOAuth = async () => {
    if (onBeforeOAuth && !onBeforeOAuth()) return;

    setLoading(true);
    setOauthError(null);
    track(`${context}_oauth_click`, { provider: "google", locale });
    const supabase = createClient();
    const next = redirectTo ?? `/${locale}`;
    const regionParam =
      priorityRegion && priorityRegion !== "all" ? `&region=${encodeURIComponent(priorityRegion)}` : "";
    // signInWithOAuth (unlike most other auth-js methods) has no internal
    // try/catch at all — building the authorize URL includes PKCE code-
    // challenge generation via the Web Crypto API and a storage write, both
    // of which can throw in a locked-down/managed corporate browser instead
    // of resolving with {error}. Without this try/catch that left the button
    // spinning forever with no error shown and no Sentry event — same class
    // of silent failure as the email path in signup/page.tsx (see its
    // comment for the report that surfaced this, 2026-08-03).
    try {
      const result = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}${regionParam}`,
        },
      });
      if (result.error) {
        setOauthError(`${ERROR_LABELS[locale] ?? ERROR_LABELS.en} (${result.error.message})`);
        setLoading(false);
      }
      // On success: browser redirects — no need to reset loading
    } catch (err) {
      console.error("[oauth] unexpected exception:", err);
      Sentry.captureException(err, { tags: { flow: context, provider: "google", locale } });
      track(`${context}_oauth_unexpected_error`, { provider: "google", locale });
      setOauthError(ERROR_LABELS[locale] ?? ERROR_LABELS.en);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {oauthError && (
        <p className="text-red-400 text-sm text-center">{oauthError}</p>
      )}
      <button
        onClick={handleOAuth}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-60 text-gray-800 font-medium py-2.5 rounded-lg transition-colors text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
        {label}
      </button>
    </div>
  );
}

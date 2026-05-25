"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { Activity, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PageState = "loading" | "ready" | "success" | "error";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Supabase PKCE flow: token_hash in query params
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    if (tokenHash && type === "recovery") {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error }) => {
          setPageState(error ? "error" : "ready");
        });
      return;
    }

    // Implicit / hash-based fallback (older Supabase config)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPageState("ready");
    });

    // If no token found after a tick, show error
    const timeout = setTimeout(() => {
      setPageState((prev) => (prev === "loading" ? "error" : prev));
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 8) {
      setFormError(t("passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setFormError(t("passwordMismatch"));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setFormError(error.message);
    } else {
      setPageState("success");
      setTimeout(() => router.push(`/${locale}/login`), 3000);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <Activity className="text-red-500 w-10 h-10 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">{t("resetPasswordTitle")}</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">

          {/* Loading */}
          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-red-400" />
              <p className="text-sm">
                {locale === "fr" ? "Vérification en cours…" : locale === "es" ? "Verificando…" : locale === "ar" ? "جارٍ التحقق…" : locale === "id" ? "Memverifikasi…" : "Verifying your link…"}
              </p>
            </div>
          )}

          {/* Invalid / expired link */}
          {pageState === "error" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-white font-semibold">{t("tokenInvalid")}</p>
              <Link
                href={`/${locale}/forgot-password`}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                {t("sendResetLink")} →
              </Link>
            </div>
          )}

          {/* New password form */}
          {pageState === "ready" && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t("newPassword")}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={saving}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t("confirmPassword")}</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={saving}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                />
              </div>

              {formError && <p className="text-red-400 text-sm">{formError}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("savePassword")}
              </button>
            </form>
          )}

          {/* Success */}
          {pageState === "success" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <h2 className="text-lg font-semibold text-white">{t("passwordUpdated")}</h2>
              <p className="text-gray-400 text-sm">{t("passwordUpdatedText")}</p>
              <p className="text-xs text-gray-600">
                {locale === "fr" ? "Redirection vers la connexion…" : locale === "es" ? "Redirigiendo…" : locale === "ar" ? "جارٍ التحويل…" : locale === "id" ? "Mengalihkan…" : "Redirecting to sign in…"}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

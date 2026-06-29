"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { Activity, Loader2, Mail, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/${locale}/reset-password`;

    await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    // Always show success — don't leak whether an account exists
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <Activity className="text-red-500 w-10 h-10 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">{t("forgotPasswordTitle")}</h1>
          {!sent && (
            <p className="text-gray-400 text-sm mt-2">{t("forgotPasswordSubtitle")}</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <h2 className="text-lg font-semibold text-white">{t("resetLinkSent")}</h2>
              <p className="text-gray-400 text-sm">{t("resetLinkSentText")}</p>
              <Link
                href={`/${locale}/login`}
                className="mt-2 text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("backToLogin")}
              </Link>
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
                  placeholder="you@organization.org"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {t("sendResetLink")}
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                <Link href={`/${locale}/login`} className="text-red-400 hover:text-red-300 flex items-center justify-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("backToLogin")}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

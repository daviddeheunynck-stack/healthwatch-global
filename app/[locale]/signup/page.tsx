"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { Activity, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
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
      options: {
        emailRedirectTo: `${window.location.origin}/${locale}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Activity className="text-red-500 w-10 h-10 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">{t("signupTitle")}</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          {success ? (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <p className="text-lg font-medium text-white">{t("successSignup")}</p>
              <p className="text-sm text-gray-400">{t("checkEmailSignup")}</p>
              <Link
                href={`/${locale}/login`}
                className="mt-4 text-red-400 hover:text-red-300 text-sm"
              >
                {t("loginLink")}
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignup} className="space-y-4">
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
                  <label className="block text-sm text-gray-400 mb-1">{t("password")}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
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
                  {t("signup")}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                {t("alreadyHaveAccount")}{" "}
                <Link href={`/${locale}/login`} className="text-red-400 hover:text-red-300">
                  {t("loginLink")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

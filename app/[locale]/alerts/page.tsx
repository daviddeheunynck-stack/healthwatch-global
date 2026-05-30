"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { Bell, CheckCircle, Loader2, Info } from "lucide-react";
import RealtimeAlertFeed from "@/components/RealtimeAlertFeed";

const REGIONS = ["allRegions", "africa", "asia", "europe", "americas", "oceania"] as const;

export default function AlertsPage() {
  const t = useTranslations("alerts");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("allRegions");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, region, locale }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errorGeneric"));
        return;
      }

      setSubmitted(true);
      setEmail("");
    } catch {
      setError(t("errorServer"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Bell className="text-red-500 w-8 h-8" />
          {t("title")}
        </h1>
        <p className="text-gray-400 mt-2">{t("subtitle")}</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-3 text-green-400">
            <CheckCircle className="w-12 h-12" />
            <p className="text-lg font-medium">{t("success")}</p>
            <p className="text-sm text-gray-400">{t("checkEmail")}</p>
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t("region")}</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(r)}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("subscribe")}
            </button>
          </form>
        )}
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex gap-3 text-sm text-gray-400">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p>{t("freeNote")}</p>
      </div>

      <RealtimeAlertFeed />

      <div className="text-center text-xs text-gray-600">
        Sources : WHO Disease Outbreak News · ProMED · CDC · ECDC
      </div>
    </div>
  );
}

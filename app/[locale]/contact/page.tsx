"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Mail, MessageSquare, CheckCircle, Loader2, Activity, Globe, Shield } from "lucide-react";

export default function ContactPage() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [form, setForm] = useState({ name: "", organization: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setSuccess(true);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const reasons = [
    { icon: Activity, text: t("reason1") },
    { icon: Globe, text: t("reason2") },
    { icon: Shield, text: t("reason3") },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12">

      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold text-white">{t("title")}</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">{t("subtitle")}</p>
      </div>

      {/* Two columns */}
      <div className="grid md:grid-cols-2 gap-10">

        {/* Left — Why contact + About */}
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">{t("whyTitle")}</h2>
            <div className="space-y-4">
              {reasons.map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-600/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-gray-300 text-sm pt-1">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* About */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">
                DD
              </div>
              <div>
                <p className="text-white font-semibold text-sm">David Deheunynck</p>
                <p className="text-gray-400 text-xs">Founder, HealthWatch Global</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{t("aboutText")}</p>
            <a
              href="mailto:contact@healthwatch-global.com"
              className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
            >
              <Mail className="w-4 h-4" />
              contact@healthwatch-global.com
            </a>
          </div>
        </div>

        {/* Right — Contact form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <h3 className="text-lg font-semibold text-white">{t("successTitle")}</h3>
              <p className="text-gray-400 text-sm">{t("successText")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">{t("name")} *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    disabled={loading}
                    placeholder={t("namePlaceholder")}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">{t("organization")}</label>
                  <input
                    type="text"
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    disabled={loading}
                    placeholder={t("organizationPlaceholder")}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">{t("email")} *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={loading}
                  placeholder="you@organization.org"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">{t("message")} *</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  disabled={loading}
                  rows={5}
                  placeholder={t("messagePlaceholder")}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50 resize-none"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                {t("send")}
              </button>

              <p className="text-center text-xs text-gray-600">{t("responseTime")}</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Check, Zap, Shield, Building2, Mail } from "lucide-react";

const STARTER_FEATURES = [
  "pricing.f1_1",
  "pricing.f1_2",
  "pricing.f1_3",
  "pricing.f1_4",
  "pricing.f1_5",
];

const PRO_FEATURES = [
  "pricing.f2_1",
  "pricing.f2_2",
  "pricing.f2_3",
  "pricing.f2_4",
  "pricing.f2_5",
  "pricing.f2_6",
];

const ENTERPRISE_FEATURES = [
  "pricing.f3_1",
  "pricing.f3_2",
  "pricing.f3_3",
  "pricing.f3_4",
  "pricing.f3_5",
  "pricing.f3_6",
];

export default async function PricingPage() {
  const t = await getTranslations();

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white">{t("pricing.title")}</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t("pricing.subtitle")}</p>
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-green-400 text-sm">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          {t("pricing.badge")}
        </div>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 items-start">

        {/* Starter */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-semibold text-sm uppercase tracking-wide">Starter</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">199 €</span>
              <span className="text-gray-400 mb-1">{t("pricing.perMonth")}</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">{t("pricing.starter_desc")}</p>
          </div>

          <ul className="space-y-3">
            {STARTER_FEATURES.map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                {t(key as any)}
              </li>
            ))}
          </ul>

          <a
            href="mailto:contact@healthwatch-global.com?subject=Starter Plan - HealthWatch Global"
            className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {t("pricing.getStarted")}
          </a>
        </div>

        {/* Pro — highlighted */}
        <div className="bg-gray-900 border-2 border-red-500 rounded-2xl p-6 space-y-6 relative">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="bg-red-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
              {t("pricing.popular")}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-semibold text-sm uppercase tracking-wide">Pro</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">990 €</span>
              <span className="text-gray-400 mb-1">{t("pricing.perMonth")}</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">{t("pricing.pro_desc")}</p>
          </div>

          <ul className="space-y-3">
            {PRO_FEATURES.map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                {t(key as any)}
              </li>
            ))}
          </ul>

          <a
            href="mailto:contact@healthwatch-global.com?subject=Pro Plan - HealthWatch Global"
            className="block w-full text-center bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {t("pricing.getStarted")}
          </a>
        </div>

        {/* Enterprise */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-semibold text-sm uppercase tracking-wide">Enterprise</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">{t("pricing.custom")}</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">{t("pricing.enterprise_desc")}</p>
          </div>

          <ul className="space-y-3">
            {ENTERPRISE_FEATURES.map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                {t(key as any)}
              </li>
            ))}
          </ul>

          <a
            href="mailto:contact@healthwatch-global.com?subject=Enterprise Plan - HealthWatch Global"
            className="block w-full text-center bg-purple-700 hover:bg-purple-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {t("pricing.contactUs")}
          </a>
        </div>
      </div>

      {/* Trust signals */}
      <div className="border border-gray-800 rounded-2xl p-8 grid md:grid-cols-3 gap-6 text-center">
        <div>
          <p className="text-3xl font-bold text-white">195</p>
          <p className="text-gray-400 text-sm mt-1">{t("pricing.trust1")}</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-white">99.9%</p>
          <p className="text-gray-400 text-sm mt-1">{t("pricing.trust2")}</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-white">RGPD</p>
          <p className="text-gray-400 text-sm mt-1">{t("pricing.trust3")}</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto space-y-4">
        <h2 className="text-xl font-semibold text-white text-center mb-6">{t("pricing.faq_title")}</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="font-medium text-white mb-2">{t(`pricing.faq${i}_q` as any)}</p>
            <p className="text-gray-400 text-sm">{t(`pricing.faq${i}_a` as any)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

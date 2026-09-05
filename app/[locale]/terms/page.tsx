import { getLocale } from "next-intl/server";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

const BACK_LABELS: Record<string, string> = {
  en: "Back to dashboard",
  fr: "Retour au tableau de bord",
  es: "Volver al panel",
  ar: "العودة إلى لوحة التحكم",
  id: "Kembali ke dasbor",
};

const TERMS_TITLES: Record<string, string> = {
  en: "Terms of Service",
  fr: "Conditions d'utilisation",
  es: "Condiciones de servicio",
  ar: "شروط الخدمة",
  id: "Ketentuan Layanan",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const url = `https://healthwatch-global.com/${locale}/terms`;
  return {
    title: TERMS_TITLES[locale] ?? TERMS_TITLES.en,
    description: "HealthWatch Global terms of service — acceptable use, subscriptions, billing, health data disclaimer, and governing law.",
    alternates: {
      canonical: url,
      languages: {
        en: "https://healthwatch-global.com/en/terms",
        fr: "https://healthwatch-global.com/fr/terms",
        es: "https://healthwatch-global.com/es/terms",
        ar: "https://healthwatch-global.com/ar/terms",
        id: "https://healthwatch-global.com/id/terms",
        "x-default": "https://healthwatch-global.com/en/terms",
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const backLabel = BACK_LABELS[locale] ?? BACK_LABELS.en;

  return (
    <div className="max-w-3xl mx-auto space-y-10">

      <div>
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        </div>
        <p className="text-gray-500 text-sm">Last updated: May 25, 2026</p>
      </div>

      <div className="space-y-8">

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">1. Acceptance of Terms</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            By accessing or using HealthWatch Global (&quot;the Service&quot;), you agree to be bound by these Terms of
            Service. If you do not agree, do not use the Service. The Service is operated by David Deheunynck,
            sole trader, France (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">2. Description of Service</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            HealthWatch Global is a multilingual health surveillance platform that aggregates and displays
            publicly available epidemic alert data from sources including WHO Disease Outbreak News (DON),
            CDC, and ECDC. The platform provides interactive dashboards, disease-specific alert
            subscriptions, regional email alerts, PDF regional reports, CSV data export, Slack/Teams
            integration, and a REST API for Enterprise organizations. Available in 5 languages.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">2a. Alert Services</h2>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span><strong className="text-gray-300">Weekly digest:</strong> A weekly summary of active outbreaks filtered by your preferred region.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span><strong className="text-gray-300">Regional alerts:</strong> Email notifications when a new outbreak is detected in your monitored geographic regions (Pro and Team plans).</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span><strong className="text-gray-300">Disease alerts:</strong> Email notifications when a tracked pathogen (e.g. H5N1, Ebola) is detected anywhere in the world, up to 10 diseases (Pro and Team plans, sent up to 3× per day).</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Alert data is sourced from official public health organizations. We do not guarantee real-time delivery or complete coverage of all outbreaks worldwide.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">3. Accounts</h2>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>You must provide a valid email address to create an account.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>You are responsible for maintaining the confidentiality of your credentials.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>You must be at least 18 years old, or the legal age of majority in your jurisdiction.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>One account per person or organization. Contact us for multi-user Enterprise pricing.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">4. Subscriptions and Billing</h2>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>The Pro plan (€29/month or €249/year) is billed monthly or annually via Stripe. A 7-day free trial is available; a payment method is required at signup, but you will not be charged until the trial ends. Prices exclude applicable taxes.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Subscriptions renew automatically until cancelled. You may cancel at any time; access continues until the end of the current billing period.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>We offer a 14-day money-back guarantee on your first payment — no questions asked. Beyond this period, refunds are not provided for partial months.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>We reserve the right to change pricing with 30 days notice to active subscribers.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">5. Acceptable Use</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">You agree not to:</p>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Scrape, copy, or redistribute the platform&apos;s data or design without written permission.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Use the Service for any unlawful purpose or in violation of any applicable regulation.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Attempt to gain unauthorized access to any part of the platform or its infrastructure.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Use automated tools to access the Service in a way that could damage or overload our infrastructure.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">6. Health Data Disclaimer</h2>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <p className="text-amber-300/80 text-sm leading-relaxed">
              <strong className="text-amber-300">Important:</strong> The health data displayed on HealthWatch Global is
              aggregated from public sources for informational and situational awareness purposes only. It does not
              constitute medical advice, clinical diagnosis, or official public health guidance. Always consult
              official national and international health authorities (WHO, ECDC, local ministries of health) for
              decisions affecting public health or individual clinical care.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">7. Intellectual Property</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            The platform design, code, branding, and compiled datasets are the intellectual property of
            HealthWatch Global. Underlying public health data originates from WHO, ECDC, PAHO and Africa CDC and
            is subject to their respective terms of use. CSV data export rights granted under paid plans do not transfer ownership of any data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">8. Limitation of Liability</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            To the maximum extent permitted by law, HealthWatch Global and its operator shall not be liable for
            any indirect, incidental, special, consequential, or punitive damages arising from your use of the
            Service. Our total liability for any claim shall not exceed the amount you paid us in the 3 months
            preceding the claim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">9. Availability and Changes</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            We aim for 99.9% uptime but do not guarantee uninterrupted access. We reserve the right to modify,
            suspend, or discontinue any part of the Service at any time, with reasonable notice where possible.
            We may update these Terms at any time; continued use of the Service after changes constitutes acceptance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">10. Governing Law</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            These Terms are governed by the laws of France. Any disputes shall be subject to the exclusive
            jurisdiction of the courts of France, without prejudice to mandatory consumer protection provisions
            applicable in your country of residence.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">11. Contact</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Questions about these Terms?{" "}
            <a href="mailto:contact@healthwatch-global.com" className="text-red-400 hover:text-red-300">
              contact@healthwatch-global.com
            </a>
          </p>
        </section>

      </div>
    </div>
  );
}

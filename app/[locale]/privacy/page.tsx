import { getLocale } from "next-intl/server";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

const BACK_LABELS: Record<string, string> = {
  en: "Back to dashboard",
  fr: "Retour au tableau de bord",
  es: "Volver al panel",
  ar: "العودة إلى لوحة التحكم",
  id: "Kembali ke dasbor",
};

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "HealthWatch Global privacy policy — GDPR compliance, data we collect, third-party processors, your rights, and cookie usage.",
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
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
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        </div>
        <p className="text-gray-500 text-sm">Last updated: May 25, 2026</p>
      </div>

      <div className="prose prose-invert prose-sm max-w-none space-y-8">

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">1. Data Controller</h2>
          <p className="text-gray-400 leading-relaxed">
            HealthWatch Global is operated by David Deheunynck (sole trader, France).
            For any privacy-related request, contact us at{" "}
            <a href="mailto:contact@healthwatch-global.com" className="text-red-400 hover:text-red-300">
              contact@healthwatch-global.com
            </a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">2. Data We Collect</h2>
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-white text-sm font-medium">Account registration</p>
              <p className="text-gray-400 text-sm">Email address and password (hashed). Used to authenticate you and manage your subscription.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-white text-sm font-medium">Alert subscriptions</p>
              <p className="text-gray-400 text-sm">Email address, preferred region and language. Used to send you the weekly health digest you requested.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-white text-sm font-medium">Contact form</p>
              <p className="text-gray-400 text-sm">Name, email, organization (optional), message. Used solely to respond to your inquiry.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-white text-sm font-medium">Payment</p>
              <p className="text-gray-400 text-sm">Billing details are processed directly by Stripe. HealthWatch Global never stores card numbers.</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">3. Legal Basis (GDPR)</h2>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Contract performance — providing the service you subscribed to.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Legitimate interest — responding to contact form submissions.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Consent — sending the weekly alert digest (you can unsubscribe at any time).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">4. Third-Party Processors</h2>
          <div className="overflow-hidden border border-gray-800 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Processor</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Purpose</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  ["Supabase", "Database & authentication", "EU (Frankfurt)"],
                  ["Brevo", "Transactional & digest emails", "EU (Paris)"],
                  ["Stripe", "Payment processing", "EU / US"],
                  ["Vercel", "Hosting & edge network", "Global CDN"],
                ].map(([name, purpose, location]) => (
                  <tr key={name} className="bg-gray-900/40">
                    <td className="px-4 py-3 text-white font-medium">{name}</td>
                    <td className="px-4 py-3 text-gray-400">{purpose}</td>
                    <td className="px-4 py-3 text-gray-500">{location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 text-sm">We do not sell or rent your personal data to any third party.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">5. Data Retention</h2>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Account data: retained for the duration of your account, then deleted within 30 days of closure.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Alert subscriptions: retained until you unsubscribe.</li>
            <li className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>Contact form data: retained for up to 1 year for follow-up purposes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">6. Your Rights (GDPR)</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Under the GDPR, you have the right to access, rectify, erase, restrict or port your personal data,
            and to object to its processing. To exercise any of these rights, email us at{" "}
            <a href="mailto:contact@healthwatch-global.com" className="text-red-400 hover:text-red-300">
              contact@healthwatch-global.com
            </a>. We will respond within 30 days. You also have the right to lodge a complaint with your national
            supervisory authority (in France: CNIL — <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300">cnil.fr</a>).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">7. Analytics &amp; Cookies</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            We use a single session cookie set by Supabase for authentication purposes. No tracking or advertising
            cookies are used. We use <strong className="text-gray-300">Vercel Analytics</strong> to measure aggregate
            audience metrics (page views, country of origin). This tool collects no personal data, sets no cookies,
            and is fully GDPR-compliant. Your individual visits are never tracked or profiled.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">8. Changes to this Policy</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            We may update this policy to reflect changes in our practices or applicable law. We will notify registered
            users by email of any material changes. The date at the top of this page always reflects the latest revision.
          </p>
        </section>

      </div>
    </div>
  );
}

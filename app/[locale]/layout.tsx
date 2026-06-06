import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n.routing";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import { UpgradeModalProvider } from "@/lib/upgrade-modal-context";
import ConsentAwareAnalytics from "@/components/ConsentAwareAnalytics";
import FoundingMemberBanner  from "@/components/FoundingMemberBanner";
import "../globals.css";

const META: Record<string, { title: string; description: string }> = {
  en: {
    title: "HealthWatch Global — Real-time Epidemic Surveillance",
    description:
      "Monitor disease outbreaks worldwide in real time. WHO, CDC & ECDC data in 5 languages. Built for NGOs, health ministries and international organizations.",
  },
  fr: {
    title: "HealthWatch Global — Surveillance épidémique en temps réel",
    description:
      "Suivez les foyers épidémiques mondiaux en temps réel. Données OMS, CDC et ECDC en 5 langues. Conçu pour les ONG, ministères de la santé et organisations internationales.",
  },
  es: {
    title: "HealthWatch Global — Vigilancia epidémica en tiempo real",
    description:
      "Monitoreo de brotes en tiempo real. Datos OMS, CDC y ECDC en 5 idiomas. Para ONG, ministerios de salud y organizaciones internacionales.",
  },
  ar: {
    title: "HealthWatch Global — مراقبة الأوبئة في الوقت الفعلي",
    description:
      "رصد تفشي الأمراض حول العالم في الوقت الفعلي. بيانات منظمة الصحة العالمية ومراكز السيطرة على الأمراض بخمس لغات.",
  },
  id: {
    title: "HealthWatch Global — Pemantauan Wabah Real-time",
    description:
      "Pantau wabah penyakit di seluruh dunia secara real-time. Data WHO, CDC & ECDC dalam 5 bahasa. Untuk LSM, kementerian kesehatan dan organisasi internasional.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.en;
  const url = `https://healthwatch-global.com/${locale}`;

  return {
    title: {
      default: m.title,
      template: "%s | HealthWatch Global",
    },
    description: m.description,
    metadataBase: new URL("https://healthwatch-global.com"),
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `https://healthwatch-global.com/${l}`])
      ),
    },
    openGraph: {
      type: "website",
      url,
      title: m.title,
      description: m.description,
      siteName: "HealthWatch Global",
      locale: locale === "ar" ? "ar_SA" : locale === "fr" ? "fr_FR" : locale === "es" ? "es_ES" : locale === "id" ? "id_ID" : "en_US",
      images: [
        {
          url: `https://healthwatch-global.com/api/og?locale=${locale}`,
          width: 1200,
          height: 630,
          alt: m.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: [`https://healthwatch-global.com/api/og?locale=${locale}`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const isRTL = locale === "ar";

  return (
    <html lang={locale} dir={isRTL ? "rtl" : "ltr"}>
      <body className="bg-gray-950 text-gray-100 min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <UpgradeModalProvider>
            <Navbar />
            {/* FoundingMemberBanner désactivée — offre fondateur réservée à l'outreach direct (coupon Stripe FOUNDER29) */}
            {/* <FoundingMemberBanner locale={locale} pricingHref={`/${locale}/pricing`} /> */}
            <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">{children}</main>
            <Footer locale={locale} />
            <CookieBanner locale={locale} />
          </UpgradeModalProvider>
        </NextIntlClientProvider>
        <ConsentAwareAnalytics />
      </body>
    </html>
  );
}

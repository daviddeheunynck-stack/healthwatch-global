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
import "../globals.css";

const META: Record<string, { title: string; description: string }> = {
  en: {
    title: "HealthWatch Global — Daily Epidemic Surveillance",
    description:
      "Monitor disease outbreaks worldwide with daily updates. WHO, CDC & ECDC data in 5 languages. Built for NGOs, health ministries and international organizations.",
  },
  fr: {
    title: "HealthWatch Global — Surveillance épidémique quotidienne",
    description:
      "Suivez les foyers épidémiques mondiaux au quotidien. Données OMS, CDC et ECDC en 5 langues. Conçu pour les ONG, ministères de la santé et organisations internationales.",
  },
  es: {
    title: "HealthWatch Global — Vigilancia epidémica diaria",
    description:
      "Monitoreo diario de brotes. Datos OMS, CDC y ECDC en 5 idiomas. Para ONG, ministerios de salud y organizaciones internacionales.",
  },
  ar: {
    title: "HealthWatch Global — مراقبة الأوبئة اليومية",
    description:
      "رصد تفشي الأمراض حول العالم يومياً. بيانات منظمة الصحة العالمية ومراكز السيطرة على الأمراض بخمس لغات.",
  },
  id: {
    title: "HealthWatch Global — Pemantauan Wabah Harian",
    description:
      "Pantau wabah penyakit di seluruh dunia setiap hari. Data WHO, CDC & ECDC dalam 5 bahasa. Untuk LSM, kementerian kesehatan dan organisasi internasional.",
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

  // `routing.locales` is a literal-tuple type narrower than the route's
  // `locale: string` — widen the array (not the value) to check membership
  // of an arbitrary string against it. Standard pattern; see i18n.ts for the
  // sibling check on the request-config side.
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const messages = await getMessages();
  const isRTL = locale === "ar";

  return (
    <html lang={locale} dir={isRTL ? "rtl" : "ltr"}>
      <body className="bg-gray-950 text-gray-100 min-h-screen flex flex-col overflow-x-hidden">
        <NextIntlClientProvider messages={messages}>
          <UpgradeModalProvider>
            <Navbar />
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

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
import PHLaunchBar from "@/components/PHLaunchBar";
import SentryUserIdentifier from "@/components/SentryUserIdentifier";
import TrialBannerLoader from "@/components/TrialBannerLoader";
import UpgradeModalAutoTrigger from "@/components/UpgradeModalAutoTrigger";
import "../globals.css";

const META: Record<string, { title: string; description: string }> = {
  en: {
    title: "HealthWatch Global — Epidemic Surveillance",
    description:
      "Monitor disease outbreaks worldwide — WHO, ECDC, PAHO & Africa CDC data in 5 languages, updated every hour. Built for epidemiologists, NGOs and health ministries.",
  },
  fr: {
    title: "HealthWatch Global — Surveillance épidémique",
    description:
      "Suivez les foyers épidémiques mondiaux. Données officielles OMS, ECDC, PAHO et Africa CDC en 5 langues, mises à jour toutes les heures. Conçu pour les épidémiologistes, ONG et ministères de la santé.",
  },
  es: {
    title: "HealthWatch Global — Vigilancia epidémica",
    description:
      "Monitoreo de brotes en todo el mundo. Datos oficiales OMS, ECDC, PAHO y Africa CDC en 5 idiomas, actualizados cada hora. Para epidemiólogos, ONG y ministerios de salud.",
  },
  ar: {
    title: "HealthWatch Global — مراقبة الأوبئة",
    description:
      "رصد تفشي الأمراض حول العالم. بيانات رسمية من منظمة الصحة العالمية، ECDC، PAHO وAfrica CDC بخمس لغات، محدّثة كل ساعة.",
  },
  id: {
    title: "HealthWatch Global — Pemantauan Wabah",
    description:
      "Pantau wabah penyakit di seluruh dunia. Data resmi WHO, ECDC, PAHO & Africa CDC dalam 5 bahasa, diperbarui setiap jam. Untuk epidemiolog, LSM dan kementerian kesehatan.",
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
    robots: { index: true, follow: true },
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `https://healthwatch-global.com/${l}`])),
        "x-default": "https://healthwatch-global.com/en",
      },
      types: {
        "application/rss+xml": `https://healthwatch-global.com/api/feed?locale=${locale}`,
      },
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
      <body className="bg-gray-950 text-gray-100 min-h-screen flex flex-col overflow-x-clip">
        <PHLaunchBar locale={locale} />
        <NextIntlClientProvider messages={messages}>
          <UpgradeModalProvider>
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 pt-4 w-full">
              <TrialBannerLoader locale={locale} />
            </div>
            <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">{children}</main>
            <Footer locale={locale} />
            <CookieBanner locale={locale} />
            <UpgradeModalAutoTrigger />
          </UpgradeModalProvider>
        </NextIntlClientProvider>
        <SentryUserIdentifier locale={locale} />
        <ConsentAwareAnalytics />
      </body>
    </html>
  );
}

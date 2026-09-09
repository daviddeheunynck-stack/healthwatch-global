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
import { Activity } from "lucide-react";
import { isShutDown } from "@/lib/shutdown";
import "../globals.css";

// HealthWatch Global shuts down at SHUTDOWN_AT (see SIGNUPS_CLOSED in
// app/[locale]/signup/page.tsx, PILOT_CLOSED in app/[locale]/pilot/page.tsx,
// SIGNUPS_CLOSED in app/auth/callback/route.ts and app/api/checkout/route.ts —
// all of those only stop new customers ahead of time). This is the single
// choke point every page under [locale] passes through, so flipping past
// this date replaces the entire site with the notice below — every route,
// every already-logged-in user, automatically, with nobody needing to be
// in front of a keyboard to trigger it. No exceptions carved out here on
// purpose: by this date there is nothing left to serve, including /admin.
// (SHUTDOWN_AT itself lives in lib/shutdown.ts — the ~50 Vercel crons under
// app/api/cron/ don't pass through this layout and check it independently.)

const SHUTDOWN_MESSAGE: Record<string, { title: string; body: string }> = {
  en: {
    title: "HealthWatch Global has shut down",
    body: "Thank you for using HealthWatch Global. The service is no longer operating. Questions? Write to contact@healthwatch-global.com.",
  },
  fr: {
    title: "HealthWatch Global a fermé",
    body: "Merci d'avoir utilisé HealthWatch Global. Le service n'est plus en activité. Des questions ? Écrivez à contact@healthwatch-global.com.",
  },
  es: {
    title: "HealthWatch Global ha cerrado",
    body: "Gracias por usar HealthWatch Global. El servicio ya no está en funcionamiento. ¿Preguntas? Escriba a contact@healthwatch-global.com.",
  },
  ar: {
    title: "أغلقت HealthWatch Global",
    body: "شكراً لاستخدامكم HealthWatch Global. لم تعد الخدمة تعمل. لأي استفسار، راسلونا على contact@healthwatch-global.com.",
  },
  id: {
    title: "HealthWatch Global telah ditutup",
    body: "Terima kasih telah menggunakan HealthWatch Global. Layanan ini tidak lagi beroperasi. Ada pertanyaan? Kirim email ke contact@healthwatch-global.com.",
  },
};

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

  const isRTL = locale === "ar";

  if (isShutDown()) {
    const m = SHUTDOWN_MESSAGE[locale] ?? SHUTDOWN_MESSAGE.en;
    return (
      <html lang={locale} dir={isRTL ? "rtl" : "ltr"}>
        <body className="bg-gray-950 text-gray-100 min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md text-center space-y-4">
            <div className="flex items-center justify-center gap-2.5">
              <Activity className="text-red-500 w-8 h-8 shrink-0" />
              <span className="font-bold text-white text-2xl">HealthWatch Global</span>
            </div>
            <h1 className="text-white text-lg font-semibold">{m.title}</h1>
            <p className="text-gray-400 text-sm leading-relaxed">{m.body}</p>
          </div>
        </body>
      </html>
    );
  }

  const messages = await getMessages();

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

import type { Metadata } from "next";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

const META: Record<string, { title: string; description: string }> = {
  en: { title: "Alert Center", description: "Get daily outbreak alerts by region. Email notifications from WHO, ECDC, PAHO and Africa CDC — or subscribe to a free weekly digest." },
  fr: { title: "Centre d'Alertes", description: "Recevez des alertes épidémiques quotidiennes par région. Notifications depuis l'OMS, l'ECDC, l'OPAS et Africa CDC — ou abonnez-vous au digest hebdomadaire gratuit." },
  es: { title: "Centro de Alertas", description: "Reciba alertas de brotes diarias por región. Notificaciones de OMS, ECDC, PAHO y Africa CDC — o suscríbase al resumen semanal gratuito." },
  ar: { title: "مركز التنبيهات", description: "احصل على تنبيهات التفشي اليومية حسب المنطقة. إشعارات من WHO وECDC وPAHO وAfrica CDC — أو اشترك في الملخص الأسبوعي المجاني." },
  id: { title: "Pusat Peringatan", description: "Dapatkan peringatan wabah harian berdasarkan wilayah. Notifikasi dari WHO, ECDC, PAHO, dan Africa CDC — atau berlangganan digest mingguan gratis." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.en;
  const url = `https://healthwatch-global.com/${locale}/alerts`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/alerts`])),
        "x-default": "https://healthwatch-global.com/en/alerts",
      },
    },
    openGraph: {
      type: "website",
      url,
      title: `${m.title} | HealthWatch Global`,
      description: m.description,
      siteName: "HealthWatch Global",
      locale: OG_LOCALE[locale] ?? "en_US",
      images: [
        {
          url: `https://healthwatch-global.com/api/og?locale=${locale}`,
          width: 1200,
          height: 630,
          alt: `${m.title} — HealthWatch Global`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${m.title} | HealthWatch Global`,
      description: m.description,
      images: [`https://healthwatch-global.com/api/og?locale=${locale}`],
    },
    robots: { index: true, follow: true },
  };
}

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

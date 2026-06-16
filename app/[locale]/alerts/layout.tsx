import type { Metadata } from "next";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

const META: Record<string, { title: string; description: string }> = {
  en: { title: "Email Alerts", description: "Subscribe to a free weekly digest of disease outbreaks for your region. Powered by WHO Disease Outbreak News." },
  fr: { title: "Alertes email", description: "Abonnez-vous à un digest hebdomadaire gratuit des foyers épidémiques de votre région. Alimenté par le bulletin OMS." },
  es: { title: "Alertas por email", description: "Suscríbase a un resumen semanal gratuito de brotes de enfermedades en su región. Impulsado por el boletín de la OMS." },
  ar: { title: "تنبيهات البريد الإلكتروني", description: "اشترك في ملخص أسبوعي مجاني لتفشي الأمراض في منطقتك. مدعوم من نشرة منظمة الصحة العالمية." },
  id: { title: "Peringatan Email", description: "Berlangganan digest mingguan gratis wabah penyakit di wilayah Anda. Didukung oleh WHO Disease Outbreak News." },
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

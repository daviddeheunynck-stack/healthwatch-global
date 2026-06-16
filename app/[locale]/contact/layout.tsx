import type { Metadata } from "next";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

const META: Record<string, { title: string; description: string }> = {
  en: { title: "Contact", description: "Get in touch with the HealthWatch Global team for questions, partnerships or enterprise enquiries." },
  fr: { title: "Contact", description: "Contactez l'équipe HealthWatch Global pour toute question, partenariat ou demande entreprise." },
  es: { title: "Contacto", description: "Póngase en contacto con el equipo de HealthWatch Global para preguntas, asociaciones o consultas empresariales." },
  ar: { title: "تواصل معنا", description: "تواصل مع فريق HealthWatch Global لأي استفسارات أو شراكات أو طلبات مؤسسية." },
  id: { title: "Kontak", description: "Hubungi tim HealthWatch Global untuk pertanyaan, kemitraan, atau pertanyaan perusahaan." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.en;
  const url = `https://healthwatch-global.com/${locale}/contact`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/contact`])),
        "x-default": "https://healthwatch-global.com/en/contact",
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

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

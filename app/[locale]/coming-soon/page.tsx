import type { Metadata } from "next";
import ComingSoonClient from "./ComingSoonClient";

const OG: Record<string, { title: string; description: string }> = {
  en: {
    title: "HealthWatch Global — Launching on Product Hunt June 25",
    description: "Real-time epidemic surveillance for epidemiologists & health ministries. Live on Product Hunt June 25. Preview the dashboard now — no account needed.",
  },
  fr: {
    title: "HealthWatch Global — Lancement sur Product Hunt le 25 juin",
    description: "Surveillance épidémique en temps réel pour épidémiologistes et ministères de la santé. Lancement sur Product Hunt le 25 juin. Découvrez le tableau de bord dès maintenant.",
  },
  es: {
    title: "HealthWatch Global — Lanzamiento en Product Hunt el 25 de junio",
    description: "Vigilancia epidémica en tiempo real para epidemiólogos y ministerios de salud. Lanzamiento en Product Hunt el 25 de junio.",
  },
  ar: {
    title: "HealthWatch Global — الإطلاق على Product Hunt في 25 يونيو",
    description: "مراقبة وبائية في الوقت الفعلي لوزارات الصحة والمنظمات غير الحكومية. الإطلاق على Product Hunt في 25 يونيو.",
  },
  id: {
    title: "HealthWatch Global — Peluncuran di Product Hunt 25 Juni",
    description: "Pemantauan wabah real-time untuk epidemiolog dan kementerian kesehatan. Peluncuran di Product Hunt 25 Juni.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = OG[locale] ?? OG.en;
  const url = `https://healthwatch-global.com/${locale}/coming-soon`;

  return {
    title: m.title,
    description: m.description,
    openGraph: {
      type: "website",
      url,
      title: m.title,
      description: m.description,
      locale: ({ en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID" } as Record<string, string>)[locale] ?? "en_US",
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
  };
}

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ComingSoonClient locale={locale} />;
}

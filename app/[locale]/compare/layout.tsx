import type { Metadata } from "next";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

const META: Record<string, { title: string; description: string }> = {
  en: { title: "Compare Outbreaks", description: "Compare two active disease outbreaks side by side — case counts, death rates, incidence, and risk levels. Data from WHO Disease Outbreak News." },
  fr: { title: "Comparer les épidémies", description: "Comparez deux foyers épidémiques actifs côte à côte — nombre de cas, taux de mortalité, incidence et niveaux de risque. Données OMS." },
  es: { title: "Comparar brotes", description: "Compare dos brotes activos lado a lado — casos, tasas de mortalidad, incidencia y niveles de riesgo. Datos de la OMS." },
  ar: { title: "مقارنة تفشي الأمراض", description: "قارن بين تفشيَّين نشطَين جنبًا إلى جنب — الحالات ومعدلات الوفيات والإصابة ومستويات الخطر. بيانات منظمة الصحة العالمية." },
  id: { title: "Bandingkan Wabah", description: "Bandingkan dua wabah aktif secara berdampingan — jumlah kasus, tingkat kematian, insidensi, dan tingkat risiko. Data dari WHO." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.en;
  const url = `https://healthwatch-global.com/${locale}/compare`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/compare`])
      ),
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

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

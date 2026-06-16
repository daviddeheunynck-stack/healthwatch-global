import type { Metadata } from "next";

const META: Record<string, { title: string; description: string }> = {
  en: {
    title: "Compare Disease Outbreaks | HealthWatch Global",
    description: "Compare two disease outbreaks side by side — cases, deaths, fatality rate, and incidence per 100,000. WHO data updated every 6 hours.",
  },
  fr: {
    title: "Comparer des épidémies | HealthWatch Global",
    description: "Comparez deux foyers épidémiques côte à côte — cas, décès, létalité et incidence pour 100 000. Données OMS mises à jour toutes les 6h.",
  },
  es: {
    title: "Comparar brotes de enfermedades | HealthWatch Global",
    description: "Compare dos brotes de enfermedades en paralelo — casos, muertes, tasa de letalidad e incidencia por 100.000. Datos OMS actualizados cada 6 horas.",
  },
  ar: {
    title: "مقارنة تفشيات الأمراض | HealthWatch Global",
    description: "قارن بين تفشيين جنباً إلى جنب — الحالات والوفيات ومعدل الفتك والإصابة لكل 100,000. بيانات منظمة الصحة العالمية تُحدَّث كل 6 ساعات.",
  },
  id: {
    title: "Bandingkan Wabah Penyakit | HealthWatch Global",
    description: "Bandingkan dua wabah penyakit secara berdampingan — kasus, kematian, tingkat fatalitas, dan insidensi per 100.000. Data WHO diperbarui setiap 6 jam.",
  },
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
      languages: {
        en: "https://healthwatch-global.com/en/compare",
        fr: "https://healthwatch-global.com/fr/compare",
        es: "https://healthwatch-global.com/es/compare",
        ar: "https://healthwatch-global.com/ar/compare",
        id: "https://healthwatch-global.com/id/compare",
        "x-default": "https://healthwatch-global.com/en/compare",
      },
    },
    openGraph: {
      type: "website",
      url,
      title: m.title,
      description: m.description,
      siteName: "HealthWatch Global",
    },
    robots: { index: true, follow: true },
  };
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

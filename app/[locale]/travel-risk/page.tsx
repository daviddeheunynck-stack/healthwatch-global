import TravelRiskFullPage from "@/components/TravelRiskFullPage";
import type { Metadata } from "next";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

const TRAVEL_META: Record<string, { title: string; description: string }> = {
  en: {
    title: "Travel Health Risk Assessment | HealthWatch Global",
    description: "Check the epidemiological risk before traveling to any country. Continuously updated outbreak data from WHO, ECDC, PAHO and Africa CDC. Mpox, Ebola, Cholera, Dengue and more.",
  },
  fr: {
    title: "Risque santé voyage | HealthWatch Global",
    description: "Évaluez le risque épidémiologique avant de voyager dans n'importe quel pays. Données actualisées en continu OMS, ECDC, PAHO et Africa CDC. Mpox, Ebola, Choléra, Dengue.",
  },
  es: {
    title: "Riesgo sanitario de viaje | HealthWatch Global",
    description: "Evalúe el riesgo epidemiológico antes de viajar a cualquier país. Datos actualizados continuamente de OMS, ECDC, PAHO y Africa CDC. Mpox, Ébola, Cólera, Dengue y más.",
  },
  ar: {
    title: "تقييم المخاطر الصحية للسفر | HealthWatch Global",
    description: "قيّم المخاطر الوبائية قبل السفر إلى أي بلد. بيانات حية من منظمة الصحة العالمية وECDC وPAHO وAfrica CDC. جدري القردة وإيبولا والكوليرا وحمى الضنك.",
  },
  id: {
    title: "Penilaian Risiko Kesehatan Perjalanan | HealthWatch Global",
    description: "Periksa risiko epidemiologis sebelum bepergian ke negara mana pun. Data yang diperbarui berkelanjutan dari WHO, ECDC, PAHO, Africa CDC. Mpox, Ebola, Kolera, Dengue dan lainnya.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = TRAVEL_META[locale] ?? TRAVEL_META.en;
  const canonical = `https://healthwatch-global.com/${locale}/travel-risk`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/travel-risk`])
      ),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: "HealthWatch Global",
      locale: OG_LOCALE[locale] ?? "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default async function TravelRiskPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TravelRiskFullPage locale={locale} />;
}

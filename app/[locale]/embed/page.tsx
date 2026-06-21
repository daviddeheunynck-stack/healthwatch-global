import type { Metadata } from "next";
import EmbedClient from "./EmbedClient";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;

const META: Record<string, { title: string; description: string }> = {
  en: {
    title: "Embed the Outbreak Widget — HealthWatch Global",
    description: "Add a live WHO/ECDC/PAHO outbreak tracker to any website or intranet. One iframe, no API key, updated every hour.",
  },
  fr: {
    title: "Intégrer le widget épidémique — HealthWatch Global",
    description: "Ajoutez un suivi des foyers OMS/ECDC/PAHO en temps réel à n'importe quel site ou intranet. Un iframe, sans clé API, mis à jour toutes les heures.",
  },
  es: {
    title: "Insertar el widget de brotes — HealthWatch Global",
    description: "Añade un rastreador en vivo de brotes OMS/ECDC/PAHO a cualquier web o intranet. Un iframe, sin clave API, actualizado cada hora.",
  },
  ar: {
    title: "تضمين أداة التفشيات — HealthWatch Global",
    description: "أضف متتبعاً حياً لتفشيات منظمة الصحة العالمية/ECDC/PAHO إلى أي موقع أو شبكة داخلية. إطار واحد، بدون مفتاح API، يُحدَّث كل ساعة.",
  },
  id: {
    title: "Sematkan Widget Wabah — HealthWatch Global",
    description: "Tambahkan pelacak wabah WHO/ECDC/PAHO secara langsung ke website atau intranet. Satu iframe, tanpa kunci API, diperbarui setiap jam.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.en;
  const url = `https://healthwatch-global.com/${locale}/embed`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/embed`])),
        "x-default": "https://healthwatch-global.com/en/embed",
      },
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url,
      type: "website",
      siteName: "HealthWatch Global",
      images: [{ url: `https://healthwatch-global.com/api/og?locale=${locale}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: [`https://healthwatch-global.com/api/og?locale=${locale}`],
    },
    robots: { index: true, follow: true },
  };
}

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <EmbedClient locale={locale} />;
}

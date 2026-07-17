import type { Metadata } from "next";
import { jsonLdHtml } from "@/lib/json-ld";

const LOCALES = ["en", "fr", "es", "ar", "id"] as const;
const OG_LOCALE: Record<string, string> = {
  en: "en_US", fr: "fr_FR", es: "es_ES", ar: "ar_SA", id: "id_ID",
};

const META: Record<string, { title: string; description: string }> = {
  en: {
    title: "Institutional Pilot Program",
    description: "Free 35-day Pro access for up to 5 members of your health organization — NGO, UN agency, or ministry. Validate epidemic surveillance with your field teams.",
  },
  fr: {
    title: "Programme Pilote Institutionnel",
    description: "Accès Pro gratuit de 35 jours pour jusqu'à 5 membres de votre organisation — ONG, agence ONU ou ministère. Validez la surveillance épidémique avec vos équipes terrain.",
  },
  es: {
    title: "Programa Piloto Institucional",
    description: "Acceso Pro gratuito de 35 días para hasta 5 miembros de su organización — ONG, agencia ONU o ministerio. Valide la vigilancia epidémica con sus equipos de campo.",
  },
  ar: {
    title: "البرنامج التجريبي المؤسسي",
    description: "وصول مجاني لخطة Pro لمدة 35 يوماً لـ 5 أعضاء من مؤسستك — منظمة غير حكومية أو وكالة أممية أو وزارة. تحقق من مراقبة الأوبئة مع فرقك الميدانية.",
  },
  id: {
    title: "Program Pilot Institusional",
    description: "Akses Pro gratis 35 hari untuk hingga 5 anggota organisasi Anda — LSM, badan PBB, atau kementerian. Validasi pemantauan epidemi bersama tim lapangan Anda.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.en;
  const url = `https://healthwatch-global.com/${locale}/pilot`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `https://healthwatch-global.com/${l}/pilot`])),
        "x-default": "https://healthwatch-global.com/en/pilot",
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

export default async function PilotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const m = META[locale] ?? META.en;
  const url = `https://healthwatch-global.com/${locale}/pilot`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${m.title} | HealthWatch Global`,
    "description": m.description,
    "url": url,
    "mainEntity": {
      "@type": "Offer",
      "name": "Institutional Pilot Program",
      "description": "Free 35-day Pro access for up to 5 members of your health organization (NGO, UN agency, ministry). No credit card required.",
      "price": "0",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
      "validThrough": "2026-12-31",
      "seller": {
        "@type": "Organization",
        "name": "HealthWatch Global",
        "url": "https://healthwatch-global.com",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(schema) }}
      />
      {children}
    </>
  );
}

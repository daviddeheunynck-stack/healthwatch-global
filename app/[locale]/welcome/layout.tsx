import type { Metadata } from "next";

const TITLES: Record<string, string> = {
  en: "Choose your region", fr: "Choisissez votre région", es: "Elija su región",
  ar: "اختر منطقتك", id: "Pilih wilayah Anda",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: TITLES[locale] ?? TITLES.en,
    robots: { index: false, follow: false },
  };
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

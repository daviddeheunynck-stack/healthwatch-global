import type { Metadata } from "next";

const TITLES: Record<string, string> = {
  en: "Create Account", fr: "Créer un compte", es: "Crear cuenta", ar: "إنشاء حساب", id: "Buat Akun",
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

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

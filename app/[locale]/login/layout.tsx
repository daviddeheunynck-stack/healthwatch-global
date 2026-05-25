import type { Metadata } from "next";

const TITLES: Record<string, string> = {
  en: "Sign In", fr: "Connexion", es: "Iniciar sesión", ar: "تسجيل الدخول", id: "Masuk",
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

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

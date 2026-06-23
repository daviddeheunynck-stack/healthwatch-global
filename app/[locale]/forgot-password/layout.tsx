import type { Metadata } from "next";

const TITLES: Record<string, string> = {
  en: "Forgot Password",
  fr: "Mot de passe oublié",
  es: "Contraseña olvidada",
  ar: "نسيت كلمة المرور",
  id: "Lupa Kata Sandi",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: TITLES[locale] ?? TITLES.en,
    robots: { index: false, follow: false },
  };
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

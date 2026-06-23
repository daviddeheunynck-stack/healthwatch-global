import type { Metadata } from "next";

const TITLES: Record<string, string> = {
  en: "Set New Password",
  fr: "Définir un nouveau mot de passe",
  es: "Establecer nueva contraseña",
  ar: "تعيين كلمة مرور جديدة",
  id: "Atur Kata Sandi Baru",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: TITLES[locale] ?? TITLES.en,
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

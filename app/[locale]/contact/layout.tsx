import type { Metadata } from "next";

const META: Record<string, { title: string; description: string }> = {
  en: { title: "Contact", description: "Get in touch with the HealthWatch Global team for questions, partnerships or enterprise enquiries." },
  fr: { title: "Contact", description: "Contactez l'équipe HealthWatch Global pour toute question, partenariat ou demande entreprise." },
  es: { title: "Contacto", description: "Póngase en contacto con el equipo de HealthWatch Global para preguntas, asociaciones o consultas empresariales." },
  ar: { title: "تواصل معنا", description: "تواصل مع فريق HealthWatch Global لأي استفسارات أو شراكات أو طلبات مؤسسية." },
  id: { title: "Kontak", description: "Hubungi tim HealthWatch Global untuk pertanyaan, kemitraan, atau pertanyaan perusahaan." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.en;
  return { title: m.title, description: m.description };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from "next";

const META: Record<string, { title: string; description: string }> = {
  en: { title: "Email Alerts", description: "Subscribe to a free weekly digest of disease outbreaks for your region. Powered by WHO Disease Outbreak News." },
  fr: { title: "Alertes email", description: "Abonnez-vous à un digest hebdomadaire gratuit des foyers épidémiques de votre région. Alimenté par le bulletin OMS." },
  es: { title: "Alertas por email", description: "Suscríbase a un resumen semanal gratuito de brotes de enfermedades en su región. Impulsado por el boletín de la OMS." },
  ar: { title: "تنبيهات البريد الإلكتروني", description: "اشترك في ملخص أسبوعي مجاني لتفشي الأمراض في منطقتك. مدعوم من نشرة منظمة الصحة العالمية." },
  id: { title: "Peringatan Email", description: "Berlangganan digest mingguan gratis wabah penyakit di wilayah Anda. Didukung oleh WHO Disease Outbreak News." },
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

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

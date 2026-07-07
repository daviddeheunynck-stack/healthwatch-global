import type { Metadata } from "next";

const META: Record<string, { title: string; description: string }> = {
  en: { title: "Field Signal Channel", description: "Flag something unusual on the ground before it's formally confirmed." },
  fr: { title: "Canal de signal terrain", description: "Signalez quelque chose d'inhabituel sur le terrain avant confirmation formelle." },
  es: { title: "Canal de señal de campo", description: "Señala algo inusual sobre el terreno antes de la confirmación formal." },
  ar: { title: "قناة الإشارة الميدانية", description: "أبلغ عن شيء غير معتاد ميدانياً قبل التأكيد الرسمي." },
  id: { title: "Kanal Sinyal Lapangan", description: "Laporkan sesuatu yang tidak biasa di lapangan sebelum dikonfirmasi secara resmi." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.en;

  return {
    title: m.title,
    description: m.description,
    // Unlisted by design: this page is shared directly with specific trusted
    // contacts, not linked from nav/footer or promoted publicly.
    robots: { index: false, follow: false },
  };
}

export default function FieldSignalLayout({ children }: { children: React.ReactNode }) {
  return children;
}

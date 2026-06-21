"use client";

const LABELS: Record<string, string> = {
  fr: "Imprimer / Sauvegarder en PDF",
  en: "Print / Save as PDF",
  es: "Imprimir / Guardar como PDF",
  ar: "طباعة / حفظ PDF",
  id: "Cetak / Simpan PDF",
};

export default function SitrepPrintButton({ locale }: { locale: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      {LABELS[locale] ?? LABELS.en}
    </button>
  );
}

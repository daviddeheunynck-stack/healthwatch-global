// Purely presentational — no hooks, safe inside a server or a client
// component. Renders an abstract magnitude/severity cue, never a numeral
// that could be mistaken for a real reported figure. See
// lib/outbreaks.ts's magnitudeBand()/cfrSeverityBand() doc comment for why:
// the previous masking (round to the nearest power of 10) produced a
// plausible-but-fake number that existed as literal data in the API
// response and page text, not just a CSS blur — anyone extracting it and
// comparing it to the real, already-public-elsewhere figure would read the
// mismatch as a bug or a lie, not an intentional gate (David, 2026-09-06).

export function MagnitudeDots({ band, className = "" }: { band: number | null | undefined; className?: string }) {
  if (band === null || band === undefined) {
    return <span className={`text-gray-600 text-xs ${className}`}>—</span>;
  }
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= band ? "bg-gray-400" : "bg-gray-700"}`}
        />
      ))}
    </span>
  );
}

export type CfrSeverityBand = "low" | "moderate" | "high" | "very_high";

export const SEVERITY_LABEL: Record<string, Record<CfrSeverityBand, string>> = {
  fr: { low: "Faible", moderate: "Modérée", high: "Élevée", very_high: "Très élevée" },
  en: { low: "Low", moderate: "Moderate", high: "High", very_high: "Very high" },
  es: { low: "Baja", moderate: "Moderada", high: "Alta", very_high: "Muy alta" },
  ar: { low: "منخفضة", moderate: "متوسطة", high: "مرتفعة", very_high: "مرتفعة جداً" },
  id: { low: "Rendah", moderate: "Sedang", high: "Tinggi", very_high: "Sangat tinggi" },
};

export const SEVERITY_COLOR: Record<CfrSeverityBand, string> = {
  low: "text-gray-400",
  moderate: "text-amber-400",
  high: "text-red-400",
  very_high: "text-red-400",
};

export function SeverityWord({ band, locale, className = "" }: { band: CfrSeverityBand | null | undefined; locale: string; className?: string }) {
  if (!band) return <span className={`text-gray-600 text-xs ${className}`}>—</span>;
  const label = (SEVERITY_LABEL[locale] ?? SEVERITY_LABEL.en)[band];
  return <span className={`text-sm font-medium ${SEVERITY_COLOR[band]} ${className}`}>{label}</span>;
}

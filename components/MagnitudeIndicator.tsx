// Purely presentational — no hooks, safe inside a server or a client
// component. Renders an abstract magnitude/severity cue, never a numeral
// that could be mistaken for a real reported figure. See
// lib/outbreaks.ts's magnitudeBand()/cfrSeverityBand() doc comment for why:
// the previous masking (round to the nearest power of 10) produced a
// plausible-but-fake number that existed as literal data in the API
// response and page text, not just a CSS blur — anyone extracting it and
// comparing it to the real, already-public-elsewhere figure would read the
// mismatch as a bug or a lie, not an intentional gate (David, 2026-09-06).

// What the dots/word MEAN, in words. Until 2026-09-06 the mask rendered as
// five bare <span>s with no title, no aria-label and no text: a screen
// reader announced nothing at all for the "cases" cell of 96 of the 119
// rows, and a sighted visitor got an unexplained dot scale that reads as a
// broken page rather than as a gate. The product already writes this exact
// sentence — but only for machines, in the permalink page's meta
// description ("Magnitude 4/5 (exact figures for Pro subscribers)") and in
// /api/feed. This brings it to the surface a human can actually act on.
// Deliberately the same wording, not a new one.
const MASK_COPY: Record<string, { magnitude: (b: number) => string; severity: (label: string) => string; noData: string }> = {
  fr: { magnitude: (b) => `Ampleur ${b}/5 — chiffres exacts réservés aux abonnés Pro`,   severity: (l) => `Létalité ${l.toLowerCase()} — taux exact réservé aux abonnés Pro`, noData: "Donnée non disponible" },
  en: { magnitude: (b) => `Magnitude ${b}/5 — exact figures for Pro subscribers`,        severity: (l) => `${l} fatality — exact rate for Pro subscribers`,                    noData: "No data available" },
  es: { magnitude: (b) => `Magnitud ${b}/5 — cifras exactas para suscriptores Pro`,      severity: (l) => `Letalidad ${l.toLowerCase()} — tasa exacta para suscriptores Pro`, noData: "Dato no disponible" },
  ar: { magnitude: (b) => `الحجم ${b}/5 — الأرقام الدقيقة لمشتركي Pro`,                    severity: (l) => `الوفيات ${l} — النسبة الدقيقة لمشتركي Pro`,                          noData: "لا تتوفر بيانات" },
  id: { magnitude: (b) => `Magnitudo ${b}/5 — angka persis untuk pelanggan Pro`,         severity: (l) => `Kefatalan ${l.toLowerCase()} — angka persis untuk pelanggan Pro`,   noData: "Data tidak tersedia" },
};

const maskCopy = (locale?: string) => MASK_COPY[locale ?? "en"] ?? MASK_COPY.en;

export function MagnitudeDots({ band, locale, className = "" }: { band: number | null | undefined; locale?: string; className?: string }) {
  const c = maskCopy(locale);
  if (band === null || band === undefined) {
    return <span className={`text-gray-600 text-xs ${className}`} title={c.noData}>—</span>;
  }
  const label = c.magnitude(band);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} title={label} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden="true"
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
  const c = maskCopy(locale);
  if (!band) return <span className={`text-gray-600 text-xs ${className}`} title={c.noData}>—</span>;
  const label = (SEVERITY_LABEL[locale] ?? SEVERITY_LABEL.en)[band];
  // Unlike the dots, this one already renders a word, so it has an
  // accessible name — what it lacked was saying WHY a word stands where a
  // percentage does everywhere else.
  return <span className={`text-sm font-medium ${SEVERITY_COLOR[band]} ${className}`} title={c.severity(label)}>{label}</span>;
}

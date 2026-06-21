// Preliminary epidemic transmission metrics from snapshot time series.
// Uses Wallinga-Lipsitch 2007 exponential-growth approximation for Rt.
// Always label these as "preliminary estimates" in the UI.

export interface EpidemicMetrics {
  doublingTimeDays: number | null;
  halvingTimeDays:  number | null;
  dailyGrowthPct:   number | null;
  rtEstimate:       number | null;
  trend:            "growing" | "declining" | "stable" | "insufficient_data";
  basedOnDays:      number;
  serialIntervalDays: number;
  rtConfidence:     "insufficient" | "moderate" | "reliable" | null;
}

// Mean serial intervals (days) — conservative midpoints from published literature
const SERIAL_INTERVALS: Record<string, number> = {
  "Ebola":                 15,
  "Marburg":               9,
  "Mpox":                  9,
  "Monkeypox":             9,
  "Smallpox":              17,
  "Cholera":               5,
  "Measles":               12,
  "Rubella":               18,
  "Mumps":                 18,
  "Pertussis":             22,
  "Whooping Cough":        22,
  "Meningococcal":         5,
  "Plague":                3,
  "Yellow Fever":          7,
  "Dengue":                14,
  "COVID-19":              5,
  "MERS":                  7,
  "SARS":                  8,
  "Influenza":             3,
  "Lassa":                 14,
  "Rift Valley":           7,
  "Crimean-Congo":         7,
};

const DEFAULT_SI = 7;

export function getSerialInterval(diseaseEn?: string | null): number {
  if (!diseaseEn) return DEFAULT_SI;
  const key = Object.keys(SERIAL_INTERVALS).find(
    (k) => diseaseEn.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SERIAL_INTERVALS[key] : DEFAULT_SI;
}

export function computeEpidemicMetrics(
  snapshots: { snapped_at: string; cases: number }[],
  diseaseEn?: string | null,
): EpidemicMetrics {
  const NULL: EpidemicMetrics = {
    doublingTimeDays: null, halvingTimeDays: null,
    dailyGrowthPct:   null, rtEstimate:      null,
    trend:            "insufficient_data",
    basedOnDays:      0,
    serialIntervalDays: DEFAULT_SI,
    rtConfidence:     null,
  };

  const sorted = [...snapshots]
    .filter((s) => s.cases > 0)
    .sort((a, b) => new Date(a.snapped_at).getTime() - new Date(b.snapped_at).getTime());

  if (sorted.length < 2) return NULL;

  const first = sorted[0];
  const last  = sorted[sorted.length - 1];

  const daysDiff =
    (new Date(last.snapped_at).getTime() - new Date(first.snapped_at).getTime()) / 86_400_000;

  // Need at least 3 days and 5 initial cases for a meaningful estimate
  if (daysDiff < 3 || first.cases < 5 || last.cases < 5) return NULL;

  // Instantaneous growth rate via log-linear (continuous-time exponential model)
  const r = Math.log(last.cases / first.cases) / daysDiff;

  const dailyGrowthPct = parseFloat(((Math.exp(r) - 1) * 100).toFixed(1));
  const si = getSerialInterval(diseaseEn);

  // Wallinga-Lipsitch 2007: Rt ≈ e^(r × T_serial)
  // Valid for exponential phase only; overestimates Rt near the peak
  const rtEstimate = parseFloat(Math.exp(r * si).toFixed(2));

  const basedOnDays = Math.round(daysDiff);

  const daysSinceLastSnap = (Date.now() - new Date(last.snapped_at).getTime()) / 86_400_000;
  const rtConfidence: "insufficient" | "moderate" | "reliable" =
    sorted.length >= 15 && basedOnDays >= 14 && daysSinceLastSnap <= 14
      ? "reliable"
      : sorted.length >= 5 && basedOnDays >= 7
      ? "moderate"
      : "insufficient";

  if (r > 0.02) {
    return {
      doublingTimeDays:   parseFloat((Math.LN2 / r).toFixed(1)),
      halvingTimeDays:    null,
      dailyGrowthPct,
      rtEstimate,
      trend:              "growing",
      basedOnDays,
      serialIntervalDays: si,
      rtConfidence,
    };
  }

  if (r < -0.02) {
    return {
      doublingTimeDays:   null,
      halvingTimeDays:    parseFloat((Math.LN2 / Math.abs(r)).toFixed(1)),
      dailyGrowthPct,
      rtEstimate,
      trend:              "declining",
      basedOnDays,
      serialIntervalDays: si,
      rtConfidence,
    };
  }

  return {
    doublingTimeDays:   null,
    halvingTimeDays:    null,
    dailyGrowthPct,
    rtEstimate:         1.0,
    trend:              "stable",
    basedOnDays,
    serialIntervalDays: si,
    rtConfidence,
  };
}

// WHO WUENIC 2023 approximate immunization coverage estimates
// Used in OutbreakDetailModal to show vaccination context per disease + country

export interface VaccineCoverageEntry {
  vaccine: string;
  label: Record<string, string>;
  coverage: number;
  year: number;
}

const VACCINE_LABELS: Record<string, Record<string, string>> = {
  MCV1: { en: "Measles (MCV1)", fr: "Rougeole (VOR1)", es: "Sarampión (VAS1)", ar: "الحصبة (MCV1)", id: "Campak (MCV1)" },
  IPV:  { en: "Polio (IPV)",    fr: "Polio (VPI)",     es: "Polio (VIP)",      ar: "شلل الأطفال (IPV)", id: "Polio (IPV)" },
  YFV:  { en: "Yellow fever",   fr: "Fièvre jaune",    es: "Fiebre amarilla",  ar: "الحمى الصفراء",  id: "Demam kuning" },
  OCV:  { en: "Cholera (OCV)",  fr: "Choléra (CVO)",   es: "Cólera (OCV)",     ar: "الكوليرا (OCV)", id: "Kolera (OCV)" },
  TCV:  { en: "Typhoid (TCV)",  fr: "Typhoïde (VCT)",  es: "Tifoidea (TCV)",   ar: "التيفوئيد (TCV)", id: "Tifoid (TCV)" },
  MenA: { en: "Meningitis (MenA)", fr: "Méningite (MenA)", es: "Meningitis (MenA)", ar: "التهاب السحايا (MenA)", id: "Meningitis (MenA)" },
  HepB: { en: "Hepatitis B",    fr: "Hépatite B",      es: "Hepatitis B",      ar: "التهاب الكبد B", id: "Hepatitis B" },
};

// disease_en pattern → vaccine key
const DISEASE_VACCINE_MAP: Array<[RegExp, string]> = [
  [/measles|rougeole|saramp/i,  "MCV1"],
  [/polio/i,                     "IPV"],
  [/yellow.?fever|fi.vre.?jaune|fiebre.?amarilla/i, "YFV"],
  [/cholera|chol.ra/i,           "OCV"],
  [/typhoid|typho.de|tifoid/i,   "TCV"],
  [/meningit/i,                  "MenA"],
  [/hepatitis.?b/i,              "HepB"],
];

// WHO WUENIC 2023 — national estimates (%)
// null = no routine vaccine or no country data
type CovMap = Record<string, number | null>;

const COVERAGE: Record<string, CovMap> = {
  // ── SEARO ──────────────────────────────────────────────────────────────────
  "India":        { MCV1: 95, IPV: 95, YFV: null, OCV: null, TCV: 47,   MenA: null, HepB: 89 },
  "Indonesia":    { MCV1: 85, IPV: 86, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 82 },
  "Bangladesh":   { MCV1: 98, IPV: 98, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 98 },
  "Myanmar":      { MCV1: 89, IPV: 90, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 87 },
  "Thailand":     { MCV1: 99, IPV: 99, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 99 },
  "Nepal":        { MCV1: 93, IPV: 93, YFV: null, OCV: null, TCV: 75,   MenA: null, HepB: 92 },
  "Sri Lanka":    { MCV1: 99, IPV: 99, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 99 },
  "Timor-Leste":  { MCV1: 68, IPV: 68, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 66 },
  "Bhutan":       { MCV1: 97, IPV: 97, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 97 },
  "Maldives":     { MCV1: 99, IPV: 99, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 99 },
  // ── Africa ─────────────────────────────────────────────────────────────────
  "Nigeria":      { MCV1: 57, IPV: 66, YFV: 52, OCV: null, TCV: null, MenA: 68, HepB: 61 },
  "Democratic Republic of the Congo": { MCV1: 63, IPV: 72, YFV: 51, OCV: 45, TCV: null, MenA: null, HepB: 68 },
  "Ethiopia":     { MCV1: 62, IPV: 74, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 65 },
  "Kenya":        { MCV1: 83, IPV: 87, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 84 },
  "Tanzania":     { MCV1: 92, IPV: 95, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 92 },
  "Uganda":       { MCV1: 94, IPV: 91, YFV: 76,   OCV: null, TCV: null, MenA: null, HepB: 88 },
  "Ghana":        { MCV1: 95, IPV: 95, YFV: 92,   OCV: null, TCV: null, MenA: 85,   HepB: 95 },
  "Guinea":       { MCV1: 50, IPV: 64, YFV: 55,   OCV: null, TCV: null, MenA: null, HepB: 61 },
  "Sierra Leone": { MCV1: 92, IPV: 85, YFV: 87,   OCV: null, TCV: null, MenA: null, HepB: 87 },
  "Liberia":      { MCV1: 81, IPV: 80, YFV: 68,   OCV: null, TCV: null, MenA: null, HepB: 79 },
  "Cameroon":     { MCV1: 70, IPV: 78, YFV: 68,   OCV: null, TCV: null, MenA: 74,   HepB: 73 },
  "Mali":         { MCV1: 63, IPV: 70, YFV: 62,   OCV: null, TCV: null, MenA: 78,   HepB: 67 },
  "Burkina Faso": { MCV1: 87, IPV: 85, YFV: 75,   OCV: null, TCV: null, MenA: 91,   HepB: 84 },
  "Niger":        { MCV1: 63, IPV: 67, YFV: 56,   OCV: null, TCV: null, MenA: 72,   HepB: 66 },
  "Chad":         { MCV1: 48, IPV: 59, YFV: null, OCV: null, TCV: null, MenA: 55,   HepB: 52 },
  "Madagascar":   { MCV1: 62, IPV: 67, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 67 },
  "Mozambique":   { MCV1: 84, IPV: 84, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 81 },
  "Zimbabwe":     { MCV1: 88, IPV: 89, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 88 },
  "Zambia":       { MCV1: 86, IPV: 87, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 85 },
  "Malawi":       { MCV1: 83, IPV: 90, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 84 },
  "Sudan":        { MCV1: 71, IPV: 75, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 78 },
  "South Sudan":  { MCV1: 40, IPV: 48, YFV: 55,   OCV: null, TCV: null, MenA: null, HepB: 43 },
  "Somalia":      { MCV1: 38, IPV: 46, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 42 },
  "Senegal":      { MCV1: 82, IPV: 93, YFV: 85,   OCV: null, TCV: null, MenA: 89,   HepB: 88 },
  "Ivory Coast":  { MCV1: 78, IPV: 79, YFV: 77,   OCV: null, TCV: null, MenA: null, HepB: 76 },
  "Central African Republic": { MCV1: 46, IPV: 55, YFV: 43, OCV: null, TCV: null, MenA: null, HepB: 52 },
  "South Africa": { MCV1: 82, IPV: 73, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 82 },
  // ── Middle East / South Asia ────────────────────────────────────────────────
  "Yemen":        { MCV1: 66, IPV: 67, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 67 },
  "Syria":        { MCV1: 52, IPV: 59, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 54 },
  "Afghanistan":  { MCV1: 65, IPV: 69, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 69 },
  "Pakistan":     { MCV1: 80, IPV: 82, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 80 },
  "Iraq":         { MCV1: 87, IPV: 86, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 85 },
  // ── Asia Pacific ────────────────────────────────────────────────────────────
  "China":        { MCV1: 99, IPV: 99, YFV: null, OCV: null, TCV: null, MenA: 99,   HepB: 99 },
  "Philippines":  { MCV1: 79, IPV: 83, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 81 },
  "Vietnam":      { MCV1: 97, IPV: 97, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 97 },
  "Cambodia":     { MCV1: 93, IPV: 95, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 94 },
  "Papua New Guinea": { MCV1: 67, IPV: 73, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 71 },
  // ── Americas ────────────────────────────────────────────────────────────────
  "Brazil":       { MCV1: 79, IPV: 98, YFV: 77,   OCV: null, TCV: null, MenA: null, HepB: 98 },
  "Colombia":     { MCV1: 87, IPV: 89, YFV: 70,   OCV: null, TCV: null, MenA: null, HepB: 87 },
  "Peru":         { MCV1: 91, IPV: 91, YFV: 78,   OCV: null, TCV: null, MenA: null, HepB: 90 },
  "Bolivia":      { MCV1: 79, IPV: 85, YFV: 71,   OCV: null, TCV: null, MenA: null, HepB: 81 },
  "Venezuela":    { MCV1: 74, IPV: 85, YFV: 61,   OCV: null, TCV: null, MenA: null, HepB: 84 },
  "Haiti":        { MCV1: 60, IPV: 64, YFV: null, OCV: 62,   TCV: null, MenA: null, HepB: 61 },
  // ── Europe ──────────────────────────────────────────────────────────────────
  "Ukraine":      { MCV1: 83, IPV: 82, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 84 },
  "Russia":       { MCV1: 97, IPV: 97, YFV: null, OCV: null, TCV: null, MenA: null, HepB: 96 },
};

export const COVERAGE_YEAR = 2023;
export const COVERAGE_SOURCE = "WHO WUENIC";

export function getVaccineCoverage(
  diseaseEn: string | null | undefined,
  countryEn: string | null | undefined
): VaccineCoverageEntry | null {
  if (!diseaseEn || !countryEn) return null;
  const countryData = COVERAGE[countryEn];
  if (!countryData) return null;

  let vaccineKey: string | null = null;
  for (const [pattern, key] of DISEASE_VACCINE_MAP) {
    if (pattern.test(diseaseEn)) { vaccineKey = key; break; }
  }
  if (!vaccineKey) return null;

  const pct = countryData[vaccineKey];
  if (pct === null || pct === undefined) return null;

  return {
    vaccine: vaccineKey,
    label: VACCINE_LABELS[vaccineKey] ?? { en: vaccineKey, fr: vaccineKey, es: vaccineKey, ar: vaccineKey, id: vaccineKey },
    coverage: pct,
    year: COVERAGE_YEAR,
  };
}

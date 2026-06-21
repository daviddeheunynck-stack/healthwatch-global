/**
 * WHO Joint External Evaluation (JEE) capacity data.
 * Scores 1–5 per domain: 1=None, 2=Limited, 3=Developed, 4=Demonstrated, 5=Sustainable.
 * Source: WHO JEE published reports (public domain). Scores are approximate averages
 * across sub-indicators for each domain.
 */
export interface JEEProfile {
  country_en:         string;
  jee_year:           number;
  surveillance:       number; // P2/D1 surveillance capacity
  laboratory:         number; // D1 laboratory system
  emergency_response: number; // R4 emergency response operations
  icu_per_100k?:      number; // ICU beds per 100 000 pop. (World Bank / ECDC)
}

const JEE: JEEProfile[] = [
  // ── Africa ────────────────────────────────────────────────────────────────
  { country_en: "Democratic Republic of the Congo", jee_year: 2022, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.3 },
  { country_en: "Nigeria",             jee_year: 2022, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 1.0 },
  { country_en: "Ethiopia",            jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.3 },
  { country_en: "Senegal",             jee_year: 2023, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 0.7 },
  { country_en: "Ghana",               jee_year: 2017, surveillance: 2, laboratory: 3, emergency_response: 2, icu_per_100k: 0.9 },
  { country_en: "Guinea",              jee_year: 2017, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.4 },
  { country_en: "Sierra Leone",        jee_year: 2017, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.4 },
  { country_en: "Liberia",             jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.4 },
  { country_en: "South Africa",        jee_year: 2021, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 9.0 },
  { country_en: "Kenya",               jee_year: 2017, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 1.4 },
  { country_en: "Tanzania",            jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.6 },
  { country_en: "Uganda",              jee_year: 2017, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.8 },
  { country_en: "Cameroon",            jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.5 },
  { country_en: "Côte d'Ivoire",       jee_year: 2022, surveillance: 2, laboratory: 3, emergency_response: 2, icu_per_100k: 0.6 },
  { country_en: "Burkina Faso",        jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.4 },
  { country_en: "Mali",                jee_year: 2018, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.4 },
  { country_en: "Niger",               jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 1, icu_per_100k: 0.3 },
  { country_en: "Chad",                jee_year: 2016, surveillance: 1, laboratory: 1, emergency_response: 1, icu_per_100k: 0.2 },
  { country_en: "Central African Republic", jee_year: 2017, surveillance: 1, laboratory: 1, emergency_response: 1, icu_per_100k: 0.2 },
  { country_en: "South Sudan",         jee_year: 2017, surveillance: 1, laboratory: 1, emergency_response: 1, icu_per_100k: 0.2 },
  { country_en: "Somalia",             jee_year: 2017, surveillance: 1, laboratory: 1, emergency_response: 1, icu_per_100k: 0.2 },
  { country_en: "Sudan",               jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 1, icu_per_100k: 0.4 },
  { country_en: "Zimbabwe",            jee_year: 2019, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.7 },
  { country_en: "Mozambique",          jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 1, icu_per_100k: 0.4 },
  { country_en: "Madagascar",          jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 1, icu_per_100k: 0.4 },
  { country_en: "Morocco",             jee_year: 2021, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 3.6 },
  { country_en: "Egypt",               jee_year: 2022, surveillance: 3, laboratory: 3, emergency_response: 2, icu_per_100k: 5.0 },

  // ── Asia ──────────────────────────────────────────────────────────────────
  { country_en: "India",               jee_year: 2019, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 2.3 },
  { country_en: "Pakistan",            jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 1.2 },
  { country_en: "Bangladesh",          jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.9 },
  { country_en: "Afghanistan",         jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 1, icu_per_100k: 0.5 },
  { country_en: "Indonesia",           jee_year: 2017, surveillance: 2, laboratory: 3, emergency_response: 2, icu_per_100k: 2.7 },
  { country_en: "Philippines",         jee_year: 2019, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 2.1 },
  { country_en: "Vietnam",             jee_year: 2019, surveillance: 3, laboratory: 3, emergency_response: 2, icu_per_100k: 4.4 },
  { country_en: "Myanmar",             jee_year: 2017, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.8 },
  { country_en: "Cambodia",            jee_year: 2017, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 1.8 },
  { country_en: "Thailand",            jee_year: 2017, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 7.6 },
  { country_en: "Laos",                jee_year: 2017, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.8 },
  { country_en: "Nepal",               jee_year: 2016, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 1.0 },
  { country_en: "Iraq",                jee_year: 2022, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 3.5 },
  { country_en: "Yemen",               jee_year: 2016, surveillance: 1, laboratory: 1, emergency_response: 1, icu_per_100k: 0.6 },

  // ── Americas ──────────────────────────────────────────────────────────────
  { country_en: "Haiti",               jee_year: 2017, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 0.7 },
  { country_en: "Venezuela",           jee_year: 2020, surveillance: 2, laboratory: 2, emergency_response: 2, icu_per_100k: 1.8 },
  { country_en: "Colombia",            jee_year: 2018, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 5.1 },
  { country_en: "Brazil",              jee_year: 2022, surveillance: 4, laboratory: 4, emergency_response: 3, icu_per_100k: 6.9 },
  { country_en: "Peru",                jee_year: 2019, surveillance: 3, laboratory: 3, emergency_response: 2, icu_per_100k: 2.6 },
  { country_en: "Mexico",              jee_year: 2016, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 3.7 },
  { country_en: "Ecuador",             jee_year: 2017, surveillance: 2, laboratory: 3, emergency_response: 2, icu_per_100k: 2.0 },

  // ── Europe ────────────────────────────────────────────────────────────────
  { country_en: "France",              jee_year: 2016, surveillance: 4, laboratory: 4, emergency_response: 4, icu_per_100k: 17.0 },
  { country_en: "United Kingdom",      jee_year: 2017, surveillance: 4, laboratory: 4, emergency_response: 4, icu_per_100k: 10.5 },
  { country_en: "Germany",             jee_year: 2016, surveillance: 5, laboratory: 5, emergency_response: 4, icu_per_100k: 33.9 },
  { country_en: "Ukraine",             jee_year: 2019, surveillance: 3, laboratory: 3, emergency_response: 3, icu_per_100k: 8.9 },
];

export function getJEEProfile(countryEn: string | null | undefined): JEEProfile | null {
  if (!countryEn) return null;
  return JEE.find((j) => j.country_en.toLowerCase() === countryEn.toLowerCase()) ?? null;
}

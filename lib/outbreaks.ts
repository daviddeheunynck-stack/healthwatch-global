import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "./disease-data";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function getServerClient() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export interface Outbreak {
  id: string;
  disease: string;
  disease_en: string | null;
  disease_ar: string | null;
  country: string;
  country_en: string | null;
  country_ar: string | null;
  region: string;
  lat: number;
  lng: number;
  cases: number;
  deaths: number;
  risk_level: "high" | "medium" | "low";
  date: string;
  source: string;
  description:    string;
  description_fr: string | null;
  description_es: string | null;
  description_ar: string | null;
  description_id: string | null;
  active: boolean;
  is_pheic:      boolean;       // Public Health Emergency of International Concern
  updated_at:    string | null; // last sync timestamp
  created_at:    string | null; // first insertion timestamp
}

export async function getLastSync(): Promise<string | null> {
  const supabase = getServerClient();

  const { data } = await supabase
    .from("outbreaks")
    .select("updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  return data?.updated_at ?? null;
}

export async function getOutbreaks(): Promise<Outbreak[]> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from("outbreaks")
    .select("*")
    .eq("active", true)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching outbreaks:", error);
    return [];
  }

  // Deduplicate: keep only the most recent entry per (disease, country) pair.
  // Use normalizeDisease so "Dengue" and "Dengue fever" hash to the same canonical
  // name_en ("Dengue fever"), preventing the same outbreak from appearing twice.
  const seen = new Set<string>();
  return (data || []).filter((o) => {
    const diseaseKey = normalizeDisease(o.disease_en || o.disease).name_en.toLowerCase();
    const countryKey = (o.country_en || o.country).toLowerCase();
    const key = `${diseaseKey}|${countryKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Disease name translations ─────────────────────────────────────────────────
// FR translations are now handled directly by normalizeDisease().name_fr
// (see getLocalizedDisease below). DISEASE_ES and DISEASE_ID provide
// additional lookup for ES and ID locales beyond what DISEASE_MAP covers.

const DISEASE_ES: Record<string, string> = {
  "Dengue": "Dengue",
  "Dengue fever": "Fiebre del dengue",
  "Mpox": "Mpox",
  "Monkeypox": "Viruela del mono",
  "Ebola": "Ébola",
  "Ebola virus disease": "Enfermedad por virus del Ébola",
  "Marburg virus disease": "Enfermedad por virus de Marburg",
  "Cholera": "Cólera",
  "Yellow fever": "Fiebre amarilla",
  "Lassa fever": "Fiebre de Lassa",
  "Rift Valley fever": "Fiebre del Valle del Rift",
  "Crimean-Congo haemorrhagic fever": "Fiebre hemorrágica de Crimea-Congo",
  "Meningitis": "Meningitis",
  "Meningococcal meningitis": "Meningitis meningocócica",
  "Measles": "Sarampión",
  "Poliomyelitis": "Poliomielitis",
  "Polio": "Poliomielitis",
  "Influenza": "Gripe",
  "Influenza A(H5N1)": "Gripe A(H5N1)",
  "Avian influenza": "Gripe aviar",
  "Avian Influenza": "Gripe aviar",
  "COVID-19": "COVID-19",
  "Plague": "Peste",
  "Typhoid fever": "Fiebre tifoidea",
  "Anthrax": "Carbunco",
  "Rabies": "Rabia",
  "Chikungunya": "Chikungunya",
  "Zika": "Zika",
  "Zika virus": "Virus del Zika",
  "Zika virus disease": "Enfermedad por virus del Zika",
  "Middle East Respiratory Syndrome": "MERS-CoV",
  "MERS-CoV": "MERS-CoV",
  "Nipah virus": "Virus Nipah",
  "Malaria": "Malaria",
  "Hepatitis": "Hepatitis",
  "Diphtheria": "Difteria",
  "Pertussis": "Tos ferina",
  "Hantavirus": "Hantavirus",
  "Leishmaniasis": "Leishmaniosis",
  "Trypanosomiasis": "Tripanosomiasis",
};

const DISEASE_ID: Record<string, string> = {
  "Dengue": "Demam Berdarah",
  "Dengue fever": "Demam Berdarah Dengue",
  "Mpox": "Mpox",
  "Monkeypox": "Cacar Monyet",
  "Ebola": "Ebola",
  "Ebola virus disease": "Penyakit Virus Ebola",
  "Marburg virus disease": "Penyakit Virus Marburg",
  "Cholera": "Kolera",
  "Yellow fever": "Demam Kuning",
  "Lassa fever": "Demam Lassa",
  "Rift Valley fever": "Demam Lembah Rift",
  "Crimean-Congo haemorrhagic fever": "Demam Berdarah Krimea-Kongo",
  "Meningitis": "Meningitis",
  "Meningococcal meningitis": "Meningitis Meningokokal",
  "Measles": "Campak",
  "Poliomyelitis": "Poliomielitis",
  "Polio": "Polio",
  "Influenza": "Influenza",
  "Avian influenza": "Flu Burung",
  "Avian Influenza": "Flu Burung",
  "COVID-19": "COVID-19",
  "Plague": "Pes",
  "Typhoid fever": "Demam Tifoid",
  "Anthrax": "Antraks",
  "Rabies": "Rabies",
  "Chikungunya": "Chikungunya",
  "Zika": "Zika",
  "Zika virus": "Virus Zika",
  "Zika virus disease": "Penyakit Virus Zika",
  "Middle East Respiratory Syndrome": "MERS-CoV",
  "MERS-CoV": "MERS-CoV",
  "Nipah virus": "Virus Nipah",
  "Malaria": "Malaria",
  "Hepatitis": "Hepatitis",
  "Diphtheria": "Difteri",
  "Pertussis": "Batuk Rejan",
  "Hantavirus": "Hantavirus",
  "Leishmaniasis": "Leishmaniasis",
  "Trypanosomiasis": "Tripanosomiasis",
};

// Structural field-sets for the localization helpers below — they each touch
// only a handful of Outbreak columns. Accepting the narrow shape (rather than
// the full Outbreak) lets cron jobs that SELECT a lean column subset (for
// efficiency — see app/api/cron/disease-alerts and watchlist-alerts) pass
// their rows straight through with real structural type-safety and no `any`;
// every existing caller already passes a full Outbreak, which trivially
// satisfies these narrower Picks too.
type LocalizedDiseaseFields = Pick<Outbreak, "disease" | "disease_en" | "disease_ar">;
type LocalizedCountryFields = Pick<Outbreak, "country" | "country_en" | "country_ar">;

export function getLocalizedDisease(outbreak: LocalizedDiseaseFields, locale: string): string {
  // Normalize through the same DISEASE_MAP the parser uses.
  // disease_en is the preferred key (English, already normalized).
  // Fallback: disease column (French for new records, English for legacy).
  // This ensures "Dengue" and "Dengue fever" resolve to the same canonical names.
  const info = normalizeDisease(outbreak.disease_en || outbreak.disease);
  if (locale === "fr") return info.name_fr;
  if (locale === "ar") return outbreak.disease_ar || info.name_ar;
  if (locale === "es") return info.name_es;
  if (locale === "id") return info.name_id;
  return info.name_en;
}

// ── Description localization ──────────────────────────────────────────────────
// Returns the translated description if available in DB, otherwise falls back
// to the English description (source: WHO DON article).
// Translations are populated by the sync cron via DeepL API.
export function getLocalizedDescription(outbreak: Outbreak, locale: string): string {
  if (locale === "fr" && outbreak.description_fr) return outbreak.description_fr;
  if (locale === "es" && outbreak.description_es) return outbreak.description_es;
  if (locale === "ar" && outbreak.description_ar) return outbreak.description_ar;
  if (locale === "id" && outbreak.description_id) return outbreak.description_id;
  return outbreak.description; // fallback to EN
}

// ── Country name translations ─────────────────────────────────────────────────
// WHO stores country names in English. Translate the most common outbreak
// locations so FR / ES / ID users never see English country names.
const COUNTRY_FR: Record<string, string> = {
  "Afghanistan": "Afghanistan", "Algeria": "Algérie", "Angola": "Angola",
  "Argentina": "Argentine", "Bangladesh": "Bangladesh", "Bolivia": "Bolivie",
  "Brazil": "Brésil", "Burkina Faso": "Burkina Faso", "Burundi": "Burundi",
  "Cambodia": "Cambodge", "Cameroon": "Cameroun",
  "Central African Republic": "République centrafricaine", "Chad": "Tchad",
  "China": "Chine", "Colombia": "Colombie", "Comoros": "Comores",
  "Congo": "Congo", "Côte d'Ivoire": "Côte d'Ivoire", "Ivory Coast": "Côte d'Ivoire",
  "Democratic Republic of the Congo": "République démocratique du Congo",
  "Democratic Republic of Congo": "République démocratique du Congo",
  "DRC": "RDC", "Ecuador": "Équateur", "Egypt": "Égypte",
  "Equatorial Guinea": "Guinée équatoriale", "Eritrea": "Érythrée",
  "Ethiopia": "Éthiopie", "Gabon": "Gabon", "Gambia": "Gambie", "Ghana": "Ghana",
  "Guinea": "Guinée", "Guinea-Bissau": "Guinée-Bissau", "Haiti": "Haïti",
  "India": "Inde", "Indonesia": "Indonésie", "Iran": "Iran", "Iraq": "Irak",
  "Jordan": "Jordanie", "Kenya": "Kenya", "Lebanon": "Liban",
  "Liberia": "Libéria", "Libya": "Libye", "Madagascar": "Madagascar",
  "Malawi": "Malawi", "Malaysia": "Malaisie", "Mali": "Mali",
  "Mauritania": "Mauritanie", "Mexico": "Mexique", "Morocco": "Maroc",
  "Mozambique": "Mozambique", "Myanmar": "Myanmar", "Nepal": "Népal",
  "Niger": "Niger", "Nigeria": "Nigéria", "Pakistan": "Pakistan",
  "Papua New Guinea": "Papouasie-Nouvelle-Guinée", "Peru": "Pérou",
  "Philippines": "Philippines", "Rwanda": "Rwanda",
  "Saudi Arabia": "Arabie saoudite", "Senegal": "Sénégal",
  "Sierra Leone": "Sierra Leone", "Somalia": "Somalie",
  "South Africa": "Afrique du Sud", "South Sudan": "Soudan du Sud",
  "Sudan": "Soudan", "Syria": "Syrie", "Tanzania": "Tanzanie",
  "Thailand": "Thaïlande", "Togo": "Togo", "Tunisia": "Tunisie",
  "Turkey": "Turquie", "Türkiye": "Turquie", "Uganda": "Ouganda",
  "Ukraine": "Ukraine", "United Kingdom": "Royaume-Uni",
  "United States": "États-Unis", "United States of America": "États-Unis",
  "Venezuela": "Venezuela", "Viet Nam": "Viêt Nam", "Vietnam": "Viêt Nam",
  "Yemen": "Yémen", "Zambia": "Zambie", "Zimbabwe": "Zimbabwe",
};

const COUNTRY_ES: Record<string, string> = {
  "Afghanistan": "Afganistán", "Algeria": "Argelia", "Angola": "Angola",
  "Argentina": "Argentina", "Bangladesh": "Bangladés", "Bolivia": "Bolivia",
  "Brazil": "Brasil", "Burkina Faso": "Burkina Faso", "Burundi": "Burundi",
  "Cambodia": "Camboya", "Cameroon": "Camerún",
  "Central African Republic": "República Centroafricana", "Chad": "Chad",
  "China": "China", "Colombia": "Colombia", "Comoros": "Comoras",
  "Congo": "Congo", "Côte d'Ivoire": "Costa de Marfil", "Ivory Coast": "Costa de Marfil",
  "Democratic Republic of the Congo": "República Democrática del Congo",
  "Democratic Republic of Congo": "República Democrática del Congo",
  "DR Congo": "República Democrática del Congo",   // exact country_en from geo-data.ts
  "Ecuador": "Ecuador", "Egypt": "Egipto", "Equatorial Guinea": "Guinea Ecuatorial",
  "Ethiopia": "Etiopía", "Gabon": "Gabón", "Gambia": "Gambia", "Ghana": "Ghana",
  "Guinea": "Guinea", "Guinea-Bissau": "Guinea-Bisáu", "Haiti": "Haití",
  "India": "India", "Indonesia": "Indonesia", "Iran": "Irán", "Iraq": "Irak",
  "Jordan": "Jordania", "Kenya": "Kenia", "Lebanon": "Líbano",
  "Liberia": "Liberia", "Libya": "Libia", "Madagascar": "Madagascar",
  "Malaysia": "Malasia", "Mali": "Malí", "Mauritania": "Mauritania",
  "Mexico": "México", "Morocco": "Marruecos", "Mozambique": "Mozambique",
  "Myanmar": "Myanmar", "Nepal": "Nepal", "Niger": "Níger", "Nigeria": "Nigeria",
  "Pakistan": "Pakistán", "Papua New Guinea": "Papúa Nueva Guinea",
  "Peru": "Perú", "Philippines": "Filipinas", "Rwanda": "Ruanda",
  "Saudi Arabia": "Arabia Saudita", "Senegal": "Senegal",
  "Sierra Leone": "Sierra Leona", "Somalia": "Somalia",
  "South Africa": "Sudáfrica", "South Sudan": "Sudán del Sur",
  "Sudan": "Sudán", "Syria": "Siria", "Tanzania": "Tanzania",
  "Thailand": "Tailandia", "Togo": "Togo", "Tunisia": "Túnez",
  "Turkey": "Turquía", "Türkiye": "Turquía", "Uganda": "Uganda",
  "United Kingdom": "Reino Unido", "United States": "Estados Unidos",
  "United States of America": "Estados Unidos", "Venezuela": "Venezuela",
  "Viet Nam": "Vietnam", "Vietnam": "Vietnam",
  "Yemen": "Yemen", "Zambia": "Zambia", "Zimbabwe": "Zimbabue",
};

const COUNTRY_ID: Record<string, string> = {
  "Cameroon": "Kamerun", "Central African Republic": "Republik Afrika Tengah",
  "China": "Tiongkok", "Côte d'Ivoire": "Pantai Gading", "Ivory Coast": "Pantai Gading",
  "Democratic Republic of the Congo": "Republik Demokratik Kongo",
  "Democratic Republic of Congo": "Republik Demokratik Kongo",
  "DR Congo": "Republik Demokratik Kongo",   // exact country_en from geo-data.ts
  "Egypt": "Mesir", "Ethiopia": "Etiopia", "Germany": "Jerman",
  "India": "India", "Iran": "Iran", "Iraq": "Irak", "Japan": "Jepang",
  "Jordan": "Yordania", "Lebanon": "Lebanon", "Libya": "Libya",
  "Morocco": "Maroko", "Netherlands": "Belanda", "Philippines": "Filipina",
  "Saudi Arabia": "Arab Saudi", "South Africa": "Afrika Selatan",
  "South Sudan": "Sudan Selatan", "Sudan": "Sudan", "Syria": "Suriah",
  "Thailand": "Thailand", "Tunisia": "Tunisia", "Turkey": "Turki",
  "Türkiye": "Turki", "United Kingdom": "Inggris",
  "United States": "Amerika Serikat", "United States of America": "Amerika Serikat",
  "Viet Nam": "Vietnam", "Vietnam": "Vietnam", "Yemen": "Yaman",
};

export function getLocalizedCountry(outbreak: LocalizedCountryFields, locale: string): string {
  // The `country` column stores the French name directly (from findCountry().name_fr).
  // For FR: return it as-is. For legacy rows where country might be English, try COUNTRY_FR.
  if (locale === "fr") {
    return COUNTRY_FR[outbreak.country] ?? outbreak.country;
  }
  const en = outbreak.country_en || outbreak.country;
  if (locale === "ar") return outbreak.country_ar || en;
  if (locale === "es") return COUNTRY_ES[en] ?? en;
  if (locale === "id") return COUNTRY_ID[en] ?? en;
  return en; // en = default
}

export function getStats(outbreaks: Outbreak[]) {
  const activeOutbreaks   = outbreaks.length;
  const countriesAffected = new Set(outbreaks.map((o) => o.country)).size;
  const highRisk          = outbreaks.filter((o) => o.risk_level === "high").length;
  const alertsToday       = outbreaks.filter(
    (o) => new Date(o.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;
  const pheicCount        = outbreaks.filter((o) => o.is_pheic).length;

  return { activeOutbreaks, countriesAffected, highRisk, alertsToday, pheicCount };
}

/** Returns true if the outbreak was updated or created within the last 24 hours */
export function isNewOutbreak(outbreak: Outbreak): boolean {
  const ref = outbreak.updated_at ?? outbreak.created_at;
  if (!ref) return false;
  return Date.now() - new Date(ref).getTime() < 24 * 60 * 60 * 1000;
}

// A real, citable WHO Disease Outbreak News article, e.g.
// "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606".
// Same pattern as scripts/cleanup-fictional-outbreaks.mjs's REAL_DON check.
const REAL_WHO_DON_SOURCE = /^https:\/\/www\.who\.int\/emergencies\/disease-outbreak-news\/item\/\d{4}-DON\d+$/i;

// Fake seed DON URLs look like /item/dengue-cotedivoire-2024 — no year-DONnumber pattern.
const FAKE_SEED_DON = /\/disease-outbreak-news\/item\/(?!\d{4}-DON)/i;

/**
 * Three-tier source verification:
 *   'don'        — real WHO DON article (fully citable, citation button shown)
 *   'official'   — real https URL from WHO sitrep / ECDC / national MoH, but no DON id
 *   'unverified' — placeholder source ("OMS", "PAHO", fake seed URL, etc.)
 */
export type SourceStatus = 'don' | 'official' | 'unverified';

export function sourceStatus(outbreak: Pick<Outbreak, "source">): SourceStatus {
  const src = outbreak.source || "";
  if (REAL_WHO_DON_SOURCE.test(src)) return 'don';
  if (src.startsWith("https://") && !FAKE_SEED_DON.test(src)) return 'official';
  return 'unverified';
}

/** Backward-compatible alias: true when source is not a confirmed WHO DON article. */
export function isIllustrativeData(outbreak: Pick<Outbreak, "source">): boolean {
  return sourceStatus(outbreak) !== 'don';
}

import { createClient } from "@supabase/supabase-js";

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
  description: string;
  active: boolean;
  is_pheic:      boolean;       // Public Health Emergency of International Concern
  updated_at:    string | null; // last sync timestamp
  created_at:    string | null; // first insertion timestamp
}

export async function getLastSync(): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("outbreaks")
    .select("updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  return (data as any)?.updated_at ?? null;
}

export async function getOutbreaks(): Promise<Outbreak[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("outbreaks")
    .select("*")
    .eq("active", true)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching outbreaks:", error);
    return [];
  }

  // Deduplicate: keep only the most recent entry per (disease, country) pair
  const seen = new Set<string>();
  return (data || []).filter((o) => {
    const key = `${(o.disease_en || o.disease).toLowerCase()}|${o.country.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Disease name translations ─────────────────────────────────────────────────
// The `disease` / `disease_en` columns contain English WHO names.
// Map them to FR / ES / ID so the UI never shows English names on those locales.
const DISEASE_FR: Record<string, string> = {
  "Dengue": "Dengue",
  "Dengue fever": "Dengue",
  "Mpox": "Mpox",
  "Monkeypox": "Variole du singe",
  "Ebola": "Ébola",
  "Ebola virus disease": "Maladie à virus Ébola",
  "Marburg virus disease": "Maladie à virus de Marburg",
  "Cholera": "Choléra",
  "Yellow fever": "Fièvre jaune",
  "Lassa fever": "Fièvre de Lassa",
  "Rift Valley fever": "Fièvre de la Vallée du Rift",
  "Crimean-Congo haemorrhagic fever": "Fièvre hémorragique de Crimée-Congo",
  "Meningitis": "Méningite",
  "Meningococcal meningitis": "Méningite à méningocoques",
  "Measles": "Rougeole",
  "Poliomyelitis": "Poliomyélite",
  "Polio": "Poliomyélite",
  "Influenza": "Grippe",
  "Influenza A(H5N1)": "Grippe A(H5N1)",
  "Influenza A(H3N2)": "Grippe A(H3N2)",
  "Avian influenza": "Grippe aviaire",
  "COVID-19": "COVID-19",
  "Plague": "Peste",
  "Typhoid fever": "Fièvre typhoïde",
  "Anthrax": "Charbon",
  "Rabies": "Rage",
  "Chikungunya": "Chikungunya",
  "Zika": "Zika",
  "Zika virus disease": "Maladie à virus Zika",
  "Middle East Respiratory Syndrome": "MERS-CoV",
  "MERS-CoV": "MERS-CoV",
  "Nipah virus": "Virus Nipah",
  "Leishmaniasis": "Leishmaniose",
  "Trypanosomiasis": "Trypanosomose",
  "Hantavirus": "Hantavirus",
};

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
  "COVID-19": "COVID-19",
  "Plague": "Peste",
  "Typhoid fever": "Fiebre tifoidea",
  "Rabies": "Rabia",
  "Chikungunya": "Chikungunya",
  "Zika virus disease": "Enfermedad por virus del Zika",
  "Middle East Respiratory Syndrome": "MERS-CoV",
  "MERS-CoV": "MERS-CoV",
  "Nipah virus": "Virus Nipah",
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
  "Meningitis": "Meningitis",
  "Measles": "Campak",
  "Poliomyelitis": "Poliomielitis",
  "Polio": "Polio",
  "Influenza": "Influenza",
  "Avian influenza": "Flu Burung",
  "COVID-19": "COVID-19",
  "Plague": "Pes",
  "Typhoid fever": "Demam Tifoid",
  "Rabies": "Rabies",
  "Chikungunya": "Chikungunya",
  "Zika virus disease": "Penyakit Virus Zika",
  "Middle East Respiratory Syndrome": "MERS-CoV",
  "MERS-CoV": "MERS-CoV",
  "Nipah virus": "Virus Nipah",
};

export function getLocalizedDisease(outbreak: Outbreak, locale: string): string {
  const en = outbreak.disease_en || outbreak.disease;
  if (locale === "ar") return outbreak.disease_ar || en;
  if (locale === "fr") return DISEASE_FR[en] ?? DISEASE_FR[outbreak.disease] ?? en;
  if (locale === "es") return DISEASE_ES[en] ?? DISEASE_ES[outbreak.disease] ?? en;
  if (locale === "id") return DISEASE_ID[en] ?? DISEASE_ID[outbreak.disease] ?? en;
  return en; // en = default
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

export function getLocalizedCountry(outbreak: Outbreak, locale: string): string {
  const en = outbreak.country_en || outbreak.country;
  if (locale === "ar") return outbreak.country_ar || en;
  if (locale === "fr") return COUNTRY_FR[en] ?? COUNTRY_FR[outbreak.country] ?? en;
  if (locale === "es") return COUNTRY_ES[en] ?? COUNTRY_ES[outbreak.country] ?? en;
  if (locale === "id") return COUNTRY_ID[en] ?? COUNTRY_ID[outbreak.country] ?? en;
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

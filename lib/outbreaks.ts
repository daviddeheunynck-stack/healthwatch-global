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

export function getLocalizedCountry(outbreak: Outbreak, locale: string): string {
  if (locale === "ar") return outbreak.country_ar || outbreak.country;
  if (locale === "en" || locale === "es" || locale === "id") return outbreak.country_en || outbreak.country;
  return outbreak.country; // fr = default
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

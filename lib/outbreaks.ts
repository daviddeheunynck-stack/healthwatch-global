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

  return data || [];
}

export function getLocalizedDisease(outbreak: Outbreak, locale: string): string {
  if (locale === "ar") return outbreak.disease_ar || outbreak.disease;
  if (locale === "en" || locale === "es" || locale === "id") return outbreak.disease_en || outbreak.disease;
  return outbreak.disease; // fr = default
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

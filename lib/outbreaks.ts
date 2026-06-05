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
  corroborated:  boolean;       // true when both WHO + ProMED report this outbreak
  promed_source: string | null; // ProMED article URL when corroborated
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
  const activeOutbreaks = outbreaks.length;
  const countriesAffected = new Set(outbreaks.map((o) => o.country)).size;
  const highRisk = outbreaks.filter((o) => o.risk_level === "high").length;
  const alertsToday = outbreaks.filter(
    (o) => new Date(o.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  return { activeOutbreaks, countriesAffected, highRisk, alertsToday };
}

import { createClient } from "@supabase/supabase-js";

export interface Outbreak {
  id: string;
  disease: string;
  country: string;
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

export function getStats(outbreaks: Outbreak[]) {
  const activeOutbreaks = outbreaks.length;
  const countriesAffected = new Set(outbreaks.map((o) => o.country)).size;
  const highRisk = outbreaks.filter((o) => o.risk_level === "high").length;
  const alertsToday = outbreaks.filter(
    (o) => new Date(o.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  return { activeOutbreaks, countriesAffected, highRisk, alertsToday };
}

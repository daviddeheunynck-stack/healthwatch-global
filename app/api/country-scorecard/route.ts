import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export interface ScorecardCountry {
  country_en: string;
  country: string;
  country_ar: string | null;
  region: string;
  outbreak_count: number;
  total_cases: number;
  has_pheic: boolean;
  max_risk: "high" | "medium" | "low";
  last_updated: string;
  diseases: string[];       // English canonical
  diseases_fr: string[];    // French canonical
  diseases_ar: string[];    // Arabic (empty string when unavailable)
}

const RISK_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("country_en, country, country_ar, region, cases, is_pheic, risk_level, updated_at, disease_en, disease, disease_ar")
    .eq("active", true);

  if (!outbreaks?.length) return NextResponse.json({ countries: [] });

  const byCountry = new Map<string, {
    country: string;
    country_ar: string | null;
    region: string;
    count: number;
    totalCases: number;
    hasPheic: boolean;
    maxRisk: string;
    lastUpdated: string;
    diseaseMap: Map<string, { disease: string; disease_en: string; disease_ar: string | null }>;
  }>();

  for (const o of outbreaks) {
    const key = o.country_en ?? "Unknown";
    const existing = byCountry.get(key);
    if (!existing) {
      const dm = new Map<string, { disease: string; disease_en: string; disease_ar: string | null }>();
      if (o.disease_en) dm.set(o.disease_en, { disease: o.disease ?? o.disease_en, disease_en: o.disease_en, disease_ar: o.disease_ar ?? null });
      byCountry.set(key, {
        country: o.country ?? key,
        country_ar: o.country_ar ?? null,
        region: o.region ?? "unknown",
        count: 1,
        totalCases: o.cases ?? 0,
        hasPheic: !!o.is_pheic,
        maxRisk: o.risk_level ?? "low",
        lastUpdated: o.updated_at ?? "",
        diseaseMap: dm,
      });
    } else {
      existing.count++;
      existing.totalCases += o.cases ?? 0;
      existing.hasPheic = existing.hasPheic || !!o.is_pheic;
      if ((RISK_ORDER[o.risk_level] ?? 0) > (RISK_ORDER[existing.maxRisk] ?? 0)) {
        existing.maxRisk = o.risk_level;
      }
      if (o.updated_at && o.updated_at > existing.lastUpdated) existing.lastUpdated = o.updated_at;
      if (o.disease_en && !existing.diseaseMap.has(o.disease_en)) {
        existing.diseaseMap.set(o.disease_en, { disease: o.disease ?? o.disease_en, disease_en: o.disease_en, disease_ar: o.disease_ar ?? null });
      }
    }
  }

  const countries: ScorecardCountry[] = Array.from(byCountry.entries())
    .map(([country_en, d]) => {
      const entries = Array.from(d.diseaseMap.values()).sort((a, b) => a.disease_en.localeCompare(b.disease_en));
      return {
        country_en,
        country: d.country,
        country_ar: d.country_ar,
        region: d.region,
        outbreak_count: d.count,
        total_cases: d.totalCases,
        has_pheic: d.hasPheic,
        max_risk: d.maxRisk as "high" | "medium" | "low",
        last_updated: d.lastUpdated,
        diseases: entries.map((e) => e.disease_en),
        diseases_fr: entries.map((e) => e.disease),
        diseases_ar: entries.map((e) => e.disease_ar ?? ""),
      };
    })
    .sort((a, b) => {
      if (a.has_pheic !== b.has_pheic) return a.has_pheic ? -1 : 1;
      const rA = RISK_ORDER[a.max_risk] ?? 0;
      const rB = RISK_ORDER[b.max_risk] ?? 0;
      if (rA !== rB) return rB - rA;
      return b.outbreak_count - a.outbreak_count;
    });

  return NextResponse.json({ countries });
}

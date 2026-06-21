import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export interface ScorecardCountry {
  country_en: string;
  region: string;
  outbreak_count: number;
  total_cases: number;
  has_pheic: boolean;
  max_risk: "high" | "medium" | "low";
  last_updated: string;
  diseases: string[];
}

const RISK_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("country_en, region, cases, is_pheic, risk_level, updated_at, disease_en")
    .eq("active", true);

  if (!outbreaks?.length) return NextResponse.json({ countries: [] });

  // Aggregate per country
  const byCountry = new Map<string, {
    region: string;
    count: number;
    totalCases: number;
    hasPheic: boolean;
    maxRisk: string;
    lastUpdated: string;
    diseases: Set<string>;
  }>();

  for (const o of outbreaks) {
    const key = o.country_en ?? "Unknown";
    const existing = byCountry.get(key);
    if (!existing) {
      byCountry.set(key, {
        region: o.region ?? "unknown",
        count: 1,
        totalCases: o.cases ?? 0,
        hasPheic: !!o.is_pheic,
        maxRisk: o.risk_level ?? "low",
        lastUpdated: o.updated_at ?? "",
        diseases: new Set(o.disease_en ? [o.disease_en] : []),
      });
    } else {
      existing.count++;
      existing.totalCases += o.cases ?? 0;
      existing.hasPheic = existing.hasPheic || !!o.is_pheic;
      if ((RISK_ORDER[o.risk_level] ?? 0) > (RISK_ORDER[existing.maxRisk] ?? 0)) {
        existing.maxRisk = o.risk_level;
      }
      if (o.updated_at && o.updated_at > existing.lastUpdated) existing.lastUpdated = o.updated_at;
      if (o.disease_en) existing.diseases.add(o.disease_en);
    }
  }

  const countries: ScorecardCountry[] = Array.from(byCountry.entries())
    .map(([country_en, d]) => ({
      country_en,
      region: d.region,
      outbreak_count: d.count,
      total_cases: d.totalCases,
      has_pheic: d.hasPheic,
      max_risk: d.maxRisk as "high" | "medium" | "low",
      last_updated: d.lastUpdated,
      diseases: Array.from(d.diseases).sort(),
    }))
    .sort((a, b) => {
      if (a.has_pheic !== b.has_pheic) return a.has_pheic ? -1 : 1;
      const rA = RISK_ORDER[a.max_risk] ?? 0;
      const rB = RISK_ORDER[b.max_risk] ?? 0;
      if (rA !== rB) return rB - rA;
      return b.outbreak_count - a.outbreak_count;
    });

  return NextResponse.json({ countries });
}

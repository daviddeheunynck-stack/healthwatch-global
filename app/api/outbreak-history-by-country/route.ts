import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const countryEn = searchParams.get("country_en") ?? "";

  if (!countryEn) return NextResponse.json({ error: "country_en required" }, { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data, error } = await supabase
    .from("outbreaks")
    .select("date, risk_level")
    .eq("country_en", countryEn);

  // Public + cached `public, s-maxage=3600` like travel-risk — a failed query
  // used to fall through as "no history," broadcasting an empty chart to
  // every visitor for the same country for up to an hour. Lower stakes than
  // travel-risk (a trend chart, not a safety claim) but the same caching
  // amplification, so fixed the same way: fail loudly, never cache the error.
  if (error) {
    console.error("[outbreak-history-by-country] query failed:", error.message);
    Sentry.captureException(new Error(`[outbreak-history-by-country] query failed: ${error.message}`), { tags: { route: "outbreak-history-by-country", country: countryEn } });
    return NextResponse.json({ error: "Failed to load history" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  if (!data?.length) return NextResponse.json({ history: [] });

  const byYear = new Map<number, { total: number; high: number; medium: number; low: number }>();

  for (const row of data as { date: string; risk_level: string }[]) {
    const year = new Date(row.date).getFullYear();
    if (!year || isNaN(year)) continue;
    const entry = byYear.get(year) ?? { total: 0, high: 0, medium: 0, low: 0 };
    entry.total++;
    if (row.risk_level === "high")   entry.high++;
    if (row.risk_level === "medium") entry.medium++;
    if (row.risk_level === "low")    entry.low++;
    byYear.set(year, entry);
  }

  const history = [...byYear.entries()]
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => b.year - a.year)
    .slice(0, 8);

  return NextResponse.json({ history }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
}

/**
 * GET /api/cron/sync-signals
 *
 * Fetches pre-confirmation signals from ReliefWeb (UN — public, no auth required).
 * Run every 6 hours via Vercel Cron.
 * Inserts new signals; skips duplicates (source_url UNIQUE constraint).
 */
import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET  = clean(process.env.CRON_SECRET);

const RELIEFWEB_URL =
  "https://api.reliefweb.int/v2/reports" +
  "?appname=healthwatch-global" +
  "&filter[operator]=AND" +
  "&filter[conditions][0][field]=primary_type.name" +
  "&filter[conditions][0][value]=Disease+Outbreak" +
  "&fields[include][]=title" +
  "&fields[include][]=date" +
  "&fields[include][]=country.name" +
  "&fields[include][]=url" +
  "&limit=20" +
  "&sort[]=date:desc";

// Very rough WHO region mapping by country — covers common signals
const REGION_MAP: Record<string, string> = {
  "Nigeria": "africa", "DRC": "africa", "Congo": "africa", "Ethiopia": "africa",
  "Kenya": "africa", "Uganda": "africa", "Sudan": "africa", "Chad": "africa",
  "Niger": "africa", "Mali": "africa", "Burkina Faso": "africa", "Somalia": "africa",
  "Mozambique": "africa", "Zimbabwe": "africa", "Madagascar": "africa",
  "India": "asia", "Bangladesh": "asia", "Pakistan": "asia", "Indonesia": "asia",
  "Philippines": "asia", "Myanmar": "asia", "Vietnam": "asia", "Cambodia": "asia",
  "Thailand": "asia", "China": "asia", "Afghanistan": "asia", "Nepal": "asia",
  "Brazil": "americas", "Haiti": "americas", "Colombia": "americas", "Peru": "americas",
  "Venezuela": "americas", "Bolivia": "americas", "Ecuador": "americas",
  "Ukraine": "europe", "France": "europe", "Germany": "europe", "Italy": "europe",
  "Papua New Guinea": "oceania", "Fiji": "oceania", "Solomon Islands": "oceania",
};

function guessRegion(country: string | null): string | null {
  if (!country) return null;
  for (const [name, region] of Object.entries(REGION_MAP)) {
    if (country.toLowerCase().includes(name.toLowerCase())) return region;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let rwData: Array<{ id: string; fields: { title: string; date?: { created?: string }; country?: Array<{ name: string }>; url?: string } }> = [];
  try {
    const res = await fetch(RELIEFWEB_URL, {
      headers: { "User-Agent": "HealthWatch Global / contact@healthwatch-global.com" },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`ReliefWeb HTTP ${res.status}`);
    const json = await res.json();
    rwData = json.data ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-signals] ReliefWeb fetch error:", err);
    Sentry.captureException(err, { tags: { cron: "sync-signals" } });
    await logCronRun(supabase, "sync-signals", "error", 0, msg);
    return NextResponse.json({ error: "ReliefWeb fetch failed" }, { status: 502 });
  }

  let inserted = 0;
  let skipped  = 0;

  for (const item of rwData) {
    const f = item.fields;
    const headline   = f.title ?? "";
    const sourceUrl  = f.url ? `https://reliefweb.int${f.url}` : null;
    const signalDate = f.date?.created ? f.date.created.split("T")[0] : null;
    const country    = f.country?.[0]?.name ?? null;
    const region     = guessRegion(country);

    if (!headline) continue;

    const { error } = await supabase.from("signals").insert({
      headline,
      source_url:  sourceUrl,
      source_name: "ReliefWeb",
      country_hint: country,
      region,
      signal_date: signalDate,
      confidence:  40,
      status:      "pending",
    });

    if (error?.code === "23505") { skipped++; } // unique violation = already exists
    else if (error)              { console.warn("[sync-signals] insert error:", error.message); }
    else                         { inserted++; }
  }

  await logCronRun(supabase, "sync-signals", "ok", inserted);
  return NextResponse.json({ ok: true, inserted, skipped });
}

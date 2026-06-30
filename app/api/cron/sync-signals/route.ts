/**
 * GET /api/cron/sync-signals
 *
 * Fetches pre-confirmation signals from ReliefWeb (UN — public, no auth required).
 * Run every 6 hours via Vercel Cron.
 * Falls back to the public RSS feed when the API returns 403 (appname not yet approved).
 * Inserts new signals; skips duplicates (source_url UNIQUE constraint).
 */
import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL      = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_KEY      = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET       = clean(process.env.CRON_SECRET);
const RELIEFWEB_APPNAME = clean(process.env.RELIEFWEB_APPNAME) || "healthwatch-global";

const RELIEFWEB_API_URL =
  "https://api.reliefweb.int/v2/reports" +
  `?appname=${encodeURIComponent(RELIEFWEB_APPNAME)}` +
  "&filter[operator]=AND" +
  "&filter[conditions][0][field]=primary_type.name" +
  "&filter[conditions][0][value]=Disease+Outbreak" +
  "&fields[include][]=title" +
  "&fields[include][]=date" +
  "&fields[include][]=country.name" +
  "&fields[include][]=url" +
  "&limit=20" +
  "&sort[]=date:desc";

const RELIEFWEB_RSS_URL =
  "https://reliefweb.int/updates/rss.xml?primary_type=38&limit=20";

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

interface Signal {
  headline: string;
  sourceUrl: string | null;
  signalDate: string | null;
  country: string | null;
}

async function fetchFromApi(): Promise<Signal[]> {
  const res = await fetch(RELIEFWEB_API_URL, {
    headers: { "User-Agent": "HealthWatch Global / contact@healthwatch-global.com" },
    next: { revalidate: 0 },
  });
  if (res.status === 403) {
    throw new Error(
      `ReliefWeb 403 — appname "${RELIEFWEB_APPNAME}" not approved. ` +
      "Register at apidoc.reliefweb.int and set RELIEFWEB_APPNAME env var.",
    );
  }
  if (!res.ok) throw new Error(`ReliefWeb API HTTP ${res.status}`);
  const json = await res.json();
  const data: Array<{
    fields: { title: string; date?: { created?: string }; country?: Array<{ name: string }>; url?: string };
  }> = json.data ?? [];
  return data.map((item) => ({
    headline:   item.fields.title ?? "",
    sourceUrl:  item.fields.url ? `https://reliefweb.int${item.fields.url}` : null,
    signalDate: item.fields.date?.created ? item.fields.date.created.split("T")[0] : null,
    country:    item.fields.country?.[0]?.name ?? null,
  }));
}

async function fetchFromRss(): Promise<Signal[]> {
  const res = await fetch(RELIEFWEB_RSS_URL, {
    headers: { "User-Agent": "HealthWatch Global / contact@healthwatch-global.com" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`ReliefWeb RSS HTTP ${res.status}`);
  const xml = await res.text();

  const items: Signal[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const body = m[1];
    const headline =
      /<title>([\s\S]*?)<\/title>/.exec(body)?.[1]
        ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1")
        .trim() ?? "";
    const link    = /<link>([\s\S]*?)<\/link>/.exec(body)?.[1]?.trim() ?? null;
    const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(body)?.[1]?.trim() ?? null;

    // Country from the "Countries: X, Y" div inside the HTML-encoded description
    const rawDesc = /<description>([\s\S]*?)<\/description>/.exec(body)?.[1] ?? "";
    const decoded = rawDesc.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const cMatch  = /Countr(?:y|ies):\s*([^<]+)</.exec(decoded);
    let country: string | null = null;
    if (cMatch) {
      const parts = cMatch[1].split(",").map((c) => c.trim()).filter((c) => c && c !== "World");
      country = parts[0] ?? null;
    }

    let signalDate: string | null = null;
    if (pubDate) {
      try { signalDate = new Date(pubDate).toISOString().split("T")[0]; } catch { /**/ }
    }

    if (headline && link) items.push({ headline, sourceUrl: link, signalDate, country });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let signals: Signal[] = [];
  let source = "api";

  try {
    signals = await fetchFromApi();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("403")) {
      console.warn("[sync-signals] API 403 — falling back to RSS feed");
      try {
        signals = await fetchFromRss();
        source = "rss";
      } catch (rssErr) {
        const rssMsg = rssErr instanceof Error ? rssErr.message : String(rssErr);
        console.error("[sync-signals] RSS fallback also failed:", rssErr);
        Sentry.captureException(rssErr, { tags: { cron: "sync-signals" } });
        await logCronRun(supabase, "sync-signals", "error", 0, `API 403, RSS failed: ${rssMsg}`);
        return NextResponse.json({ error: "Both ReliefWeb API and RSS failed" }, { status: 502 });
      }
    } else {
      console.error("[sync-signals] fetch error:", err);
      Sentry.captureException(err, { tags: { cron: "sync-signals" } });
      await logCronRun(supabase, "sync-signals", "error", 0, msg);
      return NextResponse.json({ error: "ReliefWeb fetch failed" }, { status: 502 });
    }
  }

  let inserted = 0;
  let skipped  = 0;

  for (const sig of signals) {
    if (!sig.headline) continue;

    const { error } = await supabase.from("signals").insert({
      headline:     sig.headline,
      source_url:   sig.sourceUrl,
      source_name:  "ReliefWeb",
      country_hint: sig.country,
      region:       guessRegion(sig.country),
      signal_date:  sig.signalDate,
      confidence:   40,
      status:       "pending",
    });

    if (error?.code === "23505") { skipped++; }
    else if (error)              { console.warn("[sync-signals] insert error:", error.message); }
    else                         { inserted++; }
  }

  const note = source === "rss" ? "RSS fallback (API 403)" : undefined;
  await logCronRun(supabase, "sync-signals", "ok", inserted, note);
  return NextResponse.json({ ok: true, inserted, skipped, source });
}

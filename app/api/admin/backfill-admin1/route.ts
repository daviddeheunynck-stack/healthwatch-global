/**
 * POST /api/admin/backfill-admin1
 *
 * Backfills admin1 / admin1_lat / admin1_lng for existing outbreak rows.
 * Fetches the full WHO DON article body from the source URL so province
 * mentions in paragraph 2-3 are reachable (stored description is 400 chars,
 * far too short to reliably find sub-national location mentions).
 *
 * Processes up to `limit` rows per call (default 5) — each row requires
 * one HTTP fetch (~1s) + one Nominatim geocode (~1s) = ~2s/row.
 * Call repeatedly until `remaining === 0`.
 *
 * Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractAdmin1, geocodeAdmin1 } from "@/lib/geo-extract";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const FETCH_HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept": "text/html, */*",
};

async function fetchFullText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const bodyMatch = html.match(
      /(?:sf-content-block|article-content|content-block-article|don-content)([\s\S]{0,8000})/i
    );
    return (bodyMatch ? bodyMatch[1] : html)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5", 10), 20);
  const reset = searchParams.get("reset") === "true";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ?reset=true: clear the "~" sentinel so LLM can re-attempt those rows
  if (reset) {
    await supabase
      .from("outbreaks")
      .update({ admin1: null })
      .eq("admin1", "~");
  }

  // Select rows with null OR empty admin1
  const { data: rows, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, source, description, country_en")
    .or("admin1.is.null,admin1.eq.")
    .not("source", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ processed: 0, remaining: 0 });

  let processed = 0;
  let geocoded  = 0;

  for (const row of rows) {
    // Fetch full article body — province mentions live beyond the 400-char description
    const fullText = row.source?.startsWith("https://www.who.int")
      ? await fetchFullText(row.source)
      : "";

    const textToSearch = fullText || row.description || "";
    const admin1 = await extractAdmin1(textToSearch, row.country_en ?? undefined);

    if (!admin1) {
      // "~" = full-text attempted, no province found — excluded from future runs
      // (distinguishes from "" = first-pass 400-char miss, still eligible for retry)
      await supabase.from("outbreaks").update({ admin1: "~" }).eq("id", row.id);
      processed++;
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    let admin1_lat: number | null = null;
    let admin1_lng: number | null = null;
    const coords = await geocodeAdmin1(admin1, row.country_en ?? "");
    if (coords) { admin1_lat = coords.lat; admin1_lng = coords.lng; geocoded++; }

    await supabase
      .from("outbreaks")
      .update({ admin1, admin1_lat, admin1_lng })
      .eq("id", row.id);

    processed++;
    // Nominatim rate limit: 1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }

  // Count rows still needing backfill: null (never attempted) or "" (only tried with 400-char description)
  const { count: remaining } = await supabase
    .from("outbreaks")
    .select("id", { count: "exact", head: true })
    .or("admin1.is.null,admin1.eq.");

  return NextResponse.json({
    processed,
    geocoded,
    remaining: remaining ?? 0,
    llm_active: !!(process.env.ANTHROPIC_API_KEY ?? "").trim(),
  });
}

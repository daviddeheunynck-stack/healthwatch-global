/**
 * POST /api/admin/backfill-admin1
 *
 * Backfills admin1 / admin1_lat / admin1_lng for existing outbreak rows
 * that have a description but no admin1 yet.
 *
 * Processes up to `limit` rows per call (default 20) to stay within
 * Nominatim's 1 req/sec rate limit and Vercel's 10-second default timeout.
 * Call repeatedly until `remaining === 0`.
 *
 * Protected by CRON_SECRET (same as cron routes).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractAdmin1, geocodeAdmin1 } from "@/lib/geo-extract";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch rows that have a description but no admin1 yet
  const { data: rows, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, description, country_en")
    .is("admin1", null)
    .not("description", "is", null)
    .neq("description", "")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ processed: 0, remaining: 0 });

  let processed = 0;
  let geocoded = 0;

  for (const row of rows) {
    const admin1 = extractAdmin1(row.description ?? "");
    if (!admin1) {
      // Mark as attempted (empty string) so we don't retry indefinitely
      await supabase.from("outbreaks").update({ admin1: "" }).eq("id", row.id);
      processed++;
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

  // Count remaining rows needing backfill
  const { count: remaining } = await supabase
    .from("outbreaks")
    .select("id", { count: "exact", head: true })
    .is("admin1", null)
    .not("description", "is", null)
    .neq("description", "");

  return NextResponse.json({ processed, geocoded, remaining: remaining ?? 0 });
}

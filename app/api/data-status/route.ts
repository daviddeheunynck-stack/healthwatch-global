import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

function inferSource(source: string | null): string {
  if (!source) return "Other";
  if (/who\.int\/emergencies|disease-outbreak-news/i.test(source)) return "WHO DON";
  if (/ecdc\.europa/i.test(source))              return "ECDC";
  if (/paho\.org/i.test(source))                 return "PAHO";
  if (/africacdc\.org|africa-cdc/i.test(source)) return "Africa CDC";
  if (/cdc\.gov/i.test(source))                  return "US CDC";
  if (/who\.int/i.test(source))                  return "WHO Official";
  return "Other";
}

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data } = await supabase
    .from("outbreaks")
    .select("source, updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false });

  if (!data?.length) return NextResponse.json({ sources: [] });

  const map = new Map<string, { last_synced_at: string; count: number }>();
  for (const row of data as { source: string | null; updated_at: string | null }[]) {
    const src = inferSource(row.source);
    const ts  = row.updated_at ?? "";
    const cur = map.get(src);
    if (!cur) {
      map.set(src, { last_synced_at: ts, count: 1 });
    } else {
      cur.count++;
      if (ts > cur.last_synced_at) cur.last_synced_at = ts;
    }
  }

  const ORDER = ["WHO DON", "WHO Official", "ECDC", "PAHO", "Africa CDC", "US CDC", "Other"];
  const sources = [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));

  return NextResponse.json({ sources, checked_at: new Date().toISOString() });
}

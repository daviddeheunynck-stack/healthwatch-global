import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url       = new URL(req.url);
  const event_id  = url.searchParams.get("event_id");
  const exclude   = url.searchParams.get("exclude");

  if (!event_id) return NextResponse.json({ outbreaks: [] });

  let query = supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, cases, deaths, date, region")
    .eq("event_id", event_id)
    .eq("active", true);

  if (exclude) query = query.neq("id", exclude);

  const { data, error } = await query
    .order("risk_level", { ascending: true })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outbreaks: data ?? [] });
}

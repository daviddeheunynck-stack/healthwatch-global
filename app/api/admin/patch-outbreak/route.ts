import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/admin";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// POST /api/admin/patch-outbreak
// Body: { disease_en, country_en, cases, deaths, date, source?, active? }
// Updates the matching active outbreak row by disease_en + country_en.
export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  let body: {
    disease_en: string;
    country_en: string;
    cases?: number;
    deaths?: number;
    date?: string;
    source?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { disease_en, country_en } = body;
  if (!disease_en || !country_en) {
    return NextResponse.json({ error: "disease_en and country_en are required" }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Strip characters significant to PostgREST's .or() filter syntax (same as
  // the public search endpoint, app/api/outbreaks/route.ts) so a value like
  // "x%,active.eq.true" can't inject an extra filter clause.
  const safeDisease = disease_en.replace(/[,()]/g, "");
  const safeCountry = country_en.replace(/[,()]/g, "");

  // Find the matching row (active OR recently active).
  // Search both disease_en/country_en (English) and disease/country (French)
  // because some rows are inserted with only the French columns populated.
  const { data: rows, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, active")
    .or(`disease_en.ilike.%${safeDisease}%,disease.ilike.%${safeDisease}%`)
    .or(`country_en.ilike.%${safeCountry}%,country.ilike.%${safeCountry}%`)
    .order("active", { ascending: false })
    .limit(1);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: `No row found for ${disease_en} / ${country_en}` }, { status: 404 });
  }

  const row = rows[0];
  const patch: Record<string, unknown> = {};
  if (body.cases   !== undefined) patch.cases   = body.cases;
  if (body.deaths  !== undefined) patch.deaths  = body.deaths;
  if (body.date    !== undefined) patch.date    = body.date;
  if (body.source  !== undefined) patch.source  = body.source;
  if (body.active  !== undefined) patch.active  = body.active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to patch" }, { status: 400 });
  }

  try {
    const { error: updateErr } = await supabase
      .from("outbreaks")
      .update(patch)
      .eq("id", row.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      id: row.id,
      before: { cases: row.cases, deaths: row.deaths, date: row.date, active: row.active },
      after: patch,
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

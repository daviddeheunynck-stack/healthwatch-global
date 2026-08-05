import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { DISEASE_CATEGORIES, type DiseaseCategory } from "@/lib/disease-category";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["starter", "pro", "team", "enterprise"];
const REGIONS    = ["all", "africa", "asia", "europe", "americas", "oceania"];
const MAX_ALERTS = 10;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("category_alerts")
    .select("id, disease_category, region, min_cases, email, last_fired_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const { count } = await supabase
    .from("category_alerts").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= MAX_ALERTS)
    return NextResponse.json({ error: `Max ${MAX_ALERTS} category alerts` }, { status: 422 });

  const body = await req.json() as { disease_category?: string; region?: string; min_cases?: number; email?: string };
  const disease_category = (DISEASE_CATEGORIES as string[]).includes(body.disease_category ?? "")
    ? body.disease_category as DiseaseCategory : null;
  const region    = REGIONS.includes(body.region ?? "") ? body.region! : "all";
  const min_cases = typeof body.min_cases === "number" && body.min_cases > 0 ? Math.round(body.min_cases) : 0;
  const email     = typeof body.email === "string" ? body.email.trim().slice(0, 320) : user.email ?? "";

  // Previously only checked non-empty — no "@" or format required at all.
  // Aligned with the regex already used by country-risk-alerts/geofence-alerts/subscribe/etc.
  if (!disease_category || min_cases <= 0 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });

  const { data, error } = await supabase
    .from("category_alerts")
    .insert({ user_id: user.id, disease_category, region, min_cases, email })
    .select("id, disease_category, region, min_cases, email, last_fired_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";

  const { error } = await supabase
    .from("category_alerts").delete().eq("user_id", user.id).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";

const PAID_PLANS = ["starter", "pro", "team", "enterprise"];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  let activePlan = profile?.plan ?? "";
  if (activePlan !== "free" && activePlan && profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() < Date.now() && !profile?.stripe_subscription_id) activePlan = "free";
  if (!PAID_PLANS.includes(activePlan))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const { data, error } = await supabase
    .from("signals")
    .select("id, headline, source_url, source_name, disease_hint, country_hint, region, signal_date, confidence, votes_up, votes_down, created_at")
    .eq("status", "pending")
    .order("signal_date", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signals: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  let activePlan = profile?.plan ?? "";
  if (activePlan !== "free" && activePlan && profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() < Date.now() && !profile?.stripe_subscription_id) activePlan = "free";
  if (!PAID_PLANS.includes(activePlan))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json();
  const headline     = typeof body.headline    === "string" ? body.headline.trim().slice(0, 300)    : "";
  const source_url   = typeof body.source_url  === "string" ? body.source_url.trim().slice(0, 1000) : null;
  const disease_hint = typeof body.disease_hint === "string" ? body.disease_hint.trim().slice(0, 100) : null;
  const country_hint = typeof body.country_hint === "string" ? body.country_hint.trim().slice(0, 100) : null;

  if (!headline) return NextResponse.json({ error: "Missing headline" }, { status: 400 });

  const { data, error } = await supabase.from("signals").insert({
    headline, source_url, disease_hint, country_hint,
    source_name: "user", confidence: 20, status: "pending", submitted_by: user.id,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json();
  const id   = typeof body.id   === "string" ? body.id   : null;
  const vote = body.vote === "up" || body.vote === "down" ? body.vote : null;
  if (!id || !vote) return NextResponse.json({ error: "Missing id or vote" }, { status: 400 });

  // Increment counter via service role (bypasses RLS — user UPDATE is blocked)
  const service = createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const col = vote === "up" ? "votes_up" : "votes_down";
  const { data: current } = await service.from("signals").select(col).eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await service.from("signals").update({ [col]: (current[col as keyof typeof current] as number) + 1 }).eq("id", id);

  return NextResponse.json({ ok: true });
}

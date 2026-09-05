import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["starter", "pro", "team", "enterprise"];
const MAX_TRIPWIRES = 20;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const outbreakId = searchParams.get("outbreak_id");

  const query = supabase
    .from("outbreak_tripwires")
    .select("id, outbreak_id, threshold_cases, email, triggered_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (outbreakId) query.eq("outbreak_id", outbreakId);

  const { data } = await query;
  return NextResponse.json({ tripwires: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const { count } = await supabase
    .from("outbreak_tripwires")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_TRIPWIRES)
    return NextResponse.json({ error: `Max ${MAX_TRIPWIRES} tripwires` }, { status: 422 });

  const body = await req.json() as {
    outbreak_id?: string;
    threshold_cases?: number;
    email?: string;
  };

  const outbreak_id = typeof body.outbreak_id === "string" ? body.outbreak_id.trim() : "";
  const threshold_cases = typeof body.threshold_cases === "number" && body.threshold_cases > 0
    ? Math.round(body.threshold_cases) : 0;
  // The UI (OutbreakDetailModal) always sends `email: ""` — an explicit empty
  // string, not an absent field — so `typeof === "string"` alone always won
  // this ternary and the `user.email` fallback below could never actually
  // run. Every tripwire ever created from the "Activer" button 400'd here
  // silently (the button's catch swallows the error with no user-visible
  // feedback), so the feature never worked end to end. Found 2026-09-05
  // while verifying the sibling predictive-alerts route, which copied the
  // same bug — fixed there too.
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().slice(0, 320) : user.email ?? "";

  if (!outbreak_id || threshold_cases <= 0 || !email)
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });

  // Upsert — one tripwire per outbreak per user
  const { data, error } = await supabase
    .from("outbreak_tripwires")
    .upsert({
      user_id: user.id,
      outbreak_id,
      threshold_cases,
      email,
      last_checked_cases: 0,
      triggered_at: null,
    }, { onConflict: "user_id,outbreak_id" })
    .select("id, outbreak_id, threshold_cases, email, triggered_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tripwire: data }, { status: 201 });
}

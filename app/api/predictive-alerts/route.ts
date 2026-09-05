import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["starter", "pro", "team", "enterprise"];
const MAX_PREDICTIVE_ALERTS = 20;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const outbreakId = searchParams.get("outbreak_id");

  const query = supabase
    .from("outbreak_predictive_alerts")
    .select("id, outbreak_id, doubling_within_days, email, last_projected_days, triggered_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (outbreakId) query.eq("outbreak_id", outbreakId);

  const { data } = await query;
  return NextResponse.json({ predictive_alerts: data ?? [] });
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
    .from("outbreak_predictive_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_PREDICTIVE_ALERTS)
    return NextResponse.json({ error: `Max ${MAX_PREDICTIVE_ALERTS} predictive alerts` }, { status: 422 });

  const body = await req.json() as {
    outbreak_id?: string;
    doubling_within_days?: number;
    email?: string;
  };

  const outbreak_id = typeof body.outbreak_id === "string" ? body.outbreak_id.trim() : "";
  const doubling_within_days = typeof body.doubling_within_days === "number" && body.doubling_within_days > 0
    ? Math.round(body.doubling_within_days) : 0;
  // Empty string ("" from the UI's default request body) must fall through
  // to user.email, not be treated as a provided value — see the tripwires
  // route fix (2026-09-05) for the incident this pattern caused there.
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().slice(0, 320) : user.email ?? "";

  if (!outbreak_id || doubling_within_days <= 0 || !email)
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });

  // Upsert — one predictive alert per outbreak per user
  const { data, error } = await supabase
    .from("outbreak_predictive_alerts")
    .upsert({
      user_id: user.id,
      outbreak_id,
      doubling_within_days,
      email,
      last_projected_days: null,
      triggered_at: null,
    }, { onConflict: "user_id,outbreak_id" })
    .select("id, outbreak_id, doubling_within_days, email, last_projected_days, triggered_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ predictive_alert: data }, { status: 201 });
}

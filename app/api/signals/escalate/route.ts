import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["starter", "pro", "team", "enterprise"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as {
    headline?: string;
    disease_hint?: string | null;
    country_hint?: string | null;
    source_url?: string | null;
  };

  const headline = (body.headline ?? "").trim().slice(0, 500);
  if (!headline) return NextResponse.json({ error: "Headline required" }, { status: 400 });

  const { data, error } = await supabase
    .from("signal_investigations")
    .insert({
      user_id:       user.id,
      headline,
      disease_hint:  body.disease_hint  ?? null,
      country_hint:  body.country_hint  ?? null,
      signal_source: body.source_url    ?? null,
      status:        "open",
    })
    .select("id, headline, disease_hint, country_hint, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, investigation: data }, { status: 201 });
}

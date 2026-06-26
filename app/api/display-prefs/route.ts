import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

import { resolvedPlan } from "@/lib/resolved-plan";

const VALID_REGIONS = ["all", "africa", "asia", "europe", "americas", "oceania"] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("display_filters, plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const isPaid = ["starter", "pro", "team", "enterprise"].includes(resolvedPlan(data));
  if (!isPaid) return NextResponse.json({ filters: null });

  return NextResponse.json({ filters: data?.display_filters ?? null });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const isPaid = ["starter", "pro", "team", "enterprise"].includes(resolvedPlan(profile));
  if (!isPaid) return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json();
  const region  = VALID_REGIONS.includes(body.region) ? body.region : "all";
  const country = typeof body.country === "string" ? body.country : "all";

  // Read existing display_filters so we don't clobber flags like no_weekly_signal
  const { data: existing } = await supabase
    .from("profiles")
    .select("display_filters")
    .eq("id", user.id)
    .single();

  const prev = (existing?.display_filters as Record<string, unknown> | null) ?? {};
  const merged: Record<string, unknown> = { ...prev, region, country };

  // If both are "all", drop them from the object (keep other flags like no_weekly_signal)
  if (region === "all") delete merged.region;
  if (country === "all") delete merged.country;

  const filters = Object.keys(merged).length > 0 ? merged : null;

  await supabase
    .from("profiles")
    .update({ display_filters: filters })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, filters });
}

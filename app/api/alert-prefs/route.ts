import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID_REGIONS = new Set(["africa", "asia", "americas", "europe", "oceania"]);

// ── GET /api/alert-prefs — returns the user's subscribed regions ──────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_alert_regions")
    .select("region")
    .eq("user_id", user.id);

  return NextResponse.json({ regions: (data ?? []).map((r: { region: string }) => r.region) });
}

// ── PUT /api/alert-prefs — toggle a region on or off ─────────────────────────

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Gate behind paid plan (with trial expiry guard)
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();
  let plan = profile?.plan ?? "free";
  if (
    plan !== "free" &&
    profile?.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() < Date.now() &&
    !profile?.stripe_subscription_id
  ) {
    plan = "free";
  }
  if (plan === "free") {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
  }

  const body = await req.json() as { region?: string; enabled?: boolean };
  const { region, enabled } = body;

  if (!region || !VALID_REGIONS.has(region)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  if (enabled) {
    await supabase
      .from("user_alert_regions")
      .upsert({ user_id: user.id, region });
  } else {
    await supabase
      .from("user_alert_regions")
      .delete()
      .eq("user_id", user.id)
      .eq("region", region);
  }

  return NextResponse.json({ ok: true });
}

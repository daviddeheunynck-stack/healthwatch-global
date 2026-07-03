import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID_REGIONS = new Set(["africa", "asia", "americas", "europe", "oceania"]);
const VALID_MIN_RISK = new Set(["high", "medium", "low"]);

// ── GET /api/alert-prefs — returns the user's subscribed regions ──────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_alert_regions")
    .select("region, min_risk")
    .eq("user_id", user.id);

  return NextResponse.json({
    regions: (data ?? []).map((r: { region: string }) => r.region),
    minRisk: Object.fromEntries((data ?? []).map((r: { region: string; min_risk: string }) => [r.region, r.min_risk])),
  });
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

  const body = await req.json() as { region?: string; enabled?: boolean; minRisk?: string };
  const { region, enabled, minRisk } = body;

  if (!region || !VALID_REGIONS.has(region)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  // minRisk-only update — user changed the severity threshold for an already-enabled region
  if (typeof enabled !== "boolean") {
    if (!minRisk || !VALID_MIN_RISK.has(minRisk)) {
      return NextResponse.json({ error: "enabled (boolean) or minRisk required" }, { status: 400 });
    }
    await supabase
      .from("user_alert_regions")
      .update({ min_risk: minRisk })
      .eq("user_id", user.id)
      .eq("region", region);
    return NextResponse.json({ ok: true });
  }

  if (enabled) {
    await supabase
      .from("user_alert_regions")
      .upsert({ user_id: user.id, region, min_risk: minRisk && VALID_MIN_RISK.has(minRisk) ? minRisk : "low" });
  } else {
    await supabase
      .from("user_alert_regions")
      .delete()
      .eq("user_id", user.id)
      .eq("region", region);
  }

  return NextResponse.json({ ok: true });
}

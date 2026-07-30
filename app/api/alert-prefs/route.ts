import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const VALID_REGIONS = new Set(["africa", "asia", "americas", "europe", "oceania"]);
const VALID_MIN_RISK = new Set(["high", "medium", "low"]);

// ── GET /api/alert-prefs — returns the user's subscribed regions ──────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_alert_regions")
    .select("region, min_risk")
    .eq("user_id", user.id);

  // A failed read used to fall through as "0 regions subscribed" — the
  // settings page itself couldn't reveal a query failure, only genuinely
  // "you're not subscribed to anything."
  if (error) {
    console.error("[alert-prefs] fetch failed:", error.message);
    Sentry.captureException(new Error(`[alert-prefs] fetch failed: ${error.message}`), { tags: { route: "alert-prefs", user_id: user.id } });
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }

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
  if (resolvedPlan(profile) === "free") {
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
    const { error } = await supabase
      .from("user_alert_regions")
      .update({ min_risk: minRisk })
      .eq("user_id", user.id)
      .eq("region", region);
    if (error) {
      console.error("[alert-prefs] minRisk update failed:", error.message);
      Sentry.captureException(new Error(`[alert-prefs] minRisk update failed: ${error.message}`), { tags: { route: "alert-prefs", user_id: user.id } });
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // A failed write here was previously indistinguishable from success: the
  // user toggles a region on, believes they're now covered, but no row lands
  // and they silently never get a regional alert — the same shape as the
  // West Nile incident (2026-07-30), just one step earlier in the pipeline
  // (the subscription itself, not the send).
  if (enabled) {
    const { error } = await supabase
      .from("user_alert_regions")
      .upsert({ user_id: user.id, region, min_risk: minRisk && VALID_MIN_RISK.has(minRisk) ? minRisk : "low" });
    if (error) {
      console.error("[alert-prefs] region enable failed:", error.message);
      Sentry.captureException(new Error(`[alert-prefs] region enable failed: ${error.message}`), { tags: { route: "alert-prefs", user_id: user.id } });
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("user_alert_regions")
      .delete()
      .eq("user_id", user.id)
      .eq("region", region);
    if (error) {
      console.error("[alert-prefs] region disable failed:", error.message);
      Sentry.captureException(new Error(`[alert-prefs] region disable failed: ${error.message}`), { tags: { route: "alert-prefs", user_id: user.id } });
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

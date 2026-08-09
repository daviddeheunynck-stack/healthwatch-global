import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";
import { buildAlertConfirmUrl } from "@/lib/unsubscribe-token";
import { sendAlertConfirmationEmail } from "@/lib/alert-confirm-email";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["pro", "team", "enterprise"];
const MAX_ALERTS = 20;

const BOM = String.fromCharCode(65279);
const BREVO_API_KEY = (process.env.BREVO_API_KEY ?? "").replace(new RegExp("^" + BOM), "").trim();

async function authAndPlan() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id, alert_locale").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return { error: NextResponse.json({ error: "Pro plan required" }, { status: 403 }) };
  return { user, supabase, profile };
}

export async function GET() {
  const ctx = await authAndPlan();
  if ("error" in ctx) return ctx.error;
  const { user, supabase } = ctx;
  const { data, error } = await supabase
    .from("geofence_alerts")
    .select("id, label, lat, lng, radius_km, email, last_fired_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await authAndPlan();
  if ("error" in ctx) return ctx.error;
  const { user, supabase, profile } = ctx;

  const { count } = await supabase
    .from("geofence_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_ALERTS)
    return NextResponse.json({ error: `Maximum ${MAX_ALERTS} geofence alerts` }, { status: 400 });

  const body = await req.json();
  const label     = String(body.label ?? "Zone").trim().slice(0, 64);
  const lat       = Number(body.lat);
  const lng       = Number(body.lng);
  const radius_km = Math.min(5000, Math.max(1, Math.round(Number(body.radius_km ?? 500))));
  const email     = String(body.email ?? "").trim();

  // `.includes("@")` accepted anything with an "@" anywhere in it. Aligned with
  // the regex already used by country-risk-alerts/category-alerts/subscribe/etc.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (isNaN(lat) || lat < -90 || lat > 90) return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
  if (isNaN(lng) || lng < -180 || lng > 180) return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });

  const { data, error } = await supabase
    .from("geofence_alerts")
    .insert({ user_id: user.id, label, lat, lng, radius_km, email })
    .select("id, label, lat, lng, radius_km, email, last_fired_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // See app/api/country-risk-alerts/route.ts for why: `email` is free text,
  // not necessarily the account owner's own address, so nothing recurring
  // goes out until whoever controls that inbox confirms via the signed link.
  try {
    const locale = (profile?.alert_locale as string | null) ?? "en";
    const confirmUrl = buildAlertConfirmUrl("geofence", data.id, locale);
    await sendAlertConfirmationEmail(email, "geofence", confirmUrl, locale, BREVO_API_KEY, { id: user.id, email: user.email });
  } catch (emailErr) {
    console.error("[geofence-alerts] confirmation email failed:", emailErr);
    Sentry.captureException(emailErr, { tags: { route: "geofence-alerts", part: "confirmation-email" }, extra: { alert_id: data.id } });
  }

  return NextResponse.json({ alert: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await authAndPlan();
  if ("error" in ctx) return ctx.error;
  const { user, supabase } = ctx;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await supabase.from("geofence_alerts").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error("[geofence-alerts] delete failed:", error.message);
    Sentry.captureException(new Error(`[geofence-alerts] delete failed: ${error.message}`), { tags: { route: "geofence-alerts", user_id: user.id } });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

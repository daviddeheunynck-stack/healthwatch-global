import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const PAID_PLANS       = ["pro", "team", "enterprise"];
const MAX_WEBHOOKS     = 10;
const VALID_REGIONS    = new Set(["africa", "asia", "americas", "europe", "oceania"]);
const VALID_RISK_LEVELS = new Set(["high", "medium", "low"]);

function resolvedPlan(profile: { plan?: string | null; trial_ends_at?: string | null; stripe_subscription_id?: string | null } | null): string {
  const plan = profile?.plan ?? "free";
  if (
    plan !== "free" &&
    profile?.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() < Date.now() &&
    !profile?.stripe_subscription_id
  ) return "free";
  return plan;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const { data, error } = await supabase
    .from("webhooks")
    .select("id, name, url, filters, active, last_triggered_at, last_status_code, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhooks: data ?? [] });
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
    .from("webhooks").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= MAX_WEBHOOKS)
    return NextResponse.json({ error: `Max ${MAX_WEBHOOKS} webhooks reached` }, { status: 422 });

  const body = await req.json() as {
    name?: string; url?: string;
    regions?: string[]; risk_levels?: string[];
    rt_threshold?: number;
    disease_thresholds?: { disease_en?: string; min_cases?: number }[];
    proximity?: { lat?: number; lng?: number; radius_km?: number; label?: string };
    min_change_pct?: number;
  };

  const name = (body.name ?? "").trim().slice(0, 64) || "My webhook";
  const url  = (body.url ?? "").trim();
  if (!url.startsWith("https://"))
    return NextResponse.json({ error: "URL must start with https://" }, { status: 400 });
  if (url.length > 2048)
    return NextResponse.json({ error: "URL too long" }, { status: 400 });

  const regions    = (body.regions    ?? []).filter((r) => VALID_REGIONS.has(r));
  const risk_levels = (body.risk_levels ?? ["high"]).filter((r) => VALID_RISK_LEVELS.has(r));

  const rt_threshold =
    typeof body.rt_threshold === "number" &&
    body.rt_threshold > 0 &&
    body.rt_threshold <= 10
      ? parseFloat(body.rt_threshold.toFixed(2))
      : undefined;

  const disease_thresholds = Array.isArray(body.disease_thresholds)
    ? (body.disease_thresholds as { disease_en?: string; min_cases?: number }[])
        .filter((dt) => typeof dt.disease_en === "string" && dt.disease_en.trim().length > 0 && typeof dt.min_cases === "number" && dt.min_cases > 0)
        .map((dt) => ({ disease_en: dt.disease_en!.trim().slice(0, 64), min_cases: Math.round(dt.min_cases!) }))
        .slice(0, 10)
    : [];

  const proximity =
    body.proximity &&
    typeof body.proximity.lat === "number" &&
    typeof body.proximity.lng === "number" &&
    typeof body.proximity.radius_km === "number" &&
    body.proximity.radius_km > 0 && body.proximity.radius_km <= 5000 &&
    body.proximity.lat >= -90 && body.proximity.lat <= 90 &&
    body.proximity.lng >= -180 && body.proximity.lng <= 180
      ? {
          lat: body.proximity.lat,
          lng: body.proximity.lng,
          radius_km: Math.round(body.proximity.radius_km),
          ...(typeof body.proximity.label === "string" && body.proximity.label.trim()
            ? { label: body.proximity.label.trim().slice(0, 64) }
            : {}),
        }
      : undefined;

  const min_change_pct =
    typeof body.min_change_pct === "number" &&
    body.min_change_pct > 0 &&
    body.min_change_pct <= 1000
      ? Math.round(body.min_change_pct)
      : undefined;

  const secret = randomBytes(32).toString("hex");

  const { data, error } = await supabase.from("webhooks").insert({
    user_id: user.id, name, url, secret,
    filters: {
      regions,
      risk_levels,
      ...(rt_threshold !== undefined ? { rt_threshold } : {}),
      ...(disease_thresholds.length > 0 ? { disease_thresholds } : {}),
      ...(proximity ? { proximity } : {}),
      ...(min_change_pct !== undefined ? { min_change_pct } : {}),
    },
  }).select("id, name, url, filters, active, created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ webhook: data, secret }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["pro", "team", "enterprise"];
const MAX_ALERTS = 20;

async function authAndPlan() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return { error: NextResponse.json({ error: "Pro plan required" }, { status: 403 }) };
  return { user, supabase };
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
  const { user, supabase } = ctx;

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

  if (!email || !email.includes("@")) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (isNaN(lat) || lat < -90 || lat > 90) return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
  if (isNaN(lng) || lng < -180 || lng > 180) return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });

  const { data, error } = await supabase
    .from("geofence_alerts")
    .insert({ user_id: user.id, label, lat, lng, radius_km, email })
    .select("id, label, lat, lng, radius_km, email, last_fired_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await authAndPlan();
  if ("error" in ctx) return ctx.error;
  const { user, supabase } = ctx;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await supabase.from("geofence_alerts").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

const PAID_PLANS = ["pro", "team", "enterprise"];
const MAX_ALERTS = 30;

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const { data } = await supabase
    .from("country_risk_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return Response.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!PAID_PLANS.includes(profile?.plan ?? ""))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as { country_en?: string; min_risk?: string; email?: string };
  const { country_en, min_risk, email } = body;

  if (!country_en?.trim())
    return Response.json({ error: "country_en required" }, { status: 400 });
  if (!["high", "medium", "low"].includes(min_risk ?? ""))
    return Response.json({ error: "min_risk must be high, medium, or low" }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return Response.json({ error: "Valid email required" }, { status: 400 });

  const { count } = await supabase
    .from("country_risk_alerts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_ALERTS)
    return Response.json({ error: `Max ${MAX_ALERTS} alerts per account` }, { status: 400 });

  const { data, error } = await supabase
    .from("country_risk_alerts")
    .insert({ user_id: user.id, country_en: country_en.trim(), min_risk, email })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ alert: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  await supabase
    .from("country_risk_alerts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return new Response(null, { status: 204 });
}

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PAID_PLANS    = ["pro", "team", "enterprise"];
const MAX_LIMIT     = 500;
const DEFAULT_LIMIT = 100;

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^﻿/, "").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/^﻿/, "").trim();

const VALID_REGIONS = ["africa", "asia", "americas", "europe", "oceania"];
const VALID_RISKS   = ["high", "medium", "low"];

export async function GET(req: NextRequest) {
  const service  = createService(SUPABASE_URL, SUPABASE_KEY);
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  // Auth: session cookie OR api_key param/header
  const { data: { user } } = await supabase.auth.getUser();
  let profilePlan: string | null = null;

  if (user) {
    const { data: p } = await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
    let plan = p?.plan ?? null;
    if (plan !== "free" && plan !== null && p?.trial_ends_at && new Date(p.trial_ends_at).getTime() < Date.now() && !p?.stripe_subscription_id) plan = "free";
    profilePlan = plan;
  } else {
    const keyParam = searchParams.get("api_key") ?? req.headers.get("x-api-key");
    if (keyParam) {
      const { data: p } = await service.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("api_key", keyParam).single();
      let plan = p?.plan ?? null;
      if (plan !== "free" && plan !== null && p?.trial_ends_at && new Date(p.trial_ends_at).getTime() < Date.now() && !p?.stripe_subscription_id) plan = "free";
      profilePlan = plan;
    }
  }

  if (!profilePlan) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!PAID_PLANS.includes(profilePlan)) return Response.json({ error: "Pro plan required" }, { status: 403 });

  // Filters
  const region   = searchParams.get("region");
  const risk     = searchParams.get("risk");
  const country  = searchParams.get("country");
  const search   = searchParams.get("search");
  const activeRaw = searchParams.get("active");
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);

  let query = service
    .from("outbreaks")
    .select("id, disease_en, disease, country_en, country, region, cases, deaths, risk_level, is_pheic, date, updated_at, source, ihr_event_id, event_id, admin1, lat, lng")
    .order("cases", { ascending: false })
    .limit(limit);

  if (activeRaw === "false") {
    query = query.eq("active", false);
  } else {
    query = query.eq("active", true);
  }
  if (region  && VALID_REGIONS.includes(region))  query = query.eq("region", region);
  if (risk    && VALID_RISKS.includes(risk))       query = query.eq("risk_level", risk);
  if (country) query = query.ilike("country_en", `%${country}%`);
  if (search)  {
    const q = search.trim();
    query = query.or(`disease_en.ilike.%${q}%,country_en.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(
    JSON.stringify({ outbreaks: data ?? [], count: (data ?? []).length, generated_at: new Date().toISOString() }),
    {
      headers: {
        "Content-Type":                "application/json; charset=utf-8",
        "Cache-Control":               "private, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, X-API-Key",
    },
  });
}

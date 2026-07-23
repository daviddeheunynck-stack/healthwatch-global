import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { hasRealAdmin1 } from "@/lib/outbreaks";
import { resolvedPlan } from "@/lib/resolved-plan";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

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

  // Auth: session cookie OR X-API-Key header (hwg_* prefix, SHA-256 lookup in api_keys)
  const { data: { user } } = await supabase.auth.getUser();
  let profilePlan: string | null = null;

  if (user) {
    const { data: p } = await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
    profilePlan = resolvedPlan(p);
  } else {
    const keyParam = req.headers.get("x-api-key");
    if (keyParam?.startsWith("hwg_")) {
      const keyHash = sha256(keyParam);
      const { data: apiKey } = await service.from("api_keys").select("user_id").eq("key_hash", keyHash).maybeSingle();
      if (apiKey?.user_id) {
        const { data: p } = await service.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", apiKey.user_id).single();
        profilePlan = resolvedPlan(p);
      }
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
    .select("id, disease_en, disease, country_en, country, region, cases, deaths, is_seed, risk_level, is_pheic, date, updated_at, source, ihr_event_id, event_id, admin1, lat, lng")
    .order("cases", { ascending: false })
    .limit(limit);

  if (activeRaw === "false") {
    query = query.eq("active", false);
  } else {
    // Show active outbreaks OR recent high-priority ones (prio >= 3, updated < 60 days)
    // Avoids empty map when data-quality cron deactivates resolved DON events while
    // underlying diseases (Dengue, Cholera, H5N1...) remain epidemiologically relevant.
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().split("T")[0];
    query = query.or(`active.eq.true,and(source_priority.gte.3,updated_at.gte.${sixtyDaysAgo})`);
  }
  if (region  && VALID_REGIONS.includes(region))  query = query.eq("region", region);
  if (risk    && VALID_RISKS.includes(risk))       query = query.eq("risk_level", risk);
  if (country) query = query.ilike("country_en", `%${country.trim().slice(0, 100)}%`);
  if (search) {
    const q = search.trim().slice(0, 200).replace(/[,()]/g, "");
    if (q) query = query.or(`disease_en.ilike.%${q}%,country_en.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // "~" is an internal sentinel (see lib/outbreaks.ts hasRealAdmin1) — never
  // expose it to API consumers.
  const outbreaks = (data ?? []).map((row) => ({
    ...row,
    admin1: hasRealAdmin1(row.admin1) ? row.admin1 : null,
  }));

  return new Response(
    JSON.stringify({ outbreaks, count: outbreaks.length, generated_at: new Date().toISOString() }),
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

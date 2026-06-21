import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { getOutbreaks } from "@/lib/outbreaks";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function GET(request: NextRequest) {
  // ── API key auth (programmatic access for Pro+) ──────────────────────────────
  const rawKey = request.headers.get("x-api-key") ?? "";
  if (rawKey.startsWith("hwg_")) {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const svc = createService(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    );
    const { data: apiKey } = await svc
      .from("api_keys")
      .select("user_id")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (!apiKey) return new NextResponse("Invalid API key", { status: 401 });

    const { data: kProfile } = await svc
      .from("profiles")
      .select("plan, trial_ends_at, stripe_subscription_id")
      .eq("id", apiKey.user_id)
      .single();

    let kPlan = kProfile?.plan ?? "free";
    if (
      kPlan !== "free" &&
      kProfile?.trial_ends_at &&
      new Date(kProfile.trial_ends_at).getTime() < Date.now() &&
      !kProfile?.stripe_subscription_id
    ) kPlan = "free";

    if (!["pro", "team", "enterprise"].includes(kPlan)) {
      return new NextResponse("Pro plan required for API access", { status: 403 });
    }

    svc.from("api_keys").update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash).then(() => {});

    return buildExportResponse(request);
  }

  // ── Rate limit: 20 exports / IP / hour ──────────────────────────────────────
  const ip = getClientIp(request);
  const rl = rateLimit(`export:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  // ── Session auth check ───────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized — please sign in", { status: 401 });
  }

  // ── Plan check ───────────────────────────────────────────────────────────────
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
  const isPaid = plan === "starter" || plan === "pro" || plan === "team" || plan === "enterprise";

  if (!isPaid) {
    return new NextResponse("Upgrade to Pro to export data", { status: 403 });
  }

  return buildExportResponse(request);
}

async function buildExportResponse(request: NextRequest) {

  // ── Build response ───────────────────────────────────────────────────────────
  const { getIncidenceRate } = await import("@/lib/population-data");
  const { wilsonCI } = await import("@/lib/cfr-ci");
  const outbreaks = await getOutbreaks();
  const format = new URL(request.url).searchParams.get("format");
  const date = new Date().toISOString().split("T")[0];

  const records = outbreaks.map((o) => {
    const cfr       = o.cases > 0 ? parseFloat((o.deaths / o.cases * 100).toFixed(1)) : null;
    const ci        = wilsonCI(o.deaths, o.cases);
    const incidence = getIncidenceRate(o.cases, o.country_en);
    return {
      id:                 o.id,
      disease:            o.disease_en || o.disease,
      country:            o.country_en || o.country,
      region:             o.region,
      lat:                o.lat,
      lng:                o.lng,
      cases:              o.cases,
      deaths:             o.deaths,
      cfr_pct:            cfr,
      cfr_ci_low:         ci ? ci[0] : null,
      cfr_ci_high:        ci ? ci[1] : null,
      incidence_per_100k: incidence !== null ? parseFloat(incidence.toFixed(2)) : null,
      risk_level:         o.risk_level,
      date:               o.date,
      source:             o.source,
      description:        o.description ?? null,
      pheic:              o.is_pheic,
      updated_at:         o.updated_at ?? null,
    };
  });

  if (format === "json") {
    return new NextResponse(JSON.stringify({ data: records, count: records.length, exported_at: new Date().toISOString() }, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="healthwatch-outbreaks-${date}.json"`,
        "Cache-Control": "no-store, no-cache",
      },
    });
  }

  // Default: CSV
  const escape = (s: string | number | null | undefined) => {
    const str = String(s ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const headers = Object.keys(records[0] ?? {});
  const rows    = records.map((r) => headers.map((h) => escape(r[h as keyof typeof r] as string | number | null | undefined)));
  const csv     = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="healthwatch-outbreaks-${date}.csv"`,
      "Cache-Control": "no-store, no-cache",
    },
  });
}

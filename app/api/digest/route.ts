import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { resolvedPlan } from "@/lib/resolved-plan";
import * as Sentry from "@sentry/nextjs";

const PAID_PLANS = ["pro", "team", "enterprise"];
const REGION_ORDER = ["africa", "asia", "americas", "europe", "oceania"] as const;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return Response.json({ error: "Pro plan required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const days = Math.max(1, Math.min(30, Number(searchParams.get("days") ?? 7)));

  const service = createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: all, error: allErr }, { data: newOnes, error: newErr }] = await Promise.all([
    service
      .from("outbreaks")
      .select("id, disease_en, country_en, cases, deaths, risk_level, date, region, is_pheic")
      .eq("active", true)
      .order("cases", { ascending: false }),
    service
      .from("outbreaks")
      .select("id, disease_en, country_en, cases, deaths, risk_level, date, region, is_pheic")
      .eq("active", true)
      .gte("created_at", cutoff)
      .order("cases", { ascending: false }),
  ]);

  // Neither leg was checked — a failed query rendered as a Pro-tier
  // "SITUATION DIGEST" claiming 0 active outbreaks, no PHEIC section: a false
  // all-clear in a document literally named for situational awareness.
  if (allErr || newErr) {
    const err = allErr ?? newErr;
    console.error("[digest] query failed:", err);
    Sentry.captureException(new Error(`[digest] query failed: ${err?.message}`), { tags: { route: "digest" } });
    return Response.json({ error: "Failed to generate digest" }, { status: 500 });
  }

  const outbreaks = all ?? [];
  const fresh     = newOnes ?? [];

  const pheics  = outbreaks.filter((o) => o.is_pheic);
  const highAll = outbreaks.filter((o) => o.risk_level === "high");
  const top5    = outbreaks.slice(0, 5);

  const regionCounts: Record<string, { count: number; cases: number }> = {};
  for (const o of outbreaks) {
    const r = o.region ?? "unknown";
    if (!regionCounts[r]) regionCounts[r] = { count: 0, cases: 0 };
    regionCounts[r].count++;
    regionCounts[r].cases += o.cases ?? 0;
  }

  const date = new Date().toISOString().split("T")[0];
  const from  = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
  const SEP   = "─".repeat(52);

  let text = `HEALTHWATCH GLOBAL — SITUATION DIGEST\n`;
  text += `Generated : ${date}  |  Period : ${from} → ${date}\n`;
  text += `${SEP}\n\n`;

  text += `OVERVIEW\n`;
  text += `  Active outbreaks : ${outbreaks.length}\n`;
  text += `  High risk        : ${highAll.length}  (incl. ${pheics.length} PHEIC)\n`;
  text += `  New in ${days}d      : ${fresh.length}\n\n`;

  if (pheics.length > 0) {
    text += `PUBLIC HEALTH EMERGENCIES OF INTERNATIONAL CONCERN (PHEIC)\n`;
    for (const p of pheics) {
      const cfr = p.cases > 0 && p.deaths > 0 ? `  CFR ${(p.deaths / p.cases * 100).toFixed(1)}%` : "";
      text += `  🚨 ${p.disease_en} — ${p.country_en} : ${(p.cases ?? 0).toLocaleString("en")} cases${cfr}\n`;
    }
    text += "\n";
  }

  text += `TOP OUTBREAKS BY CASE COUNT\n`;
  for (const o of top5) {
    const risk = (o.risk_level ?? "unknown").toUpperCase().padEnd(7);
    const cfr  = o.cases > 0 && o.deaths > 0 ? `  CFR ${(o.deaths / o.cases * 100).toFixed(1)}%` : "";
    text += `  [${risk}] ${o.disease_en} — ${o.country_en} : ${(o.cases ?? 0).toLocaleString("en")} cases${cfr}\n`;
  }
  text += "\n";

  text += `REGIONAL BREAKDOWN\n`;
  for (const region of REGION_ORDER) {
    const stats = regionCounts[region];
    if (!stats) continue;
    const label = region.charAt(0).toUpperCase() + region.slice(1);
    text += `  ${label.padEnd(12)} ${stats.count} outbreak(s)  ·  ${stats.cases.toLocaleString("en")} total cases\n`;
  }
  text += "\n";

  if (fresh.length > 0) {
    text += `NEW ALERTS — LAST ${days} DAYS\n`;
    for (const o of fresh.slice(0, 10)) {
      const risk = (o.risk_level ?? "unknown").toUpperCase().padEnd(7);
      text += `  [${risk}] ${o.disease_en} — ${o.country_en}  (${o.date})\n`;
    }
    if (fresh.length > 10) text += `  … and ${fresh.length - 10} more\n`;
    text += "\n";
  }

  text += `${SEP}\n`;
  text += `HealthWatch Global · healthwatch-global.com\n`;
  text += `Sources : WHO · ECDC · PAHO · Africa CDC\n`;

  return Response.json({ digest: text, generated_at: new Date().toISOString() });
}

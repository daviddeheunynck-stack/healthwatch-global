import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchSentryIssues } from "@/lib/sentry-issues";
import { getDataSourceStatus } from "@/lib/data-status";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// Price IDs the checkout tunnel actually sells (pro/team × monthly/annual × eur/usd).
// A deleted or archived price here = checkout breaks silently, so the deep check
// verifies each one still resolves to an *active* price in Stripe.
const CHECKOUT_PRICE_ENV_KEYS = [
  "STRIPE_PRO_EUR_PRICE_ID",
  "STRIPE_PRO_USD_PRICE_ID",
  "STRIPE_PRO_EUR_ANNUAL_PRICE_ID",
  "STRIPE_PRO_USD_ANNUAL_PRICE_ID",
  "STRIPE_TEAM_EUR_PRICE_ID",
  "STRIPE_TEAM_USD_PRICE_ID",
  "STRIPE_TEAM_EUR_ANNUAL_PRICE_ID",
  "STRIPE_TEAM_USD_ANNUAL_PRICE_ID",
] as const;

export async function GET(req: Request) {
  const checks: Record<string, "ok" | "error" | "unconfigured"> = {};

  // Deep checks (price-ID validation) are heavier and only for the daily routine,
  // so they run only when explicitly requested AND authenticated with CRON_SECRET.
  const cronSecret = clean(process.env.CRON_SECRET);
  const authed =
    !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;
  const deep = new URL(req.url).searchParams.get("deep") === "1" && authed;
  const priceDetail: Record<string, string> = {};

  // ── Supabase ──────────────────────────────────────────────────────────────
  try {
    const supabase = createClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );
    const { error } = await supabase.from("outbreaks").select("id").limit(1);
    checks.supabase = error ? "error" : "ok";
  } catch {
    checks.supabase = "error";
  }

  // ── Data freshness (crons running?) ──────────────────────────────────────
  try {
    const supabase2 = createClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );
    const { data: latest } = await supabase2
      .from("outbreaks")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (latest?.updated_at) {
      const hours = Math.floor(
        (Date.now() - new Date(latest.updated_at).getTime()) / 3_600_000
      );
      checks.data_freshness = hours < 48 ? "ok" : "error";
    } else {
      checks.data_freshness = "error";
    }
  } catch {
    checks.data_freshness = "error";
  }

  // ── Stripe ────────────────────────────────────────────────────────────────
  try {
    const res = await fetch("https://api.stripe.com/v1/prices?limit=1", {
      headers: { Authorization: `Bearer ${clean(process.env.STRIPE_SECRET_KEY)}` },
    });
    checks.stripe = res.ok ? "ok" : "error";
  } catch {
    checks.stripe = "error";
  }

  // ── Stripe checkout prices (deep, authenticated) ──────────────────────────
  // Confirm every price the checkout tunnel sells still resolves to an ACTIVE
  // price. Catches archived/deleted price IDs that the shallow ping above misses.
  if (deep) {
    const stripeKey = clean(process.env.STRIPE_SECRET_KEY);
    try {
      const results = await Promise.all(
        CHECKOUT_PRICE_ENV_KEYS.map(async (key) => {
          const id = clean(process.env[key]);
          // A missing env var is NOT a breakage: checkout falls back to the EUR
          // price for that plan (see checkout/route.ts), so the tunnel still works.
          // Report it as an informational note, not an error.
          if (!id) return { key, broken: false, reason: "missing (EUR fallback)" };
          const res = await fetch(`https://api.stripe.com/v1/prices/${id}`, {
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          if (!res.ok) return { key, broken: true, reason: `http_${res.status}` };
          const price = (await res.json()) as { active?: boolean };
          // A CONFIGURED but archived/inactive price IS a breakage: checkout sends
          // it to Stripe and the session creation fails.
          return { key, broken: price.active !== true, reason: price.active ? "active" : "inactive" };
        })
      );
      for (const r of results) if (r.reason !== "active") priceDetail[r.key] = r.reason;
      checks.stripe_prices = results.some((r) => r.broken) ? "error" : "ok";
    } catch {
      checks.stripe_prices = "error";
    }
  }

  // ── Brevo ─────────────────────────────────────────────────────────────────
  const brevoKey = clean(process.env.BREVO_API_KEY);
  if (!brevoKey) {
    checks.brevo = "unconfigured";
  } else {
    try {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": brevoKey },
      });
      checks.brevo = res.ok ? "ok" : "error";
    } catch {
      checks.brevo = "error";
    }
  }

  // ── Sentry (unresolved errors, last 24h) ─────────────────────────────────
  // Coarse ok/error is public like `stripe`/`brevo` above (Sentry's own coarse
  // ping); issue titles/permalinks are sensitive detail, so — like
  // `stripe_prices_detail` — only returned in `deep` (authenticated) mode.
  // `self_reports` est compté à part et ne pèse JAMAIS sur `checks.sentry` :
  // ce sont des constats du système sur lui-même (garde déclenchée, sonde de
  // couverture), pas des pannes. Avant le 2026-08-23 tout était mélangé, si
  // bien qu'une garde anti-régression ayant correctement bloqué une écriture
  // faisait passer ce contrôle au rouge. Voir captureSelfReport() dans
  // lib/cron-monitor.ts.
  type IssueBrief = { title: string; count: string; permalink: string; shortId: string };
  const sentrySummary: {
    count: number;
    self_reports: number;
    sample?: IssueBrief[];
    self_reports_sample?: IssueBrief[];
  } = { count: 0, self_reports: 0 };
  try {
    const sentryCheck = await fetchSentryIssues();
    if (!sentryCheck.ok) {
      checks.sentry = sentryCheck.error?.includes("manquant") ? "unconfigured" : "error";
    } else {
      checks.sentry = sentryCheck.issues.length > 0 ? "error" : "ok";
      sentrySummary.count = sentryCheck.issues.length;
      sentrySummary.self_reports = sentryCheck.selfReports.length;
      if (deep) {
        const brief = (i: IssueBrief): IssueBrief =>
          ({ title: i.title, count: i.count, permalink: i.permalink, shortId: i.shortId });
        sentrySummary.sample             = sentryCheck.issues.slice(0, 5).map(brief);
        sentrySummary.self_reports_sample = sentryCheck.selfReports.slice(0, 5).map(brief);
      }
    }
  } catch {
    checks.sentry = "error";
  }

  // ── Source coverage (deep only) ──────────────────────────────────────────
  // A source's cron can log "ok" indefinitely while never actually keeping a
  // single row — e.g. the 2026-07-12 bug where PAHO/Africa CDC inserts never
  // set source_priority, so WHO DON's hourly sync silently reclaimed every
  // row the moment it matched the same disease+country. Both showed 0 active
  // outbreaks in perpetuity without a single cron ever logging an error, and
  // `data_freshness` above stayed green throughout — it only checks that
  // *some* source updated a row recently, and WHO DON's hourly cadence
  // always satisfies that, masking a source stuck at zero indefinitely.
  // A same-day zero is often legitimate (Africa CDC can genuinely have
  // nothing new — verified 2026-07-12), so this only flags a source once
  // it's been at zero for a full week: `site_config` persists a
  // "first seen at zero" timestamp per source, cleared as soon as the count
  // recovers above zero.
  const sourceCoverage: { stale: string[] } = { stale: [] };
  if (deep) {
    try {
      const supabase3 = createClient(
        clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      );
      const ZERO_SINCE_DAYS = 7;
      const { sources } = await getDataSourceStatus();
      for (const s of sources) {
        const key = `source_coverage:zero_since:${s.name}`;
        if (s.count > 0) {
          await supabase3.from("site_config").delete().eq("key", key);
          continue;
        }
        const { data: existing } = await supabase3
          .from("site_config").select("value").eq("key", key).maybeSingle();
        if (!existing) {
          await supabase3.from("site_config").upsert({ key, value: new Date().toISOString() }, { onConflict: "key" });
          continue;
        }
        const days = Math.floor((Date.now() - new Date(existing.value).getTime()) / 86_400_000);
        if (days >= ZERO_SINCE_DAYS) sourceCoverage.stale.push(`${s.name} (0 foyer actif depuis ${days}j)`);
      }
      checks.source_coverage = sourceCoverage.stale.length > 0 ? "error" : "ok";
    } catch {
      checks.source_coverage = "error";
    }
  }

  const criticalChecks = deep ? ["supabase", "stripe", "stripe_prices"] : ["supabase", "stripe"];
  const allCriticalOk  = criticalChecks.every((k) => checks[k] === "ok");
  // Sentry is an observability signal, not a dependency — an unresolved issue
  // shouldn't flip the whole liveness probe to 503 (it stays visible in the body).
  const anyError       = Object.entries(checks).some(([k, v]) => v === "error" && k !== "sentry");

  const status = !allCriticalOk ? "degraded" : anyError ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      checks,
      ...(Object.keys(priceDetail).length ? { stripe_prices_detail: priceDetail } : {}),
      ...(checks.sentry && checks.sentry !== "unconfigured" ? { sentry_issues: sentrySummary } : {}),
      ...(sourceCoverage.stale.length ? { source_coverage_detail: sourceCoverage } : {}),
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 }
  );
}

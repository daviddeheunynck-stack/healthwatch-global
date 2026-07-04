import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const criticalChecks = deep ? ["supabase", "stripe", "stripe_prices"] : ["supabase", "stripe"];
  const allCriticalOk  = criticalChecks.every((k) => checks[k] === "ok");
  const anyError       = Object.values(checks).some((v) => v === "error");

  const status = !allCriticalOk ? "degraded" : anyError ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      checks,
      ...(Object.keys(priceDetail).length ? { stripe_prices_detail: priceDetail } : {}),
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 }
  );
}

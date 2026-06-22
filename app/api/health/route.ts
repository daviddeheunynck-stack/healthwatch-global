import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function GET() {
  const checks: Record<string, "ok" | "error" | "unconfigured"> = {};

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
      checks.data_freshness = hours < 12 ? "ok" : "error";
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

  const criticalChecks = ["supabase", "stripe"];
  const allCriticalOk  = criticalChecks.every((k) => checks[k] === "ok");
  const anyError       = Object.values(checks).some((v) => v === "error");

  const status = !allCriticalOk ? "degraded" : anyError ? "degraded" : "ok";

  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    { status: status === "ok" ? 200 : 503 }
  );
}

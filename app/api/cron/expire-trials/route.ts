// Cron: expire free trials that were never converted to a Stripe subscription.
// Runs daily at 10:00 UTC (configured in vercel.json alongside other crons).
// Only affects users with trial_ends_at < now AND stripe_subscription_id IS NULL.
// Users with a Stripe subscription are managed exclusively by the Stripe webhook.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function GET(req: NextRequest) {
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const now = new Date().toISOString();

  // Find non-free users whose trial has expired and who have no Stripe subscription
  const { data: expired, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, email, plan, trial_ends_at")
    .not("plan", "eq", "free")
    .not("trial_ends_at", "is", null)
    .lt("trial_ends_at", now)
    .is("stripe_subscription_id", null);

  if (fetchErr) {
    console.error("[expire-trials] DB query error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    console.log("[expire-trials] No expired trials to downgrade.");
    return NextResponse.json({ downgraded: 0 });
  }

  console.log(`[expire-trials] ${expired.length} expired trial(s) to downgrade.`);

  const ids = expired.map((p) => p.id);
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ plan: "free", trial_ends_at: null })
    .in("id", ids);

  if (updateErr) {
    console.error("[expire-trials] Batch update error:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  console.log(`[expire-trials] Downgraded ${ids.length} user(s): ${ids.join(", ")}`);
  return NextResponse.json({ downgraded: ids.length, users: expired.map((p) => p.email) });
}

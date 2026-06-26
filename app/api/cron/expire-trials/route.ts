// Cron: expire free trials that were never converted to a Stripe subscription.
// Runs daily at 10:00 UTC (configured in vercel.json alongside other crons).
// Only affects users with trial_ends_at < now AND stripe_subscription_id IS NULL.
// Users with a Stripe subscription are managed exclusively by the Stripe webhook.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildTrialExpiredEmail } from "@/lib/onboarding-emails";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export async function GET(req: NextRequest) {
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const now = new Date().toISOString();

  const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

  async function sendEmail(to: string, subject: string, html: string) {
    if (!BREVO_API_KEY) return;
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
  }

  // Find non-free users whose trial has expired and who have no Stripe subscription
  const { data: expired, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, email, plan, trial_ends_at, locale, display_filters")
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
  // Keep trial_ends_at as-is (expired date). If we null it out, the checkout
  // route sees dbTrialEndsAt=null and re-grants a fresh 14-day Stripe trial to
  // users who already consumed their DB trial — a second free trial they never
  // earned. With the expired date preserved, the checkout route calculates
  // trialDaysRemaining=0 and skips the Stripe trial entirely.
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ plan: "free" })
    .in("id", ids);

  if (updateErr) {
    console.error("[expire-trials] Batch update error:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Deactivate webhooks so they stop firing after trial expiry
  await supabase.from("webhooks").update({ active: false }).in("user_id", ids);

  console.log(`[expire-trials] Downgraded ${ids.length} user(s): ${ids.join(", ")}`);

  // Send trial-expired email to each downgraded user (skip if opted out)
  for (const user of expired) {
    const df = user.display_filters as Record<string, unknown> | null;
    if (df?.no_weekly_signal) continue;
    try {
      const { subject, html } = buildTrialExpiredEmail(user.locale ?? "en", user.id);
      await sendEmail(user.email, subject, html);
    } catch (err) {
      console.error(`[expire-trials] Email failed for ${user.email}:`, err);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  return NextResponse.json({ downgraded: ids.length, users: expired.map((p) => p.email) });
}

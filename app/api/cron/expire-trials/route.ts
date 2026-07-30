// Cron: expire free trials that were never converted to a Stripe subscription.
// Runs daily at 10:00 UTC (configured in vercel.json alongside other crons).
// Only affects users with trial_ends_at < now AND stripe_subscription_id IS NULL.
// Users with a Stripe subscription are managed exclusively by the Stripe webhook.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildTrialExpiredEmail } from "@/lib/onboarding-emails";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";

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

  // Defensive wrapper: the webhook/scheduled-report deactivation below and the
  // per-user email loop's setup run outside any enclosing try/catch. An
  // uncaught exception there propagated straight out: bare 500, no Sentry
  // event, logCronRun never reached. Same root cause as the sync-outbreaks
  // incident of 2026-07-29.
  try {
    return await runExpireTrials(req, supabase);
  } catch (err) {
    console.error("[expire-trials] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "expire-trials" } });
    await logCronRun(supabase, "expire-trials", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runExpireTrials(_req: NextRequest, supabase: SupabaseClient) {
  const now = new Date().toISOString();

  const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

  async function sendEmail(to: string, subject: string, html: string) {
    if (!BREVO_API_KEY) return;
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
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
    .select("id, email, plan, trial_ends_at, locale, display_filters, email_blocked_at")
    .not("plan", "eq", "free")
    .not("trial_ends_at", "is", null)
    .lt("trial_ends_at", now)
    .is("stripe_subscription_id", null);

  if (fetchErr) {
    console.error("[expire-trials] DB query error:", fetchErr);
    Sentry.captureException(fetchErr, { tags: { cron: "expire-trials" } });
    await logCronRun(supabase, "expire-trials", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    console.log("[expire-trials] No expired trials to downgrade.");
    await logCronRun(supabase, "expire-trials", "ok", 0);
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
    Sentry.captureException(updateErr, { tags: { cron: "expire-trials" } });
    await logCronRun(supabase, "expire-trials", "error", 0, updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Deactivate webhooks and scheduled reports so they stop firing after trial expiry —
  // independent tables, both keyed off the same `ids`, no need to wait on one before the other.
  await Promise.all([
    supabase.from("webhooks").update({ active: false }).in("user_id", ids),
    supabase.from("scheduled_reports").update({ active: false }).in("user_id", ids),
  ]);

  console.log(`[expire-trials] Downgraded ${ids.length} user(s): ${ids.join(", ")}`);

  // Send trial-expired email to each downgraded user (skip if opted out)
  let emailErrors = 0;
  for (const user of expired) {
    const df = user.display_filters as Record<string, unknown> | null;
    if (df?.no_onboarding_emails) continue;
    // Blocked address: the plan downgrade above still applies to everyone
    // (billing/access state, unrelated to email deliverability) — only the
    // send is skipped here. See lib/brevo-blocklist.ts.
    if (user.email_blocked_at) continue;
    try {
      const { subject, html } = buildTrialExpiredEmail(user.locale ?? "en", user.id);
      if (isRealProduction) {
        await sendEmail(user.email, subject, html);
      }
    } catch (err) {
      emailErrors++;
      console.error(`[expire-trials] Email failed for ${user.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "expire-trials", user_id: user.id } });
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const hb = process.env.BETTERSTACK_HB_EXPIRE_TRIALS;
  if (hb) fetch(hb).catch(() => {});

  // The downgrade itself already succeeded by this point (ids.length reflects
  // that) — emailErrors only affects the notification, not billing state — but
  // it was previously untracked, so a Brevo outage here was invisible.
  await logCronRun(supabase, "expire-trials", emailErrors > 0 ? "error" : "ok", ids.length,
    emailErrors > 0 ? `${emailErrors} email(s) d'expiration en échec` : undefined);
  return NextResponse.json({ downgraded: ids.length, users: expired.map((p) => p.email), emailErrors });
}

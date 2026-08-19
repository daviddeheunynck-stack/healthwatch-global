import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildTrialEndingEmail } from "@/lib/trial-ending-email";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction, isLiveCronInvocation, claimEmailSend, pingHeartbeatIfHealthy } from "@/lib/cron-monitor";
import { getLocalizedDisease } from "@/lib/outbreaks";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Returns whether the email was actually sent (see weekly-digest for the
// same fix — sent++ used to run unconditionally even when the key was missing).
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!BREVO_KEY) {
    console.warn("[trial-reminders] BREVO_API_KEY not set — skipping send");
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error for ${to}: ${err}`);
  }
  return true;
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    console.error("[trial-reminders] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Defensive wrapper: an uncaught exception anywhere before or between the
  // fetch/loop below (only the per-user email has a local try/catch) used to
  // propagate straight out — bare 500, no Sentry event, logCronRun never
  // reached. Same root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runTrialReminders(req, supabase);
  } catch (err) {
    console.error("[trial-reminders] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "trial-reminders" } });
    await logCronRun(supabase, "trial-reminders", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runTrialReminders(req: NextRequest, supabase: SupabaseClient) {
  // See lib/cron-monitor.ts for what this does and does not guarantee.
  const isLive = isLiveCronInvocation(req);

  // ── Target windows ──────────────────────────────────────────────────────────
  // J-3 window: trial_ends_at in [now + 2.5d, now + 3.5d)
  // J-1 window: trial_ends_at in [now + 0.5d, now + 1.5d)
  // The cron runs daily at 09:30 UTC. The ±0.5-day window ensures each user is
  // caught exactly once per reminder even if the cron drifts slightly.
  const now = Date.now();
  const j3Start = new Date(now + 2.5 * 86_400_000).toISOString();
  const j3End   = new Date(now + 3.5 * 86_400_000).toISOString();
  const j1Start = new Date(now + 0.5 * 86_400_000).toISOString();
  const j1End   = new Date(now + 1.5 * 86_400_000).toISOString();

  // Stripe users (stripe_subscription_id set) receive `customer.subscription.trial_will_end`
  // directly from Stripe 3 days before expiry — the cron would double-email them.
  // Only manual trials (no Stripe subscription) need cron-driven reminders.
  // This assumes that Dashboard event is actually enabled (see the comment on
  // the trial_will_end handler in app/api/webhook/route.ts — nothing in this
  // repo confirms it is). health-check's checkUncoveredStripeTrials (added
  // 2026-08-18) is the safety net if it isn't: it flags any Stripe trial
  // without a payment method regardless of which email path was supposed to
  // reach them.
  //
  // Independent of the outbreaks fetch below (neither depends on the other's
  // result) — run both concurrently instead of one after the other.
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: profiles, error }, { data: recentOutbreaks }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, plan, trial_ends_at, locale, stripe_subscription_id, display_filters, is_pilot, pilot_organization")
      .in("plan", ["starter", "pro"])
      .not("trial_ends_at", "is", null)
      .is("stripe_subscription_id", null)
      .is("email_blocked_at", null)
      .or(`and(trial_ends_at.gte.${j3Start},trial_ends_at.lt.${j3End}),and(trial_ends_at.gte.${j1Start},trial_ends_at.lt.${j1End})`),
    // Active HIGH/MEDIUM outbreaks fetched once for all users — filter per region below
    supabase
      .from("outbreaks")
      .select("disease, disease_en, disease_ar, country, risk_level, region")
      .eq("active", true)
      .in("risk_level", ["high", "medium"])
      .gte("updated_at", sevenDaysAgo),
  ]);

  if (error) {
    console.error("[trial-reminders] DB query error:", error);
    Sentry.captureException(error, { tags: { cron: "trial-reminders" } });
    await logCronRun(supabase, "trial-reminders", "error", 0, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    console.log("[trial-reminders] No trials ending in ~3 days.");
    await logCronRun(supabase, "trial-reminders", "ok", 0);
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  console.log(`[trial-reminders] ${profiles.length} trial(s) ending soon (J-3 or J-1)`);

  let sent         = 0;
  let failed       = 0;
  let skippedNoKey = 0;
  // Claimed-but-already-sent, i.e. a duplicate Vercel invocation of this same
  // scheduled run — see claimEmailSend() in lib/cron-monitor.ts.
  let deduped      = 0;
  // Eligible recipients not actually emailed because this invocation wasn't
  // recognized as live (see isLiveCronInvocation) — reported for visibility.
  const dryRunRecipients: string[] = [];

  for (const profile of profiles) {
    if (!profile.email) continue;

    try {
      const locale = profile.locale ?? "en";
      const plan = profile.plan as "starter" | "pro";

      // Build regional context from already-fetched outbreaks
      const userRegion = (profile.display_filters as { region?: string } | null)?.region ?? "all";
      const regionalOutbreaks = (recentOutbreaks ?? []).filter(o =>
        userRegion === "all" || o.region === userRegion
      );
      const regionalContext = regionalOutbreaks.length > 0
        ? { count: regionalOutbreaks.length, diseases: [...new Set(regionalOutbreaks.map(o => getLocalizedDisease(o, locale)))].slice(0, 3) }
        : null;

      const { subject, html } = buildTrialEndingEmail(plan, locale, profile.trial_ends_at, !!profile.stripe_subscription_id, regionalContext, {
        isPilot: !!profile.is_pilot,
        organization: (profile.pilot_organization as string | null) ?? null,
      });

      if (isRealProduction && isLive) {
        // The query above OR-matches two disjoint windows (J-3, J-1) into one
        // list with no separate tag — derive which one this profile matched
        // so the two milestones claim independent dedup slots (a user must
        // still get both, days apart, just not either one twice).
        const step = new Date(profile.trial_ends_at).getTime() < new Date(j1End).getTime() ? "j1" : "j3";
        if (await claimEmailSend(supabase, profile.id, "trial-reminders", step)) {
          const ok = await sendEmail(profile.email, subject, html);
          if (ok) sent++; else skippedNoKey++;
        } else {
          deduped++;
        }
      } else if (isRealProduction) {
        dryRunRecipients.push(profile.email);
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[trial-reminders] Failed for ${profile.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "trial-reminders", user_id: profile.id } });
      failed++;
    }

    // Throttle — stay within Brevo rate limits
    await new Promise((r) => setTimeout(r, 150));
  }

  pingHeartbeatIfHealthy(process.env.BETTERSTACK_HB_TRIAL_REMINDERS, failed, sent + failed);

  if (dryRunRecipients.length > 0) {
    console.log(`[trial-reminders] dry run (not a recognized live invocation) — would have sent: ${dryRunRecipients.join(", ")}`);
  }

  // Was only checking skippedNoKey (a single global "no Brevo key" condition) —
  // `failed`, incremented per-user in the catch above, was tracked but never
  // consulted here, so a genuine per-user send failure still logged "ok".
  await logCronRun(supabase, "trial-reminders", skippedNoKey > 0 || failed > 0 ? "error" : "ok", sent,
    failed > 0 ? `${failed} rappel(s) en échec` : undefined);
  console.log(`[trial-reminders] Done — ${sent} sent, ${failed} failed, ${skippedNoKey} skipped (no key).`);
  return NextResponse.json({
    sent, failed, skippedNoKey, deduped, total: profiles.length,
    live: isLive,
    dryRunRecipients: dryRunRecipients.length > 0 ? dryRunRecipients : undefined,
  });
}

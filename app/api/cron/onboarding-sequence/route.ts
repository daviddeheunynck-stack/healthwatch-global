import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildJ1Email, buildJ3Email, buildJ7Email, buildPilotConversionEmail } from "@/lib/onboarding-emails";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction, isLiveCronInvocation, claimEmailSend, pingHeartbeatIfHealthy } from "@/lib/cron-monitor";
import { sendBrevoEmail } from "@/lib/brevo-send";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY    = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Distinct sender identity for this cron only (2026-08-23) — 3 of the 6 real
// unsubscribes in the product's history clicked the mail client's native
// one-click "Unsubscribe" button on an onboarding email within 0-2 days of
// signup, and because every Brevo-sent email shared alerts@healthwatch-
// global.com, that single click also silently killed disease-alerts/
// watchlist-alerts/regional-alerts delivery for the rest of the trial —
// invisible until a manual audit (see marketing/product-ideas-log.md,
// 2026-08-23). Brevo blocks at the (recipient, sender) pair, so a different
// sender for the lifecycle sequence keeps a reflexive click here from
// touching the alerts a paying customer actually cares about.
// healthwatch-global.com is domain-authenticated in Brevo (DNS/SPF/DKIM), so
// this local part needs no separate per-address verification.
const ONBOARDING_SENDER_EMAIL = "hello@healthwatch-global.com";
const ONBOARDING_SENDER_NAME  = "HealthWatch Global";

async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl?: string) {
  await sendBrevoEmail({
    to, subject, html, unsubscribeUrl,
    apiKey: BREVO_API_KEY,
    senderEmail: ONBOARDING_SENDER_EMAIL,
    senderName: ONBOARDING_SENDER_NAME,
  });
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BREVO_API_KEY) {
    return NextResponse.json({ error: "BREVO_API_KEY not set" }, { status: 500 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    console.error("[onboarding-sequence] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Defensive wrapper: the five send loops below (only each per-user email has
  // a local try/catch) and everything connecting them ran outside any
  // enclosing try/catch. An uncaught exception there propagated straight out —
  // bare 500, no Sentry event, logCronRun never reached. Same root cause as
  // the sync-outbreaks incident of 2026-07-29.
  try {
    return await runOnboardingSequence(req, supabase);
  } catch (err) {
    console.error("[onboarding-sequence] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "onboarding-sequence" } });
    await logCronRun(supabase, "onboarding-sequence", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runOnboardingSequence(req: NextRequest, supabase: SupabaseClient) {
  // See lib/cron-monitor.ts for what this does and does not guarantee.
  const isLive = isLiveCronInvocation(req);

  // Four cohort queries (J+1/J+3/J+7/J+32) — same table, different date-window
  // filters, none depends on another's result — fetched concurrently instead of
  // one after another. Error checks below preserve the original fail-fast order
  // (abort on the first of the four that errored, same as when they ran in series).
  //
  // J+12 ("2 days left — subscribe now") was REMOVED on 2026-08-22. It was
  // anchored on created_at, so for a standard 14-day trial it fired at
  // trial_end − 2 — landing squarely between trial-reminders' J-3 and J-1,
  // which are anchored on trial_ends_at itself. Every expiring trial therefore
  // received three near-identical "your trial is ending" emails on three
  // consecutive days from two crons that don't know about each other. The two
  // trial-reminders steps are the better pair: they key off the real end date,
  // they carry regional outbreak context, and they already handle the
  // Stripe/non-Stripe split. buildJ12Email is left in lib/onboarding-emails for
  // now — unreferenced, but cheaper to revive than to rewrite if the cadence is
  // ever revisited.
  //
  // J+32 guard: trial_ends_at must be within 4 days — by day 32 regular 14-day
  // pro users have already been downgraded to free by expire-trials, so
  // plan=pro + created_at ~32 days ago + no stripe sub uniquely identifies
  // pilot users (35-day trial).
  const j32WindowEnd = new Date(Date.now() + 4 * 86_400_000).toISOString();

  const [
    { data: j1Users,  error: j1Err },
    { data: j3Users,  error: j3Err },
    { data: j7Users,  error: j7Err },
    { data: j32Users, error: j32Err },
  ] = await Promise.all([
    // ── J+1 : First action — configure alert regions ───────────────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .is("stripe_subscription_id", null)
      .is("email_blocked_at", null)
      .filter("created_at", "gte", new Date(Date.now() - 1.5 * 86400_000).toISOString())
      .filter("created_at", "lt",  new Date(Date.now() - 0.5 * 86400_000).toISOString()),
    // ── J+3 : Discover Pro features ─────────────────────────────────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .is("stripe_subscription_id", null)
      .is("email_blocked_at", null)
      .filter("created_at", "gte", new Date(Date.now() - 3.5 * 86400_000).toISOString())
      .filter("created_at", "lt",  new Date(Date.now() - 2.5 * 86400_000).toISOString()),
    // ── J+7 : Mid-trial check-in — PDF report spotlight ─────────────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .is("stripe_subscription_id", null)
      .is("email_blocked_at", null)
      .filter("created_at", "gte", new Date(Date.now() - 7.5 * 86400_000).toISOString())
      .filter("created_at", "lt",  new Date(Date.now() - 6.5 * 86400_000).toISOString()),
    // ── J+32 : Pilot conversion — 3 days left → upgrade to Team ─────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters, pilot_organization")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .lt("trial_ends_at", j32WindowEnd)
      .gt("trial_ends_at", new Date().toISOString())
      .is("stripe_subscription_id", null)
      .is("email_blocked_at", null)
      .filter("created_at", "gte", new Date(Date.now() - 32.5 * 86400_000).toISOString())
      .filter("created_at", "lt",  new Date(Date.now() - 31.5 * 86400_000).toISOString()),
  ]);

  if (j1Err) {
    console.error("[onboarding] J+1 query error:", j1Err);
    Sentry.captureException(j1Err, { tags: { cron: "onboarding-sequence", step: "j1-query" } });
    await logCronRun(supabase, "onboarding-sequence", "error", 0, j1Err.message);
    return NextResponse.json({ error: j1Err.message }, { status: 500 });
  }
  if (j3Err) {
    console.error("[onboarding] J+3 query error:", j3Err);
    Sentry.captureException(j3Err, { tags: { cron: "onboarding-sequence", step: "j3-query" } });
    await logCronRun(supabase, "onboarding-sequence", "error", 0, j3Err.message);
    return NextResponse.json({ error: j3Err.message }, { status: 500 });
  }
  if (j7Err) {
    console.error("[onboarding] J+7 query error:", j7Err);
    Sentry.captureException(j7Err, { tags: { cron: "onboarding-sequence", step: "j7-query" } });
    await logCronRun(supabase, "onboarding-sequence", "error", 0, j7Err.message);
    return NextResponse.json({ error: j7Err.message }, { status: 500 });
  }
  if (j32Err) {
    console.error("[onboarding] J+32 query error:", j32Err);
    Sentry.captureException(j32Err, { tags: { cron: "onboarding-sequence", step: "j32-query" } });
    await logCronRun(supabase, "onboarding-sequence", "error", 0, j32Err.message);
    return NextResponse.json({ error: j32Err.message }, { status: 500 });
  }

  let j1Sent = 0, j1Failed = 0;
  let j3Sent = 0, j3Failed = 0;
  let j7Sent = 0, j7Failed = 0;
  let j32Sent = 0, j32Failed = 0;
  // Claimed-but-already-sent, i.e. a duplicate Vercel invocation of this same
  // scheduled run — see claimEmailSend() in lib/cron-monitor.ts.
  let deduped = 0;
  // Eligible recipients not actually emailed because this invocation wasn't
  // recognized as live (see isLiveCronInvocation) — reported for visibility.
  const dryRunRecipients: string[] = [];

  // Lit les DEUX drapeaux, pas seulement `no_onboarding_emails` (2026-08-23 au soir).
  //
  // Motif : aucune des deux routes de desabonnement n'ecrit `no_onboarding_emails`.
  // /api/unsubscribe pose `subscriptions.active = false` + `no_weekly_signal` ;
  // /api/unsubscribe-signal pose `no_weekly_signal` + desactive la ligne
  // newsletter. Le drapeau que cette route lisait n'etait donc ecrit par
  // personne : quelqu'un qui s'inscrivait et cliquait « se desinscrire » au
  // jour 1 recevait quand meme le J+3 et le J+7, tous les jours a 09:16.
  //
  // Traiter les deux comme equivalents est le bon choix ici : personne n'a
  // jamais voulu dire « arrete les emails d'accueil mais continue le signal
  // hebdomadaire ». Les distinguer etait un accident d'implementation.
  const hasOptedOut = (u: { display_filters: unknown }) => {
    const df = u.display_filters as Record<string, unknown> | null;
    return !!(df?.no_onboarding_emails || df?.no_weekly_signal);
  };

  // ── Send J+1 emails ───────────────────────────────────────────────────────
  for (const user of j1Users ?? []) {
    if (!user.email || hasOptedOut(user)) continue;
    try {
      const locale = user.locale || "en";
      // unsubUrl deliberately NOT passed to sendEmail below: no List-Unsubscribe
      // header on this specific email (2026-08-23). J+1 is the earliest, most
      // disposable-feeling touch and the one every real one-click unsubscribe
      // in this product's history has landed on — the in-body "Unsubscribe"
      // link buildJ1Email already renders (same unsubUrl) still works for
      // anyone who deliberately wants out, just without the mail client's
      // native one-click button offering it reflexively. J+3/J+7/J+32 keep
      // the header as before.
      const { subject, html } = buildJ1Email(locale, user.id);
      if (isRealProduction && isLive) {
        if (await claimEmailSend(supabase, user.id, "onboarding-sequence", "j1")) {
          await sendEmail(user.email, subject, html);
          j1Sent++;
        } else {
          deduped++;
        }
      } else if (isRealProduction) {
        dryRunRecipients.push(`j1:${user.email}`);
      } else {
        j1Sent++;
      }
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[onboarding] J+1 failed for ${user.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "onboarding-sequence", step: "j1", user_id: user.id } });
      j1Failed++;
    }
  }

  // ── Send J+3 emails ───────────────────────────────────────────────────────
  for (const user of j3Users ?? []) {
    if (!user.email || hasOptedOut(user)) continue;
    try {
      const locale = user.locale || "en";
      const { subject, html, unsubUrl } = buildJ3Email(locale, user.id);
      if (isRealProduction && isLive) {
        if (await claimEmailSend(supabase, user.id, "onboarding-sequence", "j3")) {
          await sendEmail(user.email, subject, html, unsubUrl);
          j3Sent++;
        } else {
          deduped++;
        }
      } else if (isRealProduction) {
        dryRunRecipients.push(`j3:${user.email}`);
      } else {
        j3Sent++;
      }
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[onboarding] J+3 failed for ${user.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "onboarding-sequence", step: "j3", user_id: user.id } });
      j3Failed++;
    }
  }

  // ── Send J+7 emails ───────────────────────────────────────────────────────
  for (const user of j7Users ?? []) {
    if (!user.email || hasOptedOut(user)) continue;
    try {
      const locale = user.locale || "en";
      const { subject, html, unsubUrl } = buildJ7Email(locale, user.id);
      if (isRealProduction && isLive) {
        if (await claimEmailSend(supabase, user.id, "onboarding-sequence", "j7")) {
          await sendEmail(user.email, subject, html, unsubUrl);
          j7Sent++;
        } else {
          deduped++;
        }
      } else if (isRealProduction) {
        dryRunRecipients.push(`j7:${user.email}`);
      } else {
        j7Sent++;
      }
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[onboarding] J+7 failed for ${user.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "onboarding-sequence", step: "j7", user_id: user.id } });
      j7Failed++;
    }
  }

  // ── Send J+32 pilot conversion emails ────────────────────────────────────
  for (const user of j32Users ?? []) {
    if (!user.email || hasOptedOut(user)) continue;
    try {
      const locale = user.locale || "en";
      const { subject, html, unsubUrl } = buildPilotConversionEmail(locale, user.id, (user.pilot_organization as string | null) ?? null);
      if (isRealProduction && isLive) {
        if (await claimEmailSend(supabase, user.id, "onboarding-sequence", "j32")) {
          await sendEmail(user.email, subject, html, unsubUrl);
          j32Sent++;
        } else {
          deduped++;
        }
      } else if (isRealProduction) {
        dryRunRecipients.push(`j32:${user.email}`);
      } else {
        j32Sent++;
      }
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[onboarding] J+32 failed for ${user.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "onboarding-sequence", step: "j32", user_id: user.id } });
      j32Failed++;
    }
  }

  const onboardingSent   = j1Sent + j3Sent + j7Sent + j32Sent;
  const onboardingFailed = j1Failed + j3Failed + j7Failed + j32Failed;
  pingHeartbeatIfHealthy(process.env.BETTERSTACK_HB_ONBOARDING, onboardingFailed, onboardingSent + onboardingFailed);

  if (dryRunRecipients.length > 0) {
    console.log(`[onboarding] dry run (not a recognized live invocation) — would have sent: ${dryRunRecipients.join(", ")}`);
  }

  const totalSent = j1Sent + j3Sent + j7Sent + j32Sent;
  const totalFailed = j1Failed + j3Failed + j7Failed + j32Failed;
  // Was hardcoded "ok" — each step's Failed counter was tracked but never
  // consulted, so a genuine send failure in any of the stages still
  // logged "ok".
  await logCronRun(supabase, "onboarding-sequence", totalFailed > 0 ? "error" : "ok", totalSent,
    totalFailed > 0 ? `${totalFailed} email(s) en échec` : undefined);
  console.log(`[onboarding] J+1: ${j1Sent}/${j1Failed} | J+3: ${j3Sent}/${j3Failed} | J+7: ${j7Sent}/${j7Failed} | J+32: ${j32Sent}/${j32Failed}`);

  return NextResponse.json({
    j1:  { sent: j1Sent,  failed: j1Failed,  total: (j1Users  ?? []).length },
    j3:  { sent: j3Sent,  failed: j3Failed,  total: (j3Users  ?? []).length },
    j7:  { sent: j7Sent,  failed: j7Failed,  total: (j7Users  ?? []).length },
    j32: { sent: j32Sent, failed: j32Failed, total: (j32Users ?? []).length },
    deduped,
    live: isLive,
    dryRunRecipients: dryRunRecipients.length > 0 ? dryRunRecipients : undefined,
  });
}

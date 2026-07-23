import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildJ1Email, buildJ3Email, buildJ7Email, buildJ12Email, buildPilotConversionEmail } from "@/lib/onboarding-emails";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY    = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not set");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${err}`);
  }
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

  // Five cohort queries (J+1/J+3/J+7/J+12/J+32) — same table, different date-window
  // filters, none depends on another's result — fetched concurrently instead of
  // one after another. Error checks below preserve the original fail-fast order
  // (abort on the first of the five that errored, same as when they ran in series).
  //
  // J+12/J+32 guard: trial_ends_at must be within 4 days of J+12 — skips pilot
  // users (35-day trial) who would otherwise get a confusing "2 days left" email
  // on day 12. Pilot users have 35-day trials; by day 32 regular 14-day pro users
  // have already been downgraded to free by expire-trials, so plan=pro + created_at
  // ~32 days ago + no stripe sub uniquely identifies pilot users.
  const j12WindowEnd = new Date(Date.now() + 4 * 86_400_000).toISOString();
  const j32WindowEnd = new Date(Date.now() + 4 * 86_400_000).toISOString();

  const [
    { data: j1Users,  error: j1Err },
    { data: j3Users,  error: j3Err },
    { data: j7Users,  error: j7Err },
    { data: j12Users, error: j12Err },
    { data: j32Users, error: j32Err },
  ] = await Promise.all([
    // ── J+1 : First action — configure alert regions ───────────────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .is("stripe_subscription_id", null)
      .filter("created_at", "gte", new Date(Date.now() - 1.5 * 86400_000).toISOString())
      .filter("created_at", "lt",  new Date(Date.now() - 0.5 * 86400_000).toISOString()),
    // ── J+3 : Discover Pro features ─────────────────────────────────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .is("stripe_subscription_id", null)
      .filter("created_at", "gte", new Date(Date.now() - 3.5 * 86400_000).toISOString())
      .filter("created_at", "lt",  new Date(Date.now() - 2.5 * 86400_000).toISOString()),
    // ── J+7 : Mid-trial check-in — PDF report spotlight ─────────────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .is("stripe_subscription_id", null)
      .filter("created_at", "gte", new Date(Date.now() - 7.5 * 86400_000).toISOString())
      .filter("created_at", "lt",  new Date(Date.now() - 6.5 * 86400_000).toISOString()),
    // ── J+12 : 2 days left — subscribe now ──────────────────────────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .lt("trial_ends_at", j12WindowEnd)
      .is("stripe_subscription_id", null)
      .filter("created_at", "gte", new Date(Date.now() - 12.5 * 86400_000).toISOString())
      .filter("created_at", "lt",  new Date(Date.now() - 11.5 * 86400_000).toISOString()),
    // ── J+32 : Pilot conversion — 3 days left → upgrade to Team ─────────────
    supabase
      .from("profiles")
      .select("id, email, plan, locale, trial_ends_at, display_filters, pilot_organization")
      .eq("plan", "pro")
      .not("trial_ends_at", "is", null)
      .lt("trial_ends_at", j32WindowEnd)
      .gt("trial_ends_at", new Date().toISOString())
      .is("stripe_subscription_id", null)
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
  if (j12Err) {
    console.error("[onboarding] J+12 query error:", j12Err);
    Sentry.captureException(j12Err, { tags: { cron: "onboarding-sequence", step: "j12-query" } });
    await logCronRun(supabase, "onboarding-sequence", "error", 0, j12Err.message);
    return NextResponse.json({ error: j12Err.message }, { status: 500 });
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
  let j12Sent = 0, j12Failed = 0;
  let j32Sent = 0, j32Failed = 0;

  const hasOptedOut = (u: { display_filters: unknown }) =>
    !!(u.display_filters as Record<string, unknown> | null)?.no_onboarding_emails;

  // ── Send J+1 emails ───────────────────────────────────────────────────────
  for (const user of j1Users ?? []) {
    if (!user.email || hasOptedOut(user)) continue;
    try {
      const locale = user.locale || "en";
      const { subject, html } = buildJ1Email(locale, user.id);
      if (isRealProduction) {
        await sendEmail(user.email, subject, html);
      }
      j1Sent++;
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
      const { subject, html } = buildJ3Email(locale, user.id);
      if (isRealProduction) {
        await sendEmail(user.email, subject, html);
      }
      j3Sent++;
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
      const { subject, html } = buildJ7Email(locale, user.id);
      if (isRealProduction) {
        await sendEmail(user.email, subject, html);
      }
      j7Sent++;
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[onboarding] J+7 failed for ${user.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "onboarding-sequence", step: "j7", user_id: user.id } });
      j7Failed++;
    }
  }

  // ── Send J+12 emails ──────────────────────────────────────────────────────
  for (const user of j12Users ?? []) {
    if (!user.email || hasOptedOut(user)) continue;
    try {
      const locale = user.locale || "en";
      const { subject, html } = buildJ12Email(locale, user.id);
      if (isRealProduction) {
        await sendEmail(user.email, subject, html);
      }
      j12Sent++;
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[onboarding] J+12 failed for ${user.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "onboarding-sequence", step: "j12", user_id: user.id } });
      j12Failed++;
    }
  }

  // ── Send J+32 pilot conversion emails ────────────────────────────────────
  for (const user of j32Users ?? []) {
    if (!user.email || hasOptedOut(user)) continue;
    try {
      const locale = user.locale || "en";
      const { subject, html } = buildPilotConversionEmail(locale, user.id, (user.pilot_organization as string | null) ?? null);
      if (isRealProduction) {
        await sendEmail(user.email, subject, html);
      }
      j32Sent++;
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[onboarding] J+32 failed for ${user.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "onboarding-sequence", step: "j32", user_id: user.id } });
      j32Failed++;
    }
  }

  const hb = process.env.BETTERSTACK_HB_ONBOARDING;
  if (hb) fetch(hb).catch(() => {});

  const totalSent = j1Sent + j3Sent + j7Sent + j12Sent + j32Sent;
  await logCronRun(supabase, "onboarding-sequence", "ok", totalSent);
  console.log(`[onboarding] J+1: ${j1Sent}/${j1Failed} | J+3: ${j3Sent}/${j3Failed} | J+7: ${j7Sent}/${j7Failed} | J+12: ${j12Sent}/${j12Failed} | J+32: ${j32Sent}/${j32Failed}`);

  return NextResponse.json({
    j1:  { sent: j1Sent,  failed: j1Failed,  total: (j1Users  ?? []).length },
    j3:  { sent: j3Sent,  failed: j3Failed,  total: (j3Users  ?? []).length },
    j7:  { sent: j7Sent,  failed: j7Failed,  total: (j7Users  ?? []).length },
    j12: { sent: j12Sent, failed: j12Failed, total: (j12Users ?? []).length },
    j32: { sent: j32Sent, failed: j32Failed, total: (j32Users ?? []).length },
  });
}

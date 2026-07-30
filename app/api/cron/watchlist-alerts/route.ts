// Watchlist change notifications — runs daily at 7h UTC (after sync at 6h)
// For each user's starred outbreaks, compares current cases/deaths with
// the last notified values. Sends an email if anything changed.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildWatchlistAlertEmail } from "@/lib/watchlist-alert-email";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { errorMessage } from "@/lib/error";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { notifyMobile } from "@/lib/mobile-notify";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const CRON_SECRET   = clean(process.env.CRON_SECRET);
const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not set");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "api-key":      BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  // Defensive wrapper: an uncaught exception anywhere before or between the
  // fetches/loop below (only the per-entry send has a local try/catch) used to
  // propagate straight out — bare 500, no Sentry event, logCronRun never
  // reached. Same root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runWatchlistAlerts(req, supabase);
  } catch (err) {
    console.error("[watchlist-alerts] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "watchlist-alerts" } });
    await logCronRun(supabase, "watchlist-alerts", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runWatchlistAlerts(_req: NextRequest, supabase: SupabaseClient) {
  // 1. Get all watchlist entries with user profiles
  const { data: entries } = await supabase
    .from("user_watchlist")
    .select("user_id, outbreak_id");

  if (!entries || entries.length === 0) {
    await logCronRun(supabase, "watchlist-alerts", "ok", 0);
    return NextResponse.json({ sent: 0, unchanged: 0, message: "No watchlist entries" });
  }

  // 2-4. Current outbreak data, dedup log, and user profiles — three independent
  // queries (outbreakIds/userIds are all this loop needs), fetched concurrently.
  const outbreakIds = [...new Set(entries.map((e) => e.outbreak_id))];
  const userIds = [...new Set(entries.map((e) => e.user_id))];

  const [{ data: outbreaks }, { data: logs }, { data: profiles }] = await Promise.all([
    supabase
      .from("outbreaks")
      .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, deaths, risk_level, date, source, is_pheic")
      .in("id", outbreakIds)
      .eq("active", true),
    supabase
      .from("watchlist_alert_log")
      .select("user_id, outbreak_id, cases_at_alert, deaths_at_alert")
      .in("user_id", userIds)
      .in("outbreak_id", outbreakIds),
    supabase
      .from("profiles")
      .select("id, email, alert_locale, plan, trial_ends_at, stripe_subscription_id, email_blocked_at")
      .in("id", userIds),
  ]);

  const outbreakMap = new Map((outbreaks ?? []).map((o) => [o.id, o]));

  const logMap = new Map(
    (logs ?? []).map((l) => [`${l.user_id}:${l.outbreak_id}`, l])
  );

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, {
      email: p.email,
      locale: (p.alert_locale as string | null) ?? "en",
      plan: p.plan ?? "free",
      trial_ends_at: p.trial_ends_at as string | null,
      stripe_subscription_id: p.stripe_subscription_id as string | null,
      blocked: !!p.email_blocked_at,
    }])
  );

  // 5. Process each watchlist entry
  let sent = 0;
  let unchanged = 0;
  let blockedSkipped = 0;
  let errors = 0;

  for (const entry of entries) {
    const outbreak = outbreakMap.get(entry.outbreak_id);
    if (!outbreak) { unchanged++; continue; }

    const profile = profileMap.get(entry.user_id);
    if (!profile?.email) { unchanged++; continue; }

    // Only Pro+ users with an active subscription (not expired-trial). The old
    // isExpiredTrial check only ever fired for plan==="pro" — a starter/team/
    // enterprise trial that expired without payment kept getting watchlist
    // alerts forever, the same paid-feature leak fixed today in the other
    // alert crons. resolvedPlan() covers every plan value uniformly.
    if (!["starter", "pro", "team", "enterprise"].includes(profile.plan)) { unchanged++; continue; }
    if (resolvedPlan(profile) === "free") { unchanged++; continue; }

    // Brevo-blocked address: skip before the log upsert below rather than
    // record a false "sent" state. See lib/brevo-blocklist.ts.
    if (profile.blocked) { blockedSkipped++; continue; }

    const logKey = `${entry.user_id}:${entry.outbreak_id}`;
    const prevLog = logMap.get(logKey);

    const prevCases  = prevLog?.cases_at_alert  ?? -1;
    const prevDeaths = prevLog?.deaths_at_alert ?? -1;

    // Check if anything changed
    const casesChanged  = outbreak.cases  !== prevCases;
    const deathsChanged = outbreak.deaths !== prevDeaths;

    if (!casesChanged && !deathsChanged) { unchanged++; continue; }
    if (outbreak.cases === 0 && prevCases === -1) { unchanged++; continue; } // first sync, no meaningful data yet

    try {
      const locale = profile.locale;
      const alertOutbreak = {
        id:           outbreak.id,
        disease_en:   outbreak.disease_en ?? outbreak.disease,
        disease:      getLocalizedDisease(outbreak, locale) ?? outbreak.disease,
        country_en:   outbreak.country_en ?? outbreak.country,
        country:      getLocalizedCountry(outbreak, locale) ?? outbreak.country,
        cases:        outbreak.cases,
        deaths:       outbreak.deaths,
        risk_level:   outbreak.risk_level,
        date:         outbreak.date,
        source:       outbreak.source,
        is_pheic:     outbreak.is_pheic ?? false,
        prevCases:    Math.max(prevCases, 0),
        prevDeaths:   Math.max(prevDeaths, 0),
      };

      // Send BEFORE writing the log. If build/send throws, we must not
      // upsert watchlist_alert_log — that row is what suppresses future
      // re-alerts for this user+outbreak (compared against cases_at_alert/
      // deaths_at_alert on the next run), so logging a send that never went
      // out would silently and permanently swallow the alert. Same fix as
      // regional-alerts/disease-alerts (2026-07-30) — this cron had the
      // identical log-before-send ordering.
      const { subject, html } = buildWatchlistAlertEmail(alertOutbreak, locale, entry.user_id);
      if (isRealProduction) {
        await sendEmail(profile.email, subject, html);
      }

      const { error: logErr } = await supabase
        .from("watchlist_alert_log")
        .upsert(
          [{ user_id: entry.user_id, outbreak_id: entry.outbreak_id, cases_at_alert: outbreak.cases, deaths_at_alert: outbreak.deaths }],
          { onConflict: "user_id,outbreak_id" }
        );
      if (logErr) {
        console.error(`[watchlist-alerts] log insert failed for ${entry.user_id}/${entry.outbreak_id}:`, errorMessage(logErr));
        errors++;
        continue;
      }
      sent++;

      const inAppBody = `${alertOutbreak.disease} · ${alertOutbreak.country} · ${outbreak.cases.toLocaleString(locale === "ar" ? "ar-SA" : locale)}`;

      await supabase.from("alert_notifications").insert({
        user_id:     entry.user_id,
        type:        "watchlist",
        title:       subject,
        body:        inAppBody,
        outbreak_id: outbreak.id,
      }).then(() => {}, () => {});

      await notifyMobile(supabase, entry.user_id, { title: subject, body: inAppBody, outbreak_id: outbreak.id });

      await new Promise((r) => setTimeout(r, 150));
    } catch (err: unknown) {
      errors++;
      console.error(`[watchlist-alerts] Failed for ${profile.email}:`, errorMessage(err));
      Sentry.captureException(err, { tags: { cron: "watchlist-alerts", user_id: entry.user_id, outbreak_id: entry.outbreak_id } });
    }
  }

  await logCronRun(supabase, "watchlist-alerts", errors > 0 ? "error" : "ok", sent,
    errors > 0 ? `${errors} alerte(s) en échec` : undefined);
  console.log(`[watchlist-alerts] Done — sent: ${sent}, unchanged: ${unchanged}, blockedSkipped: ${blockedSkipped}, errors: ${errors}`);
  return NextResponse.json({ sent, unchanged, blockedSkipped, errors });
}

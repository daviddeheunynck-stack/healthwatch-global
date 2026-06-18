// Watchlist change notifications — runs daily at 7h UTC (after sync at 6h)
// For each user's starred outbreaks, compares current cases/deaths with
// the last notified values. Sends an email if anything changed.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildWatchlistAlertEmail } from "@/lib/watchlist-alert-email";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const CRON_SECRET = clean(process.env.CRON_SECRET);

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key":      clean(process.env.BREVO_API_KEY),
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
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  // 1. Get all watchlist entries with user profiles
  const { data: entries } = await supabase
    .from("user_watchlist")
    .select("user_id, outbreak_id");

  if (!entries || entries.length === 0) {
    return NextResponse.json({ sent: 0, unchanged: 0, message: "No watchlist entries" });
  }

  // 2. Get unique outbreak IDs and fetch current data
  const outbreakIds = [...new Set(entries.map((e) => e.outbreak_id))];
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, deaths, risk_level, date, source, is_pheic")
    .in("id", outbreakIds)
    .eq("active", true);

  const outbreakMap = new Map((outbreaks ?? []).map((o) => [o.id, o]));

  // 3. Get last alert log for deduplication
  const userIds = [...new Set(entries.map((e) => e.user_id))];
  const { data: logs } = await supabase
    .from("watchlist_alert_log")
    .select("user_id, outbreak_id, cases_at_alert, deaths_at_alert")
    .in("user_id", userIds)
    .in("outbreak_id", outbreakIds);

  const logMap = new Map(
    (logs ?? []).map((l) => [`${l.user_id}:${l.outbreak_id}`, l])
  );

  // 4. Get user profiles for email + locale
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, locale, plan, trial_ends_at, stripe_subscription_id")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, {
      email: p.email,
      locale: p.locale ?? "fr",
      plan: p.plan ?? "free",
      trial_ends_at: p.trial_ends_at as string | null,
      stripe_subscription_id: p.stripe_subscription_id as string | null,
    }])
  );

  // 5. Process each watchlist entry
  let sent = 0;
  let unchanged = 0;
  const toLog: { user_id: string; outbreak_id: string; cases_at_alert: number; deaths_at_alert: number }[] = [];

  for (const entry of entries) {
    const outbreak = outbreakMap.get(entry.outbreak_id);
    if (!outbreak) { unchanged++; continue; }

    const profile = profileMap.get(entry.user_id);
    if (!profile?.email) { unchanged++; continue; }

    // Only Pro+ users with an active subscription (not expired-trial)
    if (!["starter", "pro", "team", "enterprise"].includes(profile.plan)) { unchanged++; continue; }
    const isExpiredTrial = profile.plan === "pro"
      && !profile.stripe_subscription_id
      && !!profile.trial_ends_at
      && new Date(profile.trial_ends_at) < new Date();
    if (isExpiredTrial) { unchanged++; continue; }

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

      const { subject, html } = buildWatchlistAlertEmail(alertOutbreak, locale, entry.user_id);
      await sendEmail(profile.email, subject, html);
      toLog.push({
        user_id:        entry.user_id,
        outbreak_id:    entry.outbreak_id,
        cases_at_alert: outbreak.cases,
        deaths_at_alert: outbreak.deaths,
      });
      sent++;

      await new Promise((r) => setTimeout(r, 150));
    } catch (err: unknown) {
      console.error(`[watchlist-alerts] Failed for ${profile.email}:`, errorMessage(err));
    }
  }

  // 6. Update alert log
  if (toLog.length > 0) {
    await supabase
      .from("watchlist_alert_log")
      .upsert(toLog, { onConflict: "user_id,outbreak_id" });
  }

  console.log(`[watchlist-alerts] Done — sent: ${sent}, unchanged: ${unchanged}`);
  return NextResponse.json({ sent, unchanged });
}

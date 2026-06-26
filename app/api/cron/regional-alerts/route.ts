/**
 * Cron: /api/cron/regional-alerts
 * Schedule: 30 minutes after the sync-outbreaks cron (06:30 UTC daily).
 *
 * For every outbreak added in the last 25 hours:
 *   1. Find paid users who subscribed to that region
 *   2. Skip users who already received an alert for that outbreak (log table)
 *   3. Send a localized email
 *   4. Write to outbreak_alert_log
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildOutbreakAlertEmail } from "@/lib/alert-emails";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY    = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL || "https://healthwatch-global.com");

const REGION_LABELS: Record<string, Record<string, string>> = {
  fr: { africa: "Afrique", asia: "Asie", americas: "Amériques", europe: "Europe", oceania: "Océanie" },
  en: { africa: "Africa",  asia: "Asia",  americas: "Americas",  europe: "Europe", oceania: "Oceania"  },
  es: { africa: "África",  asia: "Asia",  americas: "Américas",  europe: "Europa", oceania: "Oceanía"  },
  ar: { africa: "أفريقيا", asia: "آسيا",  americas: "الأمريكتان", europe: "أوروبا", oceania: "أوقيانوسيا" },
  id: { africa: "Afrika",  asia: "Asia",  americas: "Amerika",   europe: "Eropa",  oceania: "Oseania"  },
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not set");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BREVO_API_KEY) {
    return NextResponse.json({ error: "BREVO_API_KEY not set" }, { status: 500 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    console.error("[regional-alerts] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // ── 1. Find outbreaks added in the last 25 hours ──────────────────────────
  const since = new Date(Date.now() - 25 * 3600_000).toISOString();

  const { data: newOutbreaks, error: oErr } = await supabase
    .from("outbreaks")
    .select("id, region, disease, disease_fr, disease_es, disease_ar, disease_id, country, country_fr, country_es, country_ar, country_id, risk_level, date, cases, deaths")
    .eq("active", true)
    .gte("created_at", since);

  if (oErr) {
    console.error("[regional-alerts] outbreaks query error:", oErr);
    return NextResponse.json({ error: oErr.message }, { status: 500 });
  }

  if (!newOutbreaks || newOutbreaks.length === 0) {
    return NextResponse.json({ message: "No new outbreaks", sent: 0, skipped: 0 });
  }

  // ── 2. Group outbreak IDs by region ──────────────────────────────────────
  const byRegion = new Map<string, typeof newOutbreaks>();
  for (const o of newOutbreaks) {
    const arr = byRegion.get(o.region) ?? [];
    arr.push(o);
    byRegion.set(o.region, arr);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // ── 3. For each region with new outbreaks ─────────────────────────────────
  for (const [region, outbreaks] of byRegion) {
    // Find paid users subscribed to this region
    const { data: subscribers } = await supabase
      .from("user_alert_regions")
      .select("user_id")
      .eq("region", region);

    if (!subscribers || subscribers.length === 0) continue;

    const userIds = subscribers.map((s: { user_id: string }) => s.user_id);

    // Get their email, locale, and Slack webhook (from profiles)
    const { data: rawProfiles } = await supabase
      .from("profiles")
      .select("id, email, plan, trial_ends_at, stripe_subscription_id, locale, slack_webhook_url")
      .in("id", userIds)
      .in("plan", ["starter", "pro", "team", "enterprise"]);

    // Apply trial expiry guard: skip users whose trial has ended and have no active Stripe sub
    const now = Date.now();
    const profiles = (rawProfiles ?? []).filter((p) => {
      if (p.plan === "free") return false;
      if (p.trial_ends_at && new Date(p.trial_ends_at).getTime() < now && !p.stripe_subscription_id) return false;
      return true;
    });

    if (profiles.length === 0) continue;

    // Build locale map from profiles.locale (set at signup)
    const localeMap = new Map<string, string>();
    for (const p of profiles) {
      localeMap.set(p.id, p.locale ?? "fr");
    }

    for (const profile of profiles) {
      for (const outbreak of outbreaks) {
        // Check alert log to avoid duplicates
        const { data: alreadySent } = await supabase
          .from("outbreak_alert_log")
          .select("user_id")
          .eq("user_id", profile.id)
          .eq("outbreak_id", String(outbreak.id))
          .maybeSingle();

        if (alreadySent) {
          skipped++;
          continue;
        }

        const locale = localeMap.get(profile.id) ?? "fr";
        const rl     = REGION_LABELS[locale] ?? REGION_LABELS.en;

        // Resolve localized disease / country names
        const disease =
          (locale === "fr" ? outbreak.disease_fr : null) ??
          (locale === "es" ? outbreak.disease_es : null) ??
          (locale === "ar" ? outbreak.disease_ar : null) ??
          (locale === "id" ? outbreak.disease_id : null) ??
          outbreak.disease;

        const country =
          (locale === "fr" ? outbreak.country_fr : null) ??
          (locale === "es" ? outbreak.country_es : null) ??
          (locale === "ar" ? outbreak.country_ar : null) ??
          (locale === "id" ? outbreak.country_id : null) ??
          outbreak.country;

        const regionLabel = rl[region] ?? region;
        const riskEmoji   = outbreak.risk_level === "high" ? "🔴" : outbreak.risk_level === "medium" ? "🟡" : "🟢";
        const dashboardUrl = `${APP_URL}/${locale}`;

        try {
          // ── Log first — prevents duplicate alerts if log insert fails later ─
          const { error: logErr } = await supabase.from("outbreak_alert_log").insert({
            user_id:     profile.id,
            outbreak_id: String(outbreak.id),
          });
          if (logErr) {
            console.error(`[regional-alerts] log insert failed for ${profile.id}/${outbreak.id}:`, logErr.message);
            failed++;
            continue;
          }

          // ── Email ───────────────────────────────────────────────────────
          const { subject, html } = buildOutbreakAlertEmail(
            locale,
            regionLabel,
            {
              disease,
              country,
              risk_level: outbreak.risk_level,
              date:       outbreak.date,
              cases:      outbreak.cases,
              deaths:     outbreak.deaths,
            },
            dashboardUrl
          );
          await sendEmail(profile.email, subject, html);

          // ── Slack / Teams (fire-and-forget, non-blocking) ───────────────
          const slackUrl: string | null = profile.slack_webhook_url ?? null;
          if (slackUrl) {
            const slackBody = {
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `${riskEmoji} *New outbreak — ${regionLabel}*\n*${disease}* · ${country}`,
                  },
                },
                {
                  type: "context",
                  elements: [
                    { type: "mrkdwn", text: `Risk: *${outbreak.risk_level}* · Date: ${outbreak.date}${outbreak.cases ? ` · Cases: ${outbreak.cases.toLocaleString("en")}` : ""}` },
                  ],
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: { type: "plain_text", text: "View dashboard →" },
                      url: dashboardUrl,
                      style: "danger",
                    },
                  ],
                },
              ],
            };
            fetch(slackUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(slackBody),
            }).catch((e) => console.error("[regional-alerts] Slack post failed:", e));
          }

          sent++;
        } catch (err) {
          console.error(`[regional-alerts] failed to send to ${profile.email}:`, err);
          Sentry.captureException(err, { tags: { cron: "regional-alerts", user_id: profile.id, outbreak_id: String(outbreak.id) } });
          failed++;
        }

        // Respect Brevo rate limit
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  return NextResponse.json({
    newOutbreaks: newOutbreaks.length,
    sent,
    skipped,
    failed,
  });
}

/**
 * Cron: /api/cron/regional-alerts
 * Schedule: 10:30 UTC daily — after the 08:00-10:00 UTC sync crons that
 * populate outbreaks, not before them (moved from 06:30 on 2026-08-03; the
 * pre-move schedule ran alerts ~22h ahead of same-day sync data, see
 * project_alert_crons_run_before_syncs_2026_08_03 in memory).
 *
 * For every outbreak created OR updated in the last 25 hours:
 *   1. Find paid users who subscribed to that region
 *   2. Skip users already alerted at this outbreak's current risk_level with
 *      no case surge since (outbreak_alert_log tracks the state we last
 *      alerted each user at, not just whether we ever alerted them)
 *   3. Collect every qualifying outbreak per user across all their regions,
 *      then send ONE localized email per user — a single-outbreak email if
 *      only one qualifies, otherwise a digest listing all of them ("new" vs
 *      "update" badge per item)
 *   4. Upsert outbreak_alert_log with the new state, one row per outbreak
 *
 * Since 2026-08-02: batches into one email per user per run instead of one
 * email per (user, outbreak) pair. A single new signup used to match every
 * outbreak the daily sync had just touched across all 5 regions — up to 97
 * separate emails in one run for one inbox — which correlates with the only
 * two real trial users who unsubscribed (one within 36h of provisioning,
 * before ever logging in). See project_alert_onboarding_batch_flood_2026_08_02
 * in memory.
 *
 * Before 2026-07-23 this only looked at created_at, so an outbreak sitting
 * active and getting worse day after day (Ebola/Uganda-DRC, cholera/Chad,
 * etc.) never re-notified anyone past the first email — the exact gap that
 * left two provisioned trial users with nothing but a day-one PHEIC backfill
 * for their whole 35-day trial.
 *
 * Since 2026-07-29: skips (and does not log) any profile with
 * email_blocked_at set — Brevo blocks a contact silently (hard bounce, or
 * its own List-Unsubscribe) and the send just fails, but outbreak_alert_log
 * was still being upserted first, so two blocked trial users had 100+ rows
 * claiming delivery that never happened. See lib/brevo-blocklist.ts and the
 * sync-brevo-blocklist cron, which populates the flag 30min before this runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildOutbreakAlertEmail, buildOutbreakDigestEmail, type DigestItem } from "@/lib/alert-emails";
import { buildTrialValueNudgeEmail } from "@/lib/trial-value-nudge-email";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY    = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL || "https://healthwatch-global.com");

const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
function riskMeetsThreshold(risk: string, minRisk: string): boolean {
  return (RISK_RANK[risk] ?? 0) >= (RISK_RANK[minRisk] ?? 0);
}

// Cap how many outbreaks get itemized in a single user's digest email. Not a
// cap on how many get logged/counted as delivered — every matched outbreak
// still gets an outbreak_alert_log row and a Slack ping (if configured); this
// only bounds what's readable in one email, with the excess summarized as
// "+N more, see dashboard" instead of listed. Without this, the 97-outbreak
// batch measured on 2026-07-26 would just become a 97-item email instead of
// 97 separate ones — still unreadable, still the kind of send that likely
// drove the only two real unsubscribes HWG has seen. See
// project_alert_onboarding_batch_flood_2026_08_02 in memory for the
// measurement behind this number; 10 is a starting guess, not tuned data.
const MAX_DIGEST_ITEMS_PER_EMAIL = 10;
const REASON_RANK: Record<AlertReason, number> = { new: 3, escalated: 2, surge: 1 };

// How much a case count has to jump (relative to the count we last alerted
// this user at) to re-fire a "surge" email on its own, without a risk_level
// change. Set higher than the dashboard trend arrow's 5% (lib/outbreak-trend.ts)
// because email is a higher-friction, inbox-interrupting channel and the
// baseline here can be as recent as yesterday's alert — a 5% day-to-day
// wobble would just recreate the alert-fatigue problem the min_risk
// threshold was built to fix.
const CASE_SURGE_THRESHOLD = 0.20;

type AlertReason = "new" | "escalated" | "surge";

const SLACK_COPY: Record<string, { newOutbreak: string; update: string; risk: string; date: string; cases: string; viewBtn: string }> = {
  fr: { newOutbreak: "Foyer actif",       update: "Foyer aggravé",   risk: "Risque",  date: "Date",   cases: "Cas",   viewBtn: "Voir le foyer →" },
  en: { newOutbreak: "Outbreak alert",    update: "Outbreak update", risk: "Risk",    date: "Date",   cases: "Cases", viewBtn: "View outbreak →" },
  es: { newOutbreak: "Alerta de brote",   update: "Brote agravado",  risk: "Riesgo",  date: "Fecha",  cases: "Casos", viewBtn: "Ver brote →" },
  ar: { newOutbreak: "تنبيه تفشٍّ",        update: "تحديث التفشي",    risk: "الخطر",   date: "التاريخ", cases: "الحالات", viewBtn: "← عرض التفشي" },
  id: { newOutbreak: "Peringatan wabah",  update: "Pembaruan wabah", risk: "Risiko",  date: "Tanggal", cases: "Kasus", viewBtn: "Lihat wabah →" },
};

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

  try {
    return await runRegionalAlerts(req, supabase);
  } catch (err) {
    console.error("[regional-alerts] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "regional-alerts" } });
    await logCronRun(supabase, "regional-alerts", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runRegionalAlerts(_req: NextRequest, supabase: SupabaseClient) {
  // ── 1. Find outbreaks created OR updated in the last 25 hours ─────────────
  // updated_at catches existing active outbreaks the daily sync just bumped
  // (new cases/deaths, an escalated risk_level) — created_at alone only ever
  // covers the day an outbreak first appears.
  const since = new Date(Date.now() - 25 * 3600_000).toISOString();

  const { data: candidateOutbreaks, error: oErr } = await supabase
    .from("outbreaks")
    .select("id, region, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, date, cases, deaths, created_at")
    .eq("active", true)
    .or(`created_at.gte.${since},updated_at.gte.${since}`);

  if (oErr) {
    console.error("[regional-alerts] outbreaks query error:", oErr);
    await logCronRun(supabase, "regional-alerts", "error", 0, oErr.message);
    return NextResponse.json({ error: oErr.message }, { status: 500 });
  }

  if (!candidateOutbreaks || candidateOutbreaks.length === 0) {
    await logCronRun(supabase, "regional-alerts", "ok", 0);
    return NextResponse.json({ message: "No candidate outbreaks", sent: 0, skipped: 0 });
  }

  // ── 2. Group outbreak IDs by region ──────────────────────────────────────
  const byRegion = new Map<string, typeof candidateOutbreaks>();
  for (const o of candidateOutbreaks) {
    const arr = byRegion.get(o.region) ?? [];
    arr.push(o);
    byRegion.set(o.region, arr);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let blockedSkipped = 0;
  let trialNudgesSent = 0;
  let digestEmailsSent = 0;
  let digestItemsCapped = 0;
  const sentByReason: Record<AlertReason, number> = { new: 0, escalated: 0, surge: 0 };
  const now = Date.now();

  type OutbreakRow = (typeof candidateOutbreaks)[number];
  type ProfileRow = {
    id: string;
    email: string;
    plan: string;
    trial_ends_at: string | null;
    stripe_subscription_id: string | null;
    alert_locale: string | null;
    slack_webhook_url: string | null;
    is_pilot: boolean | null;
    pilot_organization: string | null;
    trial_value_email_sent_at: string | null;
    email_blocked_at: string | null;
  };
  type MatchedItem = { outbreak: OutbreakRow; region: string; reason: AlertReason };

  // ── 3. For each region, find every qualifying (user, outbreak) match ──────
  // Collected here instead of sent immediately, so a user subscribed across
  // multiple regions — or matching many outbreaks in one region — gets ONE
  // email for the whole run rather than one per outbreak (see file header).
  const userProfiles = new Map<string, ProfileRow>();
  const userItems = new Map<string, MatchedItem[]>();

  for (const [region, outbreaks] of byRegion) {
    // Find paid users subscribed to this region, with their severity threshold
    const { data: subscribers } = await supabase
      .from("user_alert_regions")
      .select("user_id, min_risk")
      .eq("region", region);

    if (!subscribers || subscribers.length === 0) continue;

    const userIds = subscribers.map((s: { user_id: string }) => s.user_id);
    const minRiskByUser = new Map<string, string>(
      subscribers.map((s: { user_id: string; min_risk: string | null }) => [s.user_id, s.min_risk ?? "low"])
    );

    // Get their email, locale, and Slack webhook (from profiles)
    const { data: rawProfiles } = await supabase
      .from("profiles")
      .select("id, email, plan, trial_ends_at, stripe_subscription_id, alert_locale, slack_webhook_url, is_pilot, pilot_organization, trial_value_email_sent_at, email_blocked_at")
      .in("id", userIds)
      .in("plan", ["starter", "pro", "team", "enterprise"]);

    // Apply trial expiry guard: skip users whose trial has ended and have no active Stripe sub
    const nonFreeProfiles = (rawProfiles ?? []).filter((p) => resolvedPlan(p) !== "free");

    // Brevo-blocked addresses (hard bounce, or their own List-Unsubscribe) —
    // sending to them fails silently on Brevo's end, so skip entirely rather
    // than upsert outbreak_alert_log as if the alert had gone out. Populated
    // by the sync-brevo-blocklist cron. See lib/brevo-blocklist.ts.
    const profiles = nonFreeProfiles.filter((p) => !p.email_blocked_at);
    blockedSkipped += nonFreeProfiles.length - profiles.length;

    if (profiles.length === 0) continue;

    for (const profile of profiles as ProfileRow[]) {
      const minRisk = minRiskByUser.get(profile.id) ?? "low";
      for (const outbreak of outbreaks) {
        // Skip outbreaks below this user's configured severity threshold —
        // without this, "high only" subscribers still got every low-risk
        // outbreak in the region, which was the main driver of alert fatigue.
        if (!riskMeetsThreshold(outbreak.risk_level ?? "", minRisk)) continue;

        // Check alert log: has this user already been alerted for this
        // outbreak, and if so, at what risk_level/case count? Only re-fire
        // on a genuine escalation or case surge since that alert — not on
        // every cron tick the outbreak happens to still be "recently updated".
        const { data: priorLog } = await supabase
          .from("outbreak_alert_log")
          .select("risk_level, cases_at_alert")
          .eq("user_id", profile.id)
          .eq("outbreak_id", String(outbreak.id))
          .maybeSingle();

        let reason: AlertReason | null = null;
        if (!priorLog) {
          reason = "new";
        } else {
          const priorRank   = RISK_RANK[priorLog.risk_level ?? ""] ?? 0;
          const currentRank = RISK_RANK[outbreak.risk_level ?? ""] ?? 0;
          const priorCases  = priorLog.cases_at_alert;
          const currentCases = outbreak.cases;
          if (currentRank > priorRank) {
            reason = "escalated";
          } else if (
            typeof priorCases === "number" && priorCases > 0 &&
            typeof currentCases === "number" &&
            (currentCases - priorCases) / priorCases >= CASE_SURGE_THRESHOLD
          ) {
            reason = "surge";
          }
        }

        if (!reason) {
          skipped++;
          continue;
        }

        userProfiles.set(profile.id, profile);
        const items = userItems.get(profile.id) ?? [];
        items.push({ outbreak, region, reason });
        userItems.set(profile.id, items);
      }
    }
  }

  // ── 4. One email per user: single-outbreak template if only one item,
  //       digest template otherwise ─────────────────────────────────────────
  for (const [userId, items] of userItems) {
    const profile = userProfiles.get(userId)!;
    const locale  = (profile.alert_locale as string | null) ?? "en";
    const rl      = REGION_LABELS[locale] ?? REGION_LABELS.en;

    const dashboardUrl = `${APP_URL}/${locale}`;
    const unsubUrl      = `${APP_URL}/${locale}/account#regional-alerts`;

    const enriched: (DigestItem & { outbreak: OutbreakRow; region: string })[] = items.map(
      ({ outbreak, region, reason }) => ({
        outbreak,
        region,
        regionLabel: rl[region] ?? region,
        disease:     getLocalizedDisease(outbreak, locale),
        country:     getLocalizedCountry(outbreak, locale),
        risk_level:  outbreak.risk_level,
        date:        outbreak.date,
        cases:       outbreak.cases,
        deaths:      outbreak.deaths,
        outbreakUrl: `${APP_URL}/${locale}/outbreak/${outbreak.id}`,
        reason,
      })
    );

    try {
      // ── Email ─────────────────────────────────────────────────────────
      // Build + send BEFORE writing any log rows. If either throws (e.g. a
      // template bug on unexpected null data), we must not upsert
      // outbreak_alert_log — those rows are what suppress future re-alerts
      // for this user+outbreak, so logging a send that never went out would
      // silently and permanently swallow the alert. Letting the exception
      // propagate to the catch below leaves no log rows, so the next run
      // retries every item in this batch as "new" instead of losing them.
      let subject: string, html: string;
      if (enriched.length === 1) {
        const only = enriched[0];
        ({ subject, html } = buildOutbreakAlertEmail(
          locale,
          only.regionLabel,
          { disease: only.disease, country: only.country, risk_level: only.risk_level, date: only.date, cases: only.cases, deaths: only.deaths },
          dashboardUrl,
          only.outbreakUrl,
          unsubUrl,
          only.reason === "new" ? "new" : "update"
        ));
      } else {
        // Most urgent first (risk, then reason, then case count) so the
        // items that get cut by MAX_DIGEST_ITEMS_PER_EMAIL are the least
        // urgent ones — every item still gets logged/Slacked below
        // regardless of whether it made the cut for the email body.
        const sorted = [...enriched].sort((a, b) => {
          const riskDiff = (RISK_RANK[b.risk_level] ?? 0) - (RISK_RANK[a.risk_level] ?? 0);
          if (riskDiff !== 0) return riskDiff;
          const reasonDiff = (REASON_RANK[b.reason] ?? 0) - (REASON_RANK[a.reason] ?? 0);
          if (reasonDiff !== 0) return reasonDiff;
          return (b.cases ?? 0) - (a.cases ?? 0);
        });
        const shown = sorted.slice(0, MAX_DIGEST_ITEMS_PER_EMAIL);
        const overflowCount = sorted.length - shown.length;
        if (overflowCount > 0) {
          console.log(`[regional-alerts] digest for ${profile.email} capped: ${shown.length} shown, ${overflowCount} summarized`);
          digestItemsCapped += overflowCount;
        }
        ({ subject, html } = buildOutbreakDigestEmail(locale, shown, dashboardUrl, unsubUrl, overflowCount));
        digestEmailsSent++;
      }
      if (isRealProduction) {
        await sendEmail(profile.email, subject, html);
      }

      // Upsert (not insert) one row per outbreak in this batch: the same
      // (user_id, outbreak_id) row gets its risk_level/cases_at_alert
      // overwritten each time we re-alert, since the primary key only
      // allows one row per user+outbreak.
      for (const item of enriched) {
        const { error: logErr } = await supabase.from("outbreak_alert_log").upsert(
          {
            user_id:        profile.id,
            outbreak_id:    String(item.outbreak.id),
            risk_level:     item.outbreak.risk_level,
            cases_at_alert: item.outbreak.cases ?? null,
            sent_at:        new Date().toISOString(),
          },
          { onConflict: "user_id,outbreak_id" }
        );
        if (logErr) {
          console.error(`[regional-alerts] log upsert failed for ${profile.id}/${item.outbreak.id}:`, logErr.message);
          failed++;
          continue;
        }

        // ── Slack / Teams (fire-and-forget, non-blocking) ─────────────────
        const slackUrl: string | null = profile.slack_webhook_url ?? null;
        if (slackUrl && isRealProduction) {
          const sc = SLACK_COPY[locale] ?? SLACK_COPY.en;
          const riskEmoji = item.risk_level === "high" ? "🔴" : item.risk_level === "medium" ? "🟡" : "🟢";
          const slackBody = {
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `${riskEmoji} *${item.reason === "new" ? sc.newOutbreak : sc.update} — ${item.regionLabel}*\n*${item.disease}* · ${item.country}`,
                },
              },
              {
                type: "context",
                elements: [
                  { type: "mrkdwn", text: `${sc.risk}: *${item.risk_level}* · ${sc.date}: ${item.date}${item.cases ? ` · ${sc.cases}: ${item.cases.toLocaleString("en")}` : ""}` },
                ],
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: sc.viewBtn },
                    url: item.outbreakUrl,
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
        sentByReason[item.reason]++;
      }

      // ── Usage-triggered trial value nudge ────────────────────────────────
      // Fires once, on this user's first-ever "new" alert in this batch,
      // instead of only ever prompting on the fixed J-3/J-1 calendar
      // reminder (trial-reminders cron) unrelated to whether they've seen
      // the product actually work. Self-serve trials only (no Stripe sub
      // yet, still within trial_ends_at) — pilots get the org-specific
      // Team-plan framing via buildTrialValueNudgeEmail's isPilot branch.
      const isActiveTrial =
        !profile.stripe_subscription_id &&
        !!profile.trial_ends_at &&
        new Date(profile.trial_ends_at).getTime() > now;
      const firstNew = enriched.find((item) => item.reason === "new");
      if (firstNew && isActiveTrial && !profile.trial_value_email_sent_at) {
        try {
          const { subject: nudgeSubject, html: nudgeHtml } = buildTrialValueNudgeEmail(
            locale,
            { disease: firstNew.disease, country: firstNew.country, riskLevel: (firstNew.risk_level ?? "medium") as "high" | "medium" | "low" },
            { isPilot: !!profile.is_pilot, organization: (profile.pilot_organization as string | null) ?? null }
          );
          if (isRealProduction) {
            await sendEmail(profile.email, nudgeSubject, nudgeHtml);
          }
          const nowIso = new Date().toISOString();
          await supabase.from("profiles").update({ trial_value_email_sent_at: nowIso }).eq("id", profile.id);
          trialNudgesSent++;
        } catch (nudgeErr) {
          console.error(`[regional-alerts] trial value nudge failed for ${profile.email}:`, nudgeErr);
          Sentry.captureException(nudgeErr, { tags: { cron: "regional-alerts", user_id: profile.id, part: "trial-value-nudge" } });
        }
      }
    } catch (err) {
      console.error(`[regional-alerts] failed to send to ${profile.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "regional-alerts", user_id: profile.id } });
      failed += enriched.length;
    }

    // Respect Brevo rate limit
    await new Promise((r) => setTimeout(r, 150));
  }

  // Was hardcoded "ok" — `failed` (log-upsert failures, send failures) was
  // tracked throughout the loop above but never consulted here, so a genuine
  // delivery failure still logged "ok". Same bug fixed across ~20 other crons
  // today (sync-outbreaks et al., 2026-07-29/30).
  await logCronRun(supabase, "regional-alerts", failed > 0 ? "error" : "ok", sent,
    failed > 0 ? `${failed} alerte(s) en échec` : undefined);
  return NextResponse.json({
    candidateOutbreaks: candidateOutbreaks.length,
    emailsSent: userItems.size,
    digestEmailsSent,
    digestItemsCapped,
    sent,
    sentByReason,
    trialNudgesSent,
    skipped,
    blockedSkipped,
    failed,
  });
}

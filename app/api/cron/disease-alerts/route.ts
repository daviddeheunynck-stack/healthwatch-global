// Disease-specific alert cron — runs daily at 10:40 UTC, after the 08:00-10:00
// UTC sync crons that populate outbreaks (moved from 06:50 on 2026-08-03,
// then from 10:50 to 10:40 on 2026-08-24; see regional-alerts' header for why
// the pre-move schedule ran alerts ahead of same-day sync data).
// For each user's disease subscriptions, sends an alert when a matching
// outbreak appears that hasn't been notified yet.
//
// Runs SECOND of the three outbreak-alert crons (watchlist -> disease ->
// regional, most specific to broadest). Before claiming a (user, outbreak)
// pair via claimOutbreakAlertDaily, checks whether watchlist-alerts (10:30)
// already claimed it today — if so, this user was already told about this
// outbreak minutes ago, so this cron updates its own state log (to avoid
// re-detecting the same unchanged state as "new" tomorrow) but skips the
// send. See outbreak_alert_daily_lock in lib/cron-monitor.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildDiseaseAlertEmail, buildDiseaseAlertDigestEmail, type DiseaseDigestItem } from "@/lib/disease-alert-email";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { diseaseToSlug } from "@/lib/disease-data";
import { errorMessage } from "@/lib/error";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction, currentAlertDate, claimOutbreakAlertDaily, releaseOutbreakAlertDaily, failedRecipientsNote } from "@/lib/cron-monitor";
import { sendBrevoEmail } from "@/lib/brevo-send";
import { notifyMobile } from "@/lib/mobile-notify";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const BOM    = String.fromCharCode(65279);
const clean  = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const CRON_SECRET  = clean(process.env.CRON_SECRET);
const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);
const APP_URL       = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

// Same reasoning as app/api/cron/regional-alerts/route.ts: a plain "have we
// ever alerted this user for this outbreak" dedup means a subscriber never
// hears about that outbreak again even if it escalates or surges later.
// Re-fire on a real risk_level increase or a >=20% case jump since the last
// alert we sent this user, instead of going silent forever after one email.
const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const CASE_SURGE_THRESHOLD = 0.20;

// Same fix and same cap as regional-alerts (2026-08-02, see
// project_alert_onboarding_batch_flood_2026_08_02 in memory): a user
// subscribed to several diseases could otherwise get one email per matching
// outbreak in a single run. Batches into one email per user, digest template
// beyond one item, capped at MAX_DIGEST_ITEMS_PER_EMAIL with the rest
// summarized as "+N more".
const MAX_DIGEST_ITEMS_PER_EMAIL = 10;

function buildDiseaseInAppBody(cases: number | null, riskLevel: string | null, locale: string): string {
  const RISK: Record<string, Record<string, string>> = {
    en: { high: "HIGH risk",     medium: "MEDIUM risk",  low: "LOW risk" },
    fr: { high: "Risque ÉLEVÉ",  medium: "Risque MODÉRÉ", low: "Risque FAIBLE" },
    es: { high: "Riesgo ALTO",   medium: "Riesgo MEDIO",  low: "Riesgo BAJO" },
    ar: { high: "خطر مرتفع",    medium: "خطر متوسط",    low: "خطر منخفض" },
    id: { high: "risiko TINGGI", medium: "risiko SEDANG", low: "risiko RENDAH" },
  };
  const CASE_SUFFIX: Record<string, string> = { en: "cases", fr: "cas", es: "casos", ar: "حالة", id: "kasus" };
  const riskLabel  = RISK[locale]?.[riskLevel ?? ""] ?? RISK.en[riskLevel ?? ""] ?? null;
  const casesLabel = cases != null ? `${cases} ${CASE_SUFFIX[locale] ?? "cases"}` : null;
  return [casesLabel, riskLabel].filter(Boolean).join(" · ") || "Active outbreak";
}

async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl?: string) {
  await sendBrevoEmail({ to, subject, html, apiKey: BREVO_API_KEY, unsubscribeUrl });
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

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  try {
    return await runDiseaseAlerts(req, supabase);
  } catch (err) {
    console.error("[disease-alerts] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "disease-alerts" } });
    await logCronRun(supabase, "disease-alerts", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runDiseaseAlerts(_req: NextRequest, supabase: SupabaseClient) {
  // 1. Get all disease subscriptions grouped by user
  const { data: subs } = await supabase
    .from("user_alert_diseases")
    .select("user_id, disease_en");

  if (!subs || subs.length === 0) {
    await logCronRun(supabase, "disease-alerts", "ok", 0);
    return NextResponse.json({ sent: 0, skipped: 0, message: "No disease subscriptions" });
  }

  // Build disease → [user_ids] map
  const diseaseUsers = new Map<string, string[]>();
  for (const s of subs) {
    if (!diseaseUsers.has(s.disease_en)) diseaseUsers.set(s.disease_en, []);
    diseaseUsers.get(s.disease_en)!.push(s.user_id);
  }

  // 2. Fetch active outbreaks for subscribed diseases
  const diseases = Array.from(diseaseUsers.keys());
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, deaths, risk_level, date, source")
    .eq("active", true)
    .in("disease_en", diseases);

  if (!outbreaks || outbreaks.length === 0) {
    await logCronRun(supabase, "disease-alerts", "ok", 0);
    return NextResponse.json({ sent: 0, skipped: 0, message: "No matching outbreaks" });
  }

  // 3. Fetch profiles for locale
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, alert_locale, plan, trial_ends_at, stripe_subscription_id, email_blocked_at")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => {
      const plan = resolvedPlan(p);
      return [p.id, { email: p.email, locale: (p.alert_locale as string | null) ?? "en", plan, blocked: !!p.email_blocked_at }];
    })
  );

  // 4. Fetch prior alert state to detect duplicates vs. real escalations
  const { data: priorAlerts } = await supabase
    .from("disease_alert_log")
    .select("user_id, outbreak_id, risk_level, cases_at_alert")
    .in("user_id", userIds);

  const priorLogMap = new Map(
    (priorAlerts ?? []).map((r) => [`${r.user_id}:${r.outbreak_id}`, r])
  );

  // 5. Collect every qualifying (user, outbreak) match first — batched into
  // one email per user below instead of sent immediately, so a user
  // subscribed to several diseases that all match in the same run gets ONE
  // email instead of one per outbreak.
  let skipped = 0;
  let blockedSkipped = 0;
  let crossCronDeduped = 0;
  // Claims the cross-cron lock could not answer. They still send (fail-open),
  // so they never count as failures — see claimOutbreakAlertDaily in
  // lib/cron-monitor for why that silence needed its own counter.
  let lockUnevaluable = 0;
  let lockError: string | null = null;
  const alertDate = currentAlertDate();

  type OutbreakRow = (typeof outbreaks)[number];
  const userItems = new Map<string, OutbreakRow[]>();

  for (const outbreak of outbreaks) {
    const interestedUsers = diseaseUsers.get(outbreak.disease_en ?? "") ?? [];

    for (const userId of interestedUsers) {
      const logKey    = `${userId}:${outbreak.id}`;
      const priorLog  = priorLogMap.get(logKey);

      if (priorLog) {
        const priorRank    = RISK_RANK[priorLog.risk_level ?? ""] ?? 0;
        const currentRank  = RISK_RANK[outbreak.risk_level ?? ""] ?? 0;
        const priorCases   = priorLog.cases_at_alert;
        const currentCases = outbreak.cases;
        const escalated = currentRank > priorRank;
        const surged =
          typeof priorCases === "number" && priorCases > 0 &&
          typeof currentCases === "number" &&
          (currentCases - priorCases) / priorCases >= CASE_SURGE_THRESHOLD;
        if (!escalated && !surged) { skipped++; continue; }
      }

      const profile = profileMap.get(userId);
      if (!profile?.email) { skipped++; continue; }

      // Only Pro+ users get disease alerts
      if (!["starter", "pro", "team", "enterprise"].includes(profile.plan)) { skipped++; continue; }

      // Brevo-blocked address: the send would fail silently on Brevo's end,
      // so skip before the log upsert below rather than record a false
      // "sent" state. See lib/brevo-blocklist.ts.
      if (profile.blocked) { blockedSkipped++; continue; }

      // watchlist-alerts runs before this cron (10:30 vs 10:40) and may
      // already have claimed this (user, outbreak) pair today. If so, update
      // this cron's own state log to the current numbers — so tomorrow's
      // comparison starts fresh instead of re-detecting the same unchanged
      // state as "new"/"escalated" — but do not add it to this user's email
      // batch. Note for health-check readers: this sets disease_alert_log
      // .sent_at even on a dedup skip, same trade-off documented in
      // regional-alerts' equivalent branch — "user informed", not strictly
      // "disease-alerts itself emailed them".
      const claim = await claimOutbreakAlertDaily(supabase, userId, String(outbreak.id), alertDate, "disease-alerts");
      if (claim.state === "unevaluable") {
        lockUnevaluable++;
        lockError ??= claim.error ?? "(sans message)";
      }
      if (claim.state === "taken") {
        crossCronDeduped++;
        await supabase.from("disease_alert_log").upsert(
          [{
            user_id:        userId,
            outbreak_id:    outbreak.id,
            risk_level:     outbreak.risk_level,
            cases_at_alert: outbreak.cases ?? null,
            sent_at:        new Date().toISOString(),
          }],
          { onConflict: "user_id,outbreak_id" }
        );
        continue;
      }

      const items = userItems.get(userId) ?? [];
      items.push(outbreak);
      userItems.set(userId, items);
    }
  }

  // 6. One email per user: single-outbreak template if only one item, digest
  // template otherwise (capped at MAX_DIGEST_ITEMS_PER_EMAIL, sorted most
  // urgent first — see lib/disease-alert-email.ts).
  let sent = 0;
  let failed = 0;
  // Qui, pas seulement combien — voir failedRecipientsNote dans lib/cron-monitor.ts.
  // L'envoi lui-même a réussi ici : ce qui a échoué est le marqueur de dédup, donc
  // l'identité utile est la paire destinataire/foyer qui sera re-alertée demain.
  const failedTo: string[] = [];
  let digestEmailsSent = 0;
  let digestItemsCapped = 0;

  for (const [userId, items] of userItems) {
    const profile = profileMap.get(userId)!;
    const locale  = profile.locale;

    const alertOutbreaks = items.map((outbreak) => ({
      id:         outbreak.id,
      disease_en: outbreak.disease_en ?? outbreak.disease,
      disease:    getLocalizedDisease(outbreak, locale) ?? outbreak.disease,
      country_en: outbreak.country_en ?? outbreak.country,
      country:    getLocalizedCountry(outbreak, locale) ?? outbreak.country,
      cases:      outbreak.cases,
      deaths:     outbreak.deaths,
      risk_level: outbreak.risk_level,
      date:       outbreak.date,
      source:     outbreak.source,
    }));

    try {
      // Build + send BEFORE writing any log rows. If either throws, we must
      // not upsert disease_alert_log — those rows are what suppress future
      // re-alerts for this user+outbreak, so logging a send that never went
      // out would silently and permanently swallow the alert. Letting the
      // exception propagate to the catch below leaves no log rows, so the
      // next run retries every item in this batch as "new" instead of
      // losing them.
      let subject: string, html: string, unsubUrl: string | undefined;
      if (alertOutbreaks.length === 1) {
        const only = alertOutbreaks[0];
        const diseaseSlug = diseaseToSlug(only.disease_en);
        ({ subject, html, unsubUrl } = buildDiseaseAlertEmail(only, locale, userId, diseaseSlug));
      } else {
        // Most urgent first (risk, then case count) so the items cut by the
        // cap are the least urgent ones.
        const sorted = [...alertOutbreaks].sort((a, b) => {
          const riskDiff = (RISK_RANK[b.risk_level ?? ""] ?? 0) - (RISK_RANK[a.risk_level ?? ""] ?? 0);
          if (riskDiff !== 0) return riskDiff;
          return (b.cases ?? 0) - (a.cases ?? 0);
        });
        const shown: DiseaseDigestItem[] = sorted.slice(0, MAX_DIGEST_ITEMS_PER_EMAIL).map((o) => ({
          disease:    o.disease,
          country:    o.country,
          risk_level: o.risk_level ?? "medium",
          cases:      o.cases,
          deaths:     o.deaths,
          date:       o.date,
          diseaseUrl: `${APP_URL}/${locale}/disease/${diseaseToSlug(o.disease_en)}`,
        }));
        const overflowCount = sorted.length - shown.length;
        if (overflowCount > 0) {
          console.log(`[disease-alerts] digest for ${profile.email} capped: ${shown.length} shown, ${overflowCount} summarized`);
          digestItemsCapped += overflowCount;
        }
        ({ subject, html } = buildDiseaseAlertDigestEmail(locale, shown, `${APP_URL}/${locale}/account#disease-alerts`, overflowCount));
        digestEmailsSent++;
      }
      if (isRealProduction) {
        await sendEmail(profile.email, subject, html, unsubUrl);
      }

      // Upsert (not insert) one row per outbreak in this batch — same
      // reasoning as regional-alerts (2026-07-30, commit 8b70438).
      for (const outbreak of alertOutbreaks) {
        const { error: logErr } = await supabase
          .from("disease_alert_log")
          .upsert(
            [{
              user_id:        userId,
              outbreak_id:    outbreak.id,
              risk_level:     outbreak.risk_level,
              cases_at_alert: outbreak.cases ?? null,
              sent_at:        new Date().toISOString(),
            }],
            { onConflict: "user_id,outbreak_id" }
          );
        if (logErr) {
          console.error(`[disease-alerts] log insert failed for ${userId}/${outbreak.id}:`, errorMessage(logErr));
          failed++;
          failedTo.push(`${profile.email} → foyer ${outbreak.id}`);
          continue;
        }
        sent++;

        const inAppTitle = `${outbreak.disease} — ${outbreak.country}`;
        const inAppBody  = buildDiseaseInAppBody(outbreak.cases, outbreak.risk_level, locale);

        // Mirror in alert_notifications for in-app display (non-fatal)
        await supabase.from("alert_notifications").insert({
          user_id:     userId,
          type:        "disease_alert",
          title:       inAppTitle,
          body:        inAppBody,
          outbreak_id: outbreak.id,
        }).then(() => {}, () => {});

        await notifyMobile(supabase, userId, { title: inAppTitle, body: inAppBody, outbreak_id: outbreak.id });
      }
    } catch (err: unknown) {
      failed += alertOutbreaks.length;
      console.error(`[disease-alerts] Failed for ${profile.email}:`, errorMessage(err));
      Sentry.captureException(err, { tags: { cron: "disease-alerts", user_id: userId } });
      // Nothing was delivered for this batch — release every claim so
      // regional-alerts, running later today, can still pick these up
      // instead of the user hearing nothing at all.
      for (const outbreak of alertOutbreaks) {
        await releaseOutbreakAlertDaily(supabase, userId, String(outbreak.id), alertDate, "disease-alerts");
      }
    }

    await new Promise((r) => setTimeout(r, 150)); // rate-limit friendly
  }

  // Was hardcoded "ok" with no failure counter at all — a genuine send
  // failure was invisible both in the response and in cron status.
  // evaluatedAt: outbreaks.length > 0 proves the escalation-comparison loop
  // above ran against real candidate data this run, distinct from `sent` —
  // health-check's delivery-stall check needs this to tell "checked, nothing
  // qualified" from "broken", since with one subscriber `sent` can correctly
  // stay 0 for weeks.
  const lockNote = lockUnevaluable > 0
    ? `verrou inter-crons inévaluable ${lockUnevaluable}× : ${lockError}`
    : null;
  const runNote = [failed > 0 ? `${failed} alerte(s) en échec${failedRecipientsNote(failedTo)}` : null, lockNote]
    .filter(Boolean).join(" · ");
  await logCronRun(supabase, "disease-alerts", failed > 0 ? "error" : "ok", sent,
    runNote || undefined,
    outbreaks.length > 0 ? new Date().toISOString() : undefined);
  console.log(`[disease-alerts] Done — sent: ${sent}, skipped: ${skipped}, blockedSkipped: ${blockedSkipped}, crossCronDeduped: ${crossCronDeduped}, lockUnevaluable: ${lockUnevaluable}, digestEmailsSent: ${digestEmailsSent}, digestItemsCapped: ${digestItemsCapped}`);
  return NextResponse.json({ sent, skipped, blockedSkipped, crossCronDeduped, lockUnevaluable, lockError, emailsSent: userItems.size, digestEmailsSent, digestItemsCapped, failed });
}

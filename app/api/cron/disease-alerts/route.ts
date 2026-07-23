// Disease-specific alert cron — runs daily at 06:50 UTC (after sync-outbreaks at 06:00).
// For each user's disease subscriptions, sends an alert when a matching
// outbreak appears that hasn't been notified yet.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildDiseaseAlertEmail } from "@/lib/disease-alert-email";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { diseaseToSlug } from "@/lib/disease-data";
import { errorMessage } from "@/lib/error";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { notifyMobile } from "@/lib/mobile-notify";

export const dynamic = "force-dynamic";

const BOM    = String.fromCharCode(65279);
const clean  = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const CRON_SECRET  = clean(process.env.CRON_SECRET);
const BREVO_API_KEY = clean(process.env.BREVO_API_KEY);

// Same reasoning as app/api/cron/regional-alerts/route.ts: a plain "have we
// ever alerted this user for this outbreak" dedup means a subscriber never
// hears about that outbreak again even if it escalates or surges later.
// Re-fire on a real risk_level increase or a >=20% case jump since the last
// alert we sent this user, instead of going silent forever after one email.
const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const CASE_SURGE_THRESHOLD = 0.20;

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

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not set");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "api-key":     BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender:  { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:      [{ email: to }],
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
    .select("id, email, alert_locale, plan, trial_ends_at, stripe_subscription_id")
    .in("id", userIds);

  const now = Date.now();
  const profileMap = new Map(
    (profiles ?? []).map((p) => {
      let plan = p.plan ?? "free";
      // Apply trial expiry guard
      if (plan !== "free" && p.trial_ends_at && new Date(p.trial_ends_at).getTime() < now && !p.stripe_subscription_id) {
        plan = "free";
      }
      return [p.id, { email: p.email, locale: (p.alert_locale as string | null) ?? "en", plan }];
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

  // 5. Send alerts
  let sent = 0;
  let skipped = 0;

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
        };

        // Log BEFORE sending — prevents duplicate alert if email succeeds but a later batch upsert fails
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
          skipped++;
          continue;
        }

        const diseaseSlug = diseaseToSlug(alertOutbreak.disease_en);
        const { subject, html } = buildDiseaseAlertEmail(alertOutbreak, locale, userId, diseaseSlug);
        if (isRealProduction) {
          await sendEmail(profile.email, subject, html);
        }
        sent++;

        const inAppTitle = `${alertOutbreak.disease} — ${alertOutbreak.country}`;
        const inAppBody  = buildDiseaseInAppBody(alertOutbreak.cases, alertOutbreak.risk_level, locale);

        // Mirror in alert_notifications for in-app display (non-fatal)
        await supabase.from("alert_notifications").insert({
          user_id:     userId,
          type:        "disease_alert",
          title:       inAppTitle,
          body:        inAppBody,
          outbreak_id: outbreak.id,
        }).then(() => {}, () => {});

        await notifyMobile(supabase, userId, { title: inAppTitle, body: inAppBody, outbreak_id: outbreak.id });

        await new Promise((r) => setTimeout(r, 150)); // rate-limit friendly
      } catch (err: unknown) {
        console.error(`[disease-alerts] Failed for ${profile.email}:`, errorMessage(err));
        Sentry.captureException(err, { tags: { cron: "disease-alerts", user_id: userId, outbreak_id: outbreak.id } });
      }
    }
  }

  await logCronRun(supabase, "disease-alerts", "ok", sent);
  console.log(`[disease-alerts] Done — sent: ${sent}, skipped: ${skipped}`);
  return NextResponse.json({ sent, skipped });
}

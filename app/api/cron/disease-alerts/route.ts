// Disease-specific alert cron — runs 3x/day (6h, 12h, 18h UTC)
// For each user's disease subscriptions, sends an alert when a matching
// outbreak appears that hasn't been notified yet.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDiseaseAlertEmail } from "@/lib/disease-alert-email";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM    = String.fromCharCode(65279);
const clean  = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const CRON_SECRET = clean(process.env.CRON_SECRET);

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key":     clean(process.env.BREVO_API_KEY),
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
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  // 1. Get all disease subscriptions grouped by user
  const { data: subs } = await supabase
    .from("user_alert_diseases")
    .select("user_id, disease_en");

  if (!subs || subs.length === 0) {
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
    return NextResponse.json({ sent: 0, skipped: 0, message: "No matching outbreaks" });
  }

  // 3. Fetch profiles for locale
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, locale, plan, trial_ends_at, stripe_subscription_id")
    .in("id", userIds);

  const now = Date.now();
  const profileMap = new Map(
    (profiles ?? []).map((p) => {
      let plan = p.plan ?? "free";
      // Apply trial expiry guard
      if (plan !== "free" && p.trial_ends_at && new Date(p.trial_ends_at).getTime() < now && !p.stripe_subscription_id) {
        plan = "free";
      }
      return [p.id, { email: p.email, locale: p.locale ?? "fr", plan }];
    })
  );

  // 4. Fetch already-sent log to avoid duplicates
  const { data: alreadySent } = await supabase
    .from("disease_alert_log")
    .select("user_id, outbreak_id")
    .in("user_id", userIds);

  const sentSet = new Set(
    (alreadySent ?? []).map((r) => `${r.user_id}:${r.outbreak_id}`)
  );

  // 5. Send alerts
  let sent = 0;
  let skipped = 0;
  const toLog: { user_id: string; outbreak_id: string }[] = [];

  for (const outbreak of outbreaks) {
    const interestedUsers = diseaseUsers.get(outbreak.disease_en ?? "") ?? [];

    for (const userId of interestedUsers) {
      const logKey = `${userId}:${outbreak.id}`;
      if (sentSet.has(logKey)) { skipped++; continue; }

      const profile = profileMap.get(userId);
      if (!profile?.email) { skipped++; continue; }

      // Only Pro+ users get disease alerts
      if (!["starter", "pro", "enterprise"].includes(profile.plan)) { skipped++; continue; }

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

        const { subject, html } = buildDiseaseAlertEmail(alertOutbreak, locale, userId);
        await sendEmail(profile.email, subject, html);
        toLog.push({ user_id: userId, outbreak_id: outbreak.id });
        sent++;

        await new Promise((r) => setTimeout(r, 150)); // rate-limit friendly
      } catch (err: unknown) {
        console.error(`[disease-alerts] Failed for ${profile.email}:`, errorMessage(err));
      }
    }
  }

  // 6. Log sent alerts (prevent duplicates on next run)
  if (toLog.length > 0) {
    await supabase
      .from("disease_alert_log")
      .upsert(toLog, { onConflict: "user_id,outbreak_id" });
  }

  console.log(`[disease-alerts] Done — sent: ${sent}, skipped: ${skipped}`);
  return NextResponse.json({ sent, skipped });
}

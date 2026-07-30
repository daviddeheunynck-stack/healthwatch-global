import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { notifyMobile } from "@/lib/mobile-notify";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^﻿/, "").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/^﻿/, "").trim();
const CRON_SECRET  = (process.env.CRON_SECRET ?? "").replace(/^﻿/, "").trim();
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL ?? "https://healthwatch-global.com").replace(/^﻿/, "").trim();
const BREVO_KEY    = (process.env.BREVO_API_KEY ?? "").replace(/^﻿/, "").trim();

async function sendEmail(to: string, subject: string, html: string) {
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
  if (!res.ok) throw new Error(`Brevo error ${res.status}: ${await res.text()}`);
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type LocaleCopy = {
  subject:     (d: string, c: string) => string;
  intro:       (d: string, c: string) => string;
  title:       string;
  // "Ongoing" variants — used instead of the above when the PHEIC was already
  // active before this user could have been notified (pre-existing subscriber
  // base already got the real declaration email; a newly-eligible user gets a
  // calmer status notice instead of a false "WHO has just declared" framing).
  subjectOngoing: (d: string, c: string) => string;
  introOngoing:   (d: string, c: string) => string;
  titleOngoing:   string;
  cases:       string;
  reported:    string;
  risk:        string;
  riskValues:  Record<string, string>;
  view:        string;
  footer:      string;
};

const LOCALE_COPY: Record<string, LocaleCopy> = {
  fr: {
    subject:    (d, c) => `[HealthWatch] Déclaration PHEIC : ${d} — ${c}`,
    intro:      (d, c) => `L'OMS a déclaré une Urgence de Santé Publique de Portée Internationale (PHEIC) pour <strong>${d}</strong> en <strong>${c}</strong>.`,
    title:      "HealthWatch Global — Déclaration PHEIC",
    subjectOngoing: (d, c) => `[HealthWatch] PHEIC en cours : ${d} — ${c}`,
    introOngoing:   (d, c) => `L'OMS maintient une Urgence de Santé Publique de Portée Internationale (PHEIC) en cours pour <strong>${d}</strong> en <strong>${c}</strong>.`,
    titleOngoing:   "HealthWatch Global — PHEIC en cours",
    cases:      "Cas :",
    reported:   "Signalé le :",
    risk:       "Risque :",
    riskValues: { high: "ÉLEVÉ", medium: "MODÉRÉ", low: "FAIBLE" },
    view:       "Voir le tableau de bord →",
    footer:     "HealthWatch Global · Gérez vos préférences d'alertes dans le tableau de bord.",
  },
  es: {
    subject:    (d, c) => `[HealthWatch] Declaración PHEIC: ${d} — ${c}`,
    intro:      (d, c) => `La OMS ha declarado una Emergencia de Salud Pública de Importancia Internacional (PHEIC) por <strong>${d}</strong> en <strong>${c}</strong>.`,
    title:      "HealthWatch Global — Declaración PHEIC",
    subjectOngoing: (d, c) => `[HealthWatch] PHEIC en curso: ${d} — ${c}`,
    introOngoing:   (d, c) => `La OMS mantiene una Emergencia de Salud Pública de Importancia Internacional (PHEIC) en curso por <strong>${d}</strong> en <strong>${c}</strong>.`,
    titleOngoing:   "HealthWatch Global — PHEIC en curso",
    cases:      "Casos:",
    reported:   "Reportado:",
    risk:       "Riesgo:",
    riskValues: { high: "ALTO", medium: "MEDIO", low: "BAJO" },
    view:       "Ver panel →",
    footer:     "HealthWatch Global · Gestione sus preferencias de alertas en el panel.",
  },
  ar: {
    subject:    (d, c) => `[HealthWatch] إعلان PHEIC: ${d} — ${c}`,
    intro:      (d, c) => `أعلنت منظمة الصحة العالمية حالة طوارئ صحية عامة دولية (PHEIC) بشأن <strong>${d}</strong> في <strong>${c}</strong>.`,
    title:      "HealthWatch Global — إعلان PHEIC",
    subjectOngoing: (d, c) => `[HealthWatch] حالة PHEIC مستمرة: ${d} — ${c}`,
    introOngoing:   (d, c) => `لا تزال منظمة الصحة العالمية تصنّف <strong>${d}</strong> في <strong>${c}</strong> كحالة طوارئ صحية عامة دولية (PHEIC) مستمرة.`,
    titleOngoing:   "HealthWatch Global — حالة PHEIC مستمرة",
    cases:      "الحالات:",
    reported:   "تاريخ الإبلاغ:",
    risk:       "مستوى الخطر:",
    riskValues: { high: "مرتفع", medium: "متوسط", low: "منخفض" },
    view:       "عرض لوحة المعلومات ←",
    footer:     "HealthWatch Global · أدر تفضيلات التنبيهات من لوحة المعلومات.",
  },
  id: {
    subject:    (d, c) => `[HealthWatch] Deklarasi PHEIC: ${d} — ${c}`,
    intro:      (d, c) => `WHO telah menyatakan Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC) untuk <strong>${d}</strong> di <strong>${c}</strong>.`,
    title:      "HealthWatch Global — Deklarasi PHEIC",
    subjectOngoing: (d, c) => `[HealthWatch] PHEIC berlangsung: ${d} — ${c}`,
    introOngoing:   (d, c) => `WHO tetap menetapkan status Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC) yang sedang berlangsung untuk <strong>${d}</strong> di <strong>${c}</strong>.`,
    titleOngoing:   "HealthWatch Global — PHEIC berlangsung",
    cases:      "Kasus:",
    reported:   "Dilaporkan:",
    risk:       "Risiko:",
    riskValues: { high: "TINGGI", medium: "SEDANG", low: "RENDAH" },
    view:       "Lihat dasbor →",
    footer:     "HealthWatch Global · Kelola preferensi peringatan di dasbor Anda.",
  },
  en: {
    subject:    (d, c) => `[HealthWatch] PHEIC Declaration: ${d} — ${c}`,
    intro:      (d, c) => `WHO has declared a Public Health Emergency of International Concern (PHEIC) for <strong>${d}</strong> in <strong>${c}</strong>.`,
    title:      "HealthWatch Global — PHEIC Declaration",
    subjectOngoing: (d, c) => `[HealthWatch] Ongoing PHEIC: ${d} — ${c}`,
    introOngoing:   (d, c) => `WHO maintains an ongoing Public Health Emergency of International Concern (PHEIC) for <strong>${d}</strong> in <strong>${c}</strong>.`,
    titleOngoing:   "HealthWatch Global — Ongoing PHEIC",
    cases:      "Cases:",
    reported:   "Reported:",
    risk:       "Risk:",
    riskValues: { high: "HIGH", medium: "MEDIUM", low: "LOW" },
    view:       "View dashboard →",
    footer:     "HealthWatch Global · Manage alert preferences in your dashboard.",
  },
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  if (!BREVO_KEY) return new Response(JSON.stringify({ ok: true, skipped: "BREVO_API_KEY not configured" }), { status: 200 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    return await runTriggerPheicAlerts(req, supabase);
  } catch (err) {
    console.error("[trigger-pheic-alerts] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "trigger-pheic-alerts" } });
    await logCronRun(supabase, "trigger-pheic-alerts", "error", 0,
      err instanceof Error ? err.message : String(err));
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runTriggerPheicAlerts(_req: NextRequest, supabase: SupabaseClient) {
  // 1. Active PHEIC outbreaks
  const { data: pheicOutbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, deaths, risk_level, date")
    .eq("active", true)
    .eq("is_pheic", true);

  if (!pheicOutbreaks?.length) {
    await logCronRun(supabase, "trigger-pheic-alerts", "ok", 0);
    return Response.json({ fired: 0 });
  }

  // 2. Pro users who want PHEIC alerts. The plan filter alone doesn't catch an
  // expired trial (plan column stays "pro" until expire-trials runs) — filter
  // again with resolvedPlan() so an expired-trial-no-payment user stops
  // getting PHEIC alerts instead of receiving them indefinitely for free.
  const { data: rawProUsers } = await supabase
    .from("profiles")
    .select("id, email, alert_locale, plan, trial_ends_at, stripe_subscription_id, email_blocked_at")
    .in("plan", ["pro", "team", "enterprise"])
    .eq("pheic_alerts", true)
    .not("email", "is", null);

  // Brevo-blocked addresses fail silently on Brevo's end — skip them before
  // the alert_notifications insert below rather than record a false "sent"
  // state. See lib/brevo-blocklist.ts.
  const proUsers = (rawProUsers ?? []).filter((p) => resolvedPlan(p) !== "free" && !p.email_blocked_at);

  if (!proUsers?.length) {
    await logCronRun(supabase, "trigger-pheic-alerts", "ok", 0);
    return Response.json({ fired: 0 });
  }

  // 3. Already-notified (type=pheic) per outbreak
  const outbreakIds = pheicOutbreaks.map((o) => o.id);
  const { data: existing } = await supabase
    .from("alert_notifications")
    .select("user_id, outbreak_id")
    .eq("type", "pheic")
    .in("outbreak_id", outbreakIds);

  const notifiedSet = new Set((existing ?? []).map((n) => `${n.user_id}::${n.outbreak_id}`));
  // Outbreak ids that have ALREADY generated a real notification for someone,
  // regardless of user — signals this PHEIC predates the current cron run
  // (e.g. a subscriber who upgrades to Pro next month), so newly-eligible
  // users get the calmer "ongoing" framing instead of a false "just declared".
  const alertedOutbreakIds = new Set((existing ?? []).map((n) => n.outbreak_id));

  // Group by disease — one email per PHEIC event listing all affected countries.
  // Without grouping, each country row (DRC, Uganda, France…) triggers a separate
  // email for the same PHEIC declaration, spamming users.
  const diseaseMap = new Map<string, typeof pheicOutbreaks>();
  for (const o of pheicOutbreaks) {
    const key = (o.disease_en ?? "unknown").toLowerCase();
    if (!diseaseMap.has(key)) diseaseMap.set(key, []);
    diseaseMap.get(key)!.push(o);
  }

  let fired  = 0;
  let failed = 0;

  for (const [, outbreaks] of diseaseMap) {
    // Primary row = largest case count (main source country)
    const primary  = outbreaks.reduce((a, b) => (a.cases ?? 0) >= (b.cases ?? 0) ? a : b);
    const totalCases  = outbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);
    const totalDeaths = outbreaks.reduce((s, o) => s + (o.deaths ?? 0), 0);
    const cfr =
      totalCases > 0 && totalDeaths > 0
        ? `CFR ${(totalDeaths / totalCases * 100).toFixed(1)}%`
        : "";

    // Most recent date and highest risk across all outbreaks in the group
    const latestDate  = outbreaks.reduce((best, o) => (!best || (o.date ?? "") > best ? o.date ?? best : best), primary.date);
    const riskPriority: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 4 };
    const topRisk = outbreaks.reduce(
      (best, o) => (riskPriority[o.risk_level ?? ""] ?? 0) > (riskPriority[best] ?? 0) ? (o.risk_level ?? best) : best,
      primary.risk_level ?? "high",
    );

    // Was ANY row in this disease group already notified to someone before this
    // run started? If so, every recipient in this run is newly-eligible for an
    // already-active PHEIC (upgraded to Pro, just enabled pheic_alerts…) rather
    // than a first-ever declaration — use the "ongoing" copy variant for all of them.
    const isOngoing = outbreaks.some((o) => alertedOutbreakIds.has(o.id));

    for (const user of proUsers as Array<{ id: string; email: string; alert_locale?: string | null }>) {
      // Dedup: skip if user was already notified for ANY outbreak in this disease group.
      // This covers both old per-country records (e.g. user::uganda_id, user::france_id)
      // AND new grouped records (user::primary_id) inserted after this fix.
      const alreadyNotified = outbreaks.some((o) => notifiedSet.has(`${user.id}::${o.id}`));
      if (alreadyNotified) continue;

      const locale    = user.alert_locale ?? "en";
      const numLocale = locale === "ar" ? "ar-SA" : locale;
      const isRtl     = locale === "ar";
      const sep       = locale === "ar" ? "، " : ", ";
      const lc      = LOCALE_COPY[locale] ?? LOCALE_COPY.en;
      const disease  = getLocalizedDisease(primary, locale);
      const countries = outbreaks.map((o) => getLocalizedCountry(o, locale)).join(sep);
      const subject = isOngoing ? lc.subjectOngoing(disease, countries) : lc.subject(disease, countries);
      const intro   = isOngoing ? lc.introOngoing(esc(disease), esc(countries)) : lc.intro(esc(disease), esc(countries));
      const title   = isOngoing ? lc.titleOngoing : lc.title;
      const dashUrl = `${APP_URL}/${locale}/outbreak/${primary.id}`;

      const html = `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
  <p style="color:#f87171;font-size:17px;font-weight:700;margin:0 0 4px">${title}</p>
  <p style="font-size:12px;color:#64748b;margin:0 0 16px">${new Date().toISOString().split("T")[0]}</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="font-size:14px;margin:0 0 12px">${intro}</p>
  <ul style="font-size:13px;color:#cbd5e1;margin:0 0 16px;padding-left:20px">
    <li>${lc.cases} ${totalCases.toLocaleString(numLocale)}</li>
    ${cfr ? `<li>${cfr}</li>` : ""}
    <li>${lc.reported} ${latestDate}</li>
    <li>${lc.risk} <strong style="color:#f87171">${esc(lc.riskValues[topRisk] ?? topRisk.toUpperCase())}</strong></li>
  </ul>
  <a href="${dashUrl}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    ${lc.view}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">${lc.footer}</p>
</div>`;

      try {
        // Send BEFORE inserting the alert_notifications dedup row. This is
        // the highest-stakes case of this pattern found today: PHEIC alerts
        // have no cooldown to fall back on — notifiedSet is a one-shot,
        // forever marker, so if sendEmail throws after the insert, this user
        // never gets told about this PHEIC again, ever. Same fix as
        // regional-alerts/disease-alerts/watchlist-alerts (2026-07-30).
        if (isRealProduction) await sendEmail(user.email, subject, html);

        const inAppBody = `${disease} · ${countries} · PHEIC`;
        const { error: insertErr } = await supabase.from("alert_notifications").insert({
          user_id:     user.id,
          type:        "pheic",
          title:       subject,
          body:        inAppBody,
          outbreak_id: primary.id,
        });
        if (insertErr) {
          console.warn(`[trigger-pheic-alerts] Insert skipped for ${user.id}::${primary.id}: ${insertErr.message}`);
          failed++;
          continue;
        }

        await notifyMobile(supabase, user.id, { title: subject, body: inAppBody, outbreak_id: primary.id });

        // Add all outbreak ids for this disease group so the check above
        // catches them on the next cron run without a DB re-query.
        outbreaks.forEach((o) => notifiedSet.add(`${user.id}::${o.id}`));
        fired++;
      } catch (err) {
        failed++;
        console.error(`[trigger-pheic-alerts] Failed for user ${user.id} / outbreak ${primary.id}:`, err);
        Sentry.captureException(err, { tags: { cron: "trigger-pheic-alerts", user_id: user.id, outbreak_id: primary.id } });
      }
    }
  }

  // Was hardcoded "ok" with no failure counter at all.
  await logCronRun(supabase, "trigger-pheic-alerts", failed > 0 ? "error" : "ok", fired,
    failed > 0 ? `${failed} alerte(s) PHEIC en échec` : undefined);
  return Response.json({ fired, failed });
}

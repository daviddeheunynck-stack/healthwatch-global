import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { notifyMobile } from "@/lib/mobile-notify";
import { resolvedPlan } from "@/lib/resolved-plan";
import { getBlockedEmailSet } from "@/lib/brevo-blocklist";
import { sendBrevoEmail } from "@/lib/brevo-send";
import { buildUnsubscribeAlertUrl } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COOLDOWN_H = 6;
const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const RISK_VALUES: Record<string, Record<string, string>> = {
  fr: { high: "ÉLEVÉ",  medium: "MODÉRÉ", low: "FAIBLE"  },
  es: { high: "ALTO",   medium: "MEDIO",  low: "BAJO"    },
  ar: { high: "مرتفع",  medium: "متوسط",  low: "منخفض"   },
  id: { high: "TINGGI", medium: "SEDANG", low: "RENDAH"  },
  en: { high: "HIGH",   medium: "MEDIUM", low: "LOW"     },
};

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function riskMeetsThreshold(risk: string, minRisk: string): boolean {
  return (RISK_RANK[risk] ?? 0) >= (RISK_RANK[minRisk] ?? 0);
}

// `%`/`_` are LIKE wildcards, not literals. country_en is free text a Pro
// user typed at creation (app/api/country-risk-alerts/route.ts only checks
// non-empty), so a stored "%" would match every country with a single
// alert, bypassing the one-alert-per-country model and MAX_ALERTS cap. Same
// class as the send-welcome fix (2026-08-05, 39cf3fb): escaping here, at
// read time, covers rows already in the table too, not just new ones.
function escapeLikePattern(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").replace(/^﻿/, "").trim();
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`)
    return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  // Defensive wrapper: an uncaught exception anywhere before or between the
  // fetches below (only the send/notify step has a local try/catch) used to
  // propagate straight out — bare 500, no Sentry event, logCronRun never
  // reached. Same root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runCountryRiskAlerts(supabase);
  } catch (err) {
    console.error("[trigger-country-risk-alerts] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "trigger-country-risk-alerts" } });
    await logCronRun(supabase, "trigger-country-risk-alerts", "error", 0,
      err instanceof Error ? err.message : String(err));
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

async function runCountryRiskAlerts(supabase: SupabaseClient) {
  const brevoKey = (process.env.BREVO_API_KEY ?? "").replace(/^﻿/, "").trim();
  if (!brevoKey) {
    await logCronRun(supabase, "trigger-country-risk-alerts", "ok", 0);
    return Response.json({ ok: true, skipped: "BREVO_API_KEY not configured" });
  }

  // confirmed_at IS NOT NULL: unconfirmed rows (email typed in but never
  // proven — see app/api/country-risk-alerts/route.ts and the 2026-08-08
  // migration) must never fire. Pre-migration rows are all NULL by default,
  // so this is a strict subset of what used to fire, not a behavior change
  // for anyone who's already clicked through.
  const { data: alerts } = await supabase
    .from("country_risk_alerts")
    .select("id, user_id, country_en, min_risk, email, last_fired_at")
    .not("confirmed_at", "is", null);

  if (!alerts?.length) {
    await logCronRun(supabase, "trigger-country-risk-alerts", "ok", 0);
    return Response.json({ fired: 0 });
  }

  // Country risk alerts are a paid feature (creation gated by resolvedPlan()
  // in app/api/country-risk-alerts/route.ts), but this cron never re-checked
  // it — a rule created during a trial kept firing forever even after the
  // trial expired without payment.
  const alertUserIds = [...new Set(alerts.map((a) => a.user_id as string))];
  const { data: profileRows } = await supabase
    .from("profiles").select("id, alert_locale, plan, trial_ends_at, stripe_subscription_id").in("id", alertUserIds);
  const localeMap: Record<string, string> = Object.fromEntries(
    (profileRows ?? []).map((p: { id: string; alert_locale?: string | null }) => [p.id, p.alert_locale ?? "en"])
  );
  const freeUserIds = new Set(
    (profileRows ?? []).filter((p) => resolvedPlan(p) === "free").map((p) => p.id)
  );

  // alert.email is a stored address, not always joinable to a profiles row —
  // matched against the full Brevo blocklist cache. See lib/brevo-blocklist.ts.
  const blockedEmails = await getBlockedEmailSet(supabase);

  const cooldownCutoff = new Date(Date.now() - COOLDOWN_H * 3_600_000).toISOString();
  let fired = 0;
  let blockedSkipped = 0;
  let errors = 0;

  for (const alert of alerts) {
    if (alert.last_fired_at && alert.last_fired_at > cooldownCutoff) continue;
    if (blockedEmails.has((alert.email ?? "").toLowerCase())) { blockedSkipped++; continue; }

    const { data: outbreaks } = await supabase
      .from("outbreaks")
      .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, cases, deaths, is_pheic, date")
      .eq("active", true)
      .ilike("country_en", escapeLikePattern(alert.country_en));

    const matches = (outbreaks ?? []).filter((o) =>
      riskMeetsThreshold(o.risk_level ?? "", alert.min_risk ?? "high")
    );
    if (!matches.length) continue;
    if (freeUserIds.has(alert.user_id)) continue;

    const locale    = localeMap[alert.user_id] ?? "en";
    const numLocale = locale === "ar" ? "ar-SA" : locale;
    const isRtl     = locale === "ar";
    const top = matches[0];
    const pheic = top.is_pheic ? " [PHEIC]" : "";
    const cfr =
      top.cases > 0 && top.deaths != null && top.deaths > 0
        ? `CFR ${(top.deaths / top.cases * 100).toFixed(1)}%`
        : "";
    const riskKey = top.risk_level ?? "unknown";
    const level = RISK_VALUES[locale]?.[riskKey] ?? riskKey.toUpperCase();

    const localDisease  = getLocalizedDisease(top, locale);
    const localCountry  = getLocalizedCountry(top, locale);
    const subject = `[HealthWatch] ${localCountry} — ${level}${pheic}: ${localDisease}`;

    const escCountry = esc(localCountry);
    const INTRO: Record<string, string> = {
      fr: `Un foyer à risque <strong>${level}</strong> a été détecté en <strong>${escCountry}</strong>.`,
      es: `Se ha detectado un brote de riesgo <strong>${level}</strong> en <strong>${escCountry}</strong>.`,
      ar: `تم رصد تفشٍّ ذو خطر <strong>${level}</strong> في <strong>${escCountry}</strong>.`,
      id: `Wabah berisiko <strong>${level}</strong> terdeteksi di <strong>${escCountry}</strong>.`,
      en: `A <strong>${level}</strong> risk outbreak has been detected in <strong>${escCountry}</strong>.`,
    };
    const LABELS: Record<string, [string, string, string, string, string]> = {
      fr: ["Maladie", "Cas", "🚨 PHEIC déclaré", "Signalé le", "Voir le foyer →"],
      es: ["Enfermedad", "Casos", "🚨 PHEIC declarado", "Reportado", "Ver el brote →"],
      ar: ["المرض", "الحالات", "🚨 إعلان PHEIC", "تاريخ الإبلاغ", "← عرض التفشي"],
      id: ["Penyakit", "Kasus", "🚨 PHEIC dideklarasikan", "Dilaporkan", "Lihat wabah →"],
      en: ["Disease", "Cases", "🚨 PHEIC declared", "Reported", "View outbreak →"],
    };
    const lb = LABELS[locale] ?? LABELS.en;
    const intro = INTRO[locale] ?? INTRO.en;
    const dashUrl = `https://healthwatch-global.com/${locale}/outbreak/${top.id}`;
    const unsubUrl = buildUnsubscribeAlertUrl("country_risk", alert.id, locale);

    const moreStr = ({ fr: `+${matches.length - 1} autre(s) foyer(s) dans ce pays`, es: `+${matches.length - 1} brote(s) más en este país`, ar: `+${matches.length - 1} تفشٍّ آخر في هذا البلد`, id: `+${matches.length - 1} wabah lain di negara ini`, en: `+${matches.length - 1} other outbreak(s) in this country` } as Record<string, string>)[locale] ?? `+${matches.length - 1} other outbreak(s) in this country`;
    const manageStr = ({ fr: "HealthWatch Global · Gérez vos alertes dans le tableau de bord", es: "HealthWatch Global · Gestione sus alertas en el panel", ar: "HealthWatch Global · أدر تنبيهاتك من لوحة المعلومات", id: "HealthWatch Global · Kelola peringatan di dasbor Anda", en: "HealthWatch Global · Manage alerts in your dashboard" } as Record<string, string>)[locale] ?? "HealthWatch Global · Manage alerts in your dashboard";
    const unsubStr = ({ fr: "Se désabonner de cette alerte", es: "Cancelar esta alerta", ar: "إلغاء الاشتراك في هذا التنبيه", id: "Berhenti dari peringatan ini", en: "Unsubscribe from this alert" } as Record<string, string>)[locale] ?? "Unsubscribe from this alert";

    const html = `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
<p>${intro}</p>
<ul>
  <li>${lb[0]}: ${esc(localDisease)}</li>
  <li>${lb[1]}: ${(top.cases ?? 0).toLocaleString(numLocale)}${cfr ? ` · ${cfr}` : ""}</li>
  ${top.is_pheic ? `<li>${lb[2]}</li>` : ""}
  <li>${lb[3]}: ${top.date}</li>
  ${matches.length > 1 ? `<li>${moreStr}</li>` : ""}
</ul>
<p><a href="${dashUrl}">${lb[4]}</a></p>
<hr/>
<p style="color:#666;font-size:12px">${manageStr} · <a href="${unsubUrl}" style="color:#666">${unsubStr}</a></p>
</div>`;

    try {
      // Send BEFORE writing the dedup marker — same reordering as
      // regional-alerts/disease-alerts/trigger-category-alerts (2026-07-30).
      // If sendBrevoEmail throws, last_fired_at must stay untouched so this
      // alert isn't silently suppressed for the cooldown window.
      if (isRealProduction) await sendBrevoEmail({ to: alert.email, subject, html, apiKey: brevoKey, unsubscribeUrl: unsubUrl });

      await supabase
        .from("country_risk_alerts")
        .update({ last_fired_at: new Date().toISOString() })
        .eq("id", alert.id);

      const inAppBody = `${localDisease} · ${localCountry} · ${level}`;

      await supabase.from("alert_notifications").insert({
        user_id: alert.user_id,
        type: "country_risk",
        title: subject,
        body: inAppBody,
        outbreak_id: top.id,
      }).then(() => {}, () => {});

      await notifyMobile(supabase, alert.user_id, { title: subject, body: inAppBody, outbreak_id: top.id });

      fired++;
    } catch (err) {
      errors++;
      console.error(`[trigger-country-risk-alerts] Failed for alert ${alert.id}:`, err);
      Sentry.captureException(err, { tags: { cron: "trigger-country-risk-alerts", alert_id: alert.id, user_id: alert.user_id } });
    }
  }

  await logCronRun(supabase, "trigger-country-risk-alerts", errors > 0 ? "error" : "ok", fired,
    errors > 0 ? `${errors} alerte(s) en échec` : undefined);
  return Response.json({ fired, blockedSkipped, errors });
}

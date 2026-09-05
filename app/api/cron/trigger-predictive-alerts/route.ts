/**
 * GET /api/cron/trigger-predictive-alerts
 *
 * For each active predictive alert, projects the outbreak's doubling time
 * from its 7-day growth trend (lib/outbreak-trend.ts, backed by
 * outbreak_snapshots) and fires if that projection is under the user's
 * configured window. Unlike outbreak_tripwires (a manual case-count
 * threshold, checked every 30 min), this is forward-looking and only ever
 * changes once a day — one snapshot/day per outbreak — so it only needs to
 * run once a day itself.
 *
 * Re-arms 7 days after a firing, or immediately if the trend resets to
 * "unknown"/non-"up" and later turns "up" again — mirrors the
 * "re-fires if it drops below threshold and rises again" rule on tripwires,
 * adapted for a signal that doesn't have a clean below/above edge.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { getOutbreakTrendsBulk } from "@/lib/outbreak-trend";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { notifyMobile } from "@/lib/mobile-notify";
import { resolvedPlan } from "@/lib/resolved-plan";
import { getBlockedEmailSet } from "@/lib/brevo-blocklist";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

const REARM_DAYS = 7;

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

// Doubling-time projection from a 7-day trend. Only meaningful for a
// genuine upward trend — directionFor() in lib/outbreak-trend.ts already
// keeps "up" away from noise (>5% over the period) and never assigns it to
// a correction (see that file's directionFor() comment), so dailyRate here
// is always a real, bounded-away-from-zero growth rate when defined.
function projectedDoublingDays(deltaPercent: number, daysBack: number): number | null {
  if (daysBack <= 0) return null;
  const dailyRate = Math.pow(1 + deltaPercent / 100, 1 / daysBack) - 1;
  if (dailyRate <= 0) return null;
  return Math.log(2) / Math.log(1 + dailyRate);
}

const COPY: Record<string, {
  emailTitle:  string;
  projected:   (days: string) => string;
  currentCases: string;
  riskLevel:   string;
  riskValues:  Record<string, string>;
  viewBtn:     string;
  manageLink:  (url: string) => string;
  footer:      (threshold: string) => string;
  inAppTitle:  (disease: string, country: string) => string;
  inAppBody:   (days: string, threshold: string) => string;
}> = {
  en: {
    emailTitle:   "📈 Predictive Trend Alert",
    projected:    (d) => `Projected to double in ~${d} days`,
    currentCases: "Current cases:",
    riskLevel:    "Risk level:",
    riskValues:   { high: "HIGH", medium: "MEDIUM", low: "LOW" },
    viewBtn:      "View outbreak →",
    manageLink:   (url) => `To manage your predictive alerts: ${url}`,
    footer:       (t) => `This alert was triggered because the outbreak's 7-day growth trend now projects it to double within your configured window of ${t} days. It will re-arm after 7 days, or sooner if the trend resets and turns upward again.`,
    inAppTitle:   (d, c) => `📈 ${d} (${c}) — accelerating`,
    inAppBody:    (days, t) => `Projected to double in ~${days} days (your threshold: ${t})`,
  },
  fr: {
    emailTitle:   "📈 Alerte de tendance prédictive",
    projected:    (d) => `Doublement projeté sous ~${d} jours`,
    currentCases: "Cas actuels :",
    riskLevel:    "Niveau de risque :",
    riskValues:   { high: "ÉLEVÉ", medium: "MODÉRÉ", low: "FAIBLE" },
    viewBtn:      "Voir le foyer →",
    manageLink:   (url) => `Pour gérer vos alertes prédictives : ${url}`,
    footer:       (t) => `Cette alerte a été déclenchée car la tendance de croissance sur 7 jours du foyer projette désormais un doublement des cas sous ${t} jours. Elle se réarme après 7 jours, ou plus tôt si la tendance repart puis remonte.`,
    inAppTitle:   (d, c) => `📈 ${d} (${c}) — en accélération`,
    inAppBody:    (days, t) => `Doublement projeté sous ~${days} jours (votre seuil : ${t})`,
  },
  es: {
    emailTitle:   "📈 Alerta de tendencia predictiva",
    projected:    (d) => `Proyección de duplicarse en ~${d} días`,
    currentCases: "Casos actuales:",
    riskLevel:    "Nivel de riesgo:",
    riskValues:   { high: "ALTO", medium: "MEDIO", low: "BAJO" },
    viewBtn:      "Ver brote →",
    manageLink:   (url) => `Para gestionar sus alertas predictivas: ${url}`,
    footer:       (t) => `Esta alerta se activó porque la tendencia de crecimiento a 7 días del brote ahora proyecta que se duplicará en menos de ${t} días. Se reactivará tras 7 días, o antes si la tendencia se reinicia y vuelve a subir.`,
    inAppTitle:   (d, c) => `📈 ${d} (${c}) — acelerando`,
    inAppBody:    (days, t) => `Proyección de duplicarse en ~${days} días (su umbral: ${t})`,
  },
  ar: {
    emailTitle:   "📈 تنبيه الاتجاه التنبؤي",
    projected:    (d) => `متوقَّع أن يتضاعف خلال ~${d} يومًا`,
    currentCases: "الحالات الحالية:",
    riskLevel:    "مستوى الخطر:",
    riskValues:   { high: "مرتفع", medium: "متوسط", low: "منخفض" },
    viewBtn:      "← عرض التفشي",
    manageLink:   (url) => `لإدارة تنبيهاتك التنبؤية: ${url}`,
    footer:       (t) => `أُطلق هذا التنبيه لأن اتجاه النمو خلال 7 أيام للتفشي يتوقع الآن تضاعفه خلال أقل من ${t} يومًا. سيُعاد تفعيله بعد 7 أيام، أو أبكر إذا تراجع الاتجاه ثم ارتفع مجددًا.`,
    inAppTitle:   (d, c) => `📈 ${d} (${c}) — في تسارع`,
    inAppBody:    (days, t) => `متوقَّع أن يتضاعف خلال ~${days} يومًا (عتبتك: ${t})`,
  },
  id: {
    emailTitle:   "📈 Peringatan Tren Prediktif",
    projected:    (d) => `Diproyeksikan berlipat ganda dalam ~${d} hari`,
    currentCases: "Kasus saat ini:",
    riskLevel:    "Tingkat risiko:",
    riskValues:   { high: "TINGGI", medium: "SEDANG", low: "RENDAH" },
    viewBtn:      "Lihat wabah →",
    manageLink:   (url) => `Untuk mengelola peringatan prediktif Anda: ${url}`,
    footer:       (t) => `Peringatan ini dipicu karena tren pertumbuhan 7 hari wabah kini diproyeksikan berlipat ganda dalam kurang dari ${t} hari. Akan aktif kembali setelah 7 hari, atau lebih cepat jika tren mereset lalu naik lagi.`,
    inAppTitle:   (d, c) => `📈 ${d} (${c}) — mempercepat`,
    inAppBody:    (days, t) => `Diproyeksikan berlipat ganda dalam ~${days} hari (ambang Anda: ${t})`,
  },
};

interface PredictiveAlert {
  id: string;
  user_id: string;
  outbreak_id: string;
  doubling_within_days: number;
  email: string;
  last_projected_days: number | null;
  triggered_at: string | null;
}

interface Outbreak {
  id: string;
  disease: string; disease_en: string | null; disease_ar: string | null;
  country: string; country_en: string | null; country_ar: string | null;
  cases: number;
  risk_level: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!BREVO_KEY) return NextResponse.json({ ok: true, skipped: "BREVO_API_KEY not configured" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    return await runPredictiveAlerts(supabase);
  } catch (err) {
    console.error("[trigger-predictive-alerts] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "trigger-predictive-alerts" } });
    await logCronRun(supabase, "trigger-predictive-alerts", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runPredictiveAlerts(supabase: SupabaseClient) {
  const { data: alerts } = await supabase
    .from("outbreak_predictive_alerts")
    .select("id, user_id, outbreak_id, doubling_within_days, email, last_projected_days, triggered_at");

  if (!alerts?.length) {
    await logCronRun(supabase, "trigger-predictive-alerts", "ok", 0);
    return NextResponse.json({ ok: true, fired: 0 });
  }

  // Same trial-expiry re-check as trigger-tripwires — plan is re-verified on
  // every run, not just at creation time.
  const userIds = [...new Set((alerts as PredictiveAlert[]).map((a) => a.user_id))];
  const { data: profileRows } = await supabase
    .from("profiles").select("id, alert_locale, plan, trial_ends_at, stripe_subscription_id").in("id", userIds);
  const localeMap: Record<string, string> = Object.fromEntries(
    (profileRows ?? []).map((p: { id: string; alert_locale?: string | null }) => [p.id, p.alert_locale ?? "en"])
  );
  const freeUserIds = new Set(
    (profileRows ?? []).filter((p) => resolvedPlan(p) === "free").map((p) => p.id)
  );

  const outbreakIds = [...new Set((alerts as PredictiveAlert[]).map((a) => a.outbreak_id))];
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, risk_level")
    .in("id", outbreakIds)
    .eq("active", true);

  const oMap = new Map<string, Outbreak>();
  for (const o of (outbreaks ?? []) as Outbreak[]) oMap.set(o.id, o);

  const trends = await getOutbreakTrendsBulk(supabase, outbreakIds);
  const blockedEmails = await getBlockedEmailSet(supabase);

  let fired = 0;
  let blockedSkipped = 0;
  let errors = 0;

  for (const a of alerts as PredictiveAlert[]) {
    const o = oMap.get(a.outbreak_id);
    if (!o) continue;

    const trend = trends.get(a.outbreak_id);
    const projected = trend && trend.direction === "up"
      ? projectedDoublingDays(trend.deltaPercent, trend.daysBack)
      : null;

    const eligible = projected !== null && projected <= a.doubling_within_days;

    if (!eligible) {
      // Trend cooled off (or never accelerated) — clear the marker so a
      // future acceleration reads as fresh, not throttled by an old firing.
      if (projected === null && a.last_projected_days !== null) {
        await supabase
          .from("outbreak_predictive_alerts")
          .update({ last_projected_days: null })
          .eq("id", a.id);
      }
      continue;
    }

    const rearmed = !a.triggered_at ||
      (Date.now() - new Date(a.triggered_at).getTime()) >= REARM_DAYS * 86_400_000;
    if (!rearmed) continue;

    if (freeUserIds.has(a.user_id)) continue;
    if (blockedEmails.has((a.email ?? "").toLowerCase())) { blockedSkipped++; continue; }

    const locale       = localeMap[a.user_id] ?? "en";
    const numLocale    = locale === "ar" ? "ar-SA" : locale;
    const isRtl        = locale === "ar";
    const lc           = COPY[locale] ?? COPY.en;
    const disease      = getLocalizedDisease(o, locale);
    const country      = getLocalizedCountry(o, locale);
    const casesStr     = o.cases.toLocaleString(numLocale);
    const projectedStr = projected!.toFixed(1);
    const thresholdStr = String(a.doubling_within_days);
    const deepLink      = `${APP_URL}/${locale}/outbreak/${o.id}`;

    try {
      const inAppTitle = lc.inAppTitle(disease, country);
      const inAppBody  = lc.inAppBody(projectedStr, thresholdStr);

      await supabase.from("alert_notifications").insert({
        user_id:     a.user_id,
        type:        "predictive_trend",
        title:       inAppTitle,
        body:        inAppBody,
        outbreak_id: o.id,
      }).then(() => {}, () => {});

      await notifyMobile(supabase, a.user_id, { title: inAppTitle, body: inAppBody, outbreak_id: o.id });

      if (isRealProduction) {
        await sendEmail(a.email, `[HealthWatch] ${lc.emailTitle} : ${disease} — ${country}`, `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
  <p style="color:#fb923c;font-size:18px;font-weight:700;margin:0 0 8px">${lc.emailTitle}</p>
  <p style="margin:0 0 16px;font-size:14px;color:#94a3b8">HealthWatch Global</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="margin:0 0 8px;font-size:15px">
    <strong style="color:#fff">${esc(disease)}</strong> — ${esc(country)}
  </p>
  <p style="margin:0 0 4px;font-size:14px;color:#fb923c;font-weight:600">
    ${lc.projected(projectedStr)}
  </p>
  <p style="margin:0 0 4px;font-size:14px;color:#cbd5e1">
    ${lc.currentCases} <strong>${casesStr}</strong>
  </p>
  <p style="margin:0 0 20px;font-size:14px;color:#cbd5e1">
    ${lc.riskLevel} <strong>${esc(lc.riskValues[o.risk_level] ?? o.risk_level.toUpperCase())}</strong>
  </p>
  <a href="${deepLink}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    ${lc.viewBtn}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">
    ${lc.footer(thresholdStr)}
    <br/>${lc.manageLink(APP_URL)}
  </p>
</div>`);
      }

      await supabase
        .from("outbreak_predictive_alerts")
        .update({ last_projected_days: projected, triggered_at: new Date().toISOString() })
        .eq("id", a.id);

      fired++;
    } catch (err) {
      errors++;
      console.error(`[trigger-predictive-alerts] Failed for alert ${a.id}:`, err);
      Sentry.captureException(err, { tags: { cron: "trigger-predictive-alerts", alert_id: a.id, user_id: a.user_id } });
    }
  }

  await logCronRun(supabase, "trigger-predictive-alerts", errors > 0 ? "error" : "ok", fired,
    errors > 0 ? `${errors} alerte(s) prédictive(s) en échec` : undefined);
  return NextResponse.json({ ok: true, fired, blockedSkipped, errors });
}

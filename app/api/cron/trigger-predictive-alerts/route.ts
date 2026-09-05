/**
 * GET /api/cron/trigger-predictive-alerts
 *
 * For each active predictive alert, projects the outbreak's doubling time
 * from its 7-day growth trend (lib/outbreak-trend.ts, backed by
 * outbreak_snapshots) and fires if that projection is under the user's
 * configured window AND the outbreak's week-over-week case count actually
 * grew (see isAccelerating below — the projection alone is not evidence of
 * acceleration on a cumulative counter). Unlike outbreak_tripwires (a manual
 * case-count threshold, checked every 30 min), this is forward-looking and
 * only ever changes once a day — one snapshot/day per outbreak — so it only
 * needs to run once a day itself.
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

// ── Is it actually accelerating? ─────────────────────────────────────────────
// `outbreaks.cases` is a CUMULATIVE counter, so a projected doubling OF IT is
// not evidence of acceleration: at a perfectly constant incidence the
// cumulative total still doubles — 100 cases growing by 10/day reaches 200 in
// exactly 10 days — and projectedDoublingDays() above reports that as "~9
// days". Worse, at constant incidence the cumulative doubling time keeps
// LENGTHENING (100→200 in 10d, then 200→400 in 20d), so the alert fires early
// in a row's tracked life and goes quiet afterwards: the opposite of an early
// warning. The arithmetic isn't wrong; the claim laid on top of it is — the
// email is titled "Predictive Trend Alert" and the in-app notification reads
// "— accelerating".
//
// Measured against prod 2026-09-05 by replaying this cron over the full
// snapshot history (outbreak_snapshots: 6,460 rows, 78 days, 65 of them
// evaluable, 121 active rows) at the 14-day window the UI offers by default:
// of 341 firings, 32 (9%) were on rows whose week-over-week case count was
// flat or falling and 28 (8%) frankly falling. West Nile/Spain on 22/08 would
// have been mailed "projected to double in ~12.0 days · accelerating" with
// new cases down from 39 the previous week to 21.
//
// The projection still sets the threshold. This only refuses to call
// something acceleration when the weekly case count did not in fact grow.
function isAccelerating(recentWeekCases: number, priorWeekCases: number): boolean {
  return recentWeekCases >= priorWeekCases;
}

// New cases over the week BEFORE the one lib/outbreak-trend.ts measures, per
// outbreak. The J-7 boundary is fetched with the same window and ordering as
// getOutbreakTrendsBulk's `oldest` query, so the row picked here is the same
// one its delta is measured from and the two weeks are contiguous rather than
// overlapping. Returns nothing for an outbreak with under two weeks of
// snapshots — no comparison term means the claim can't be supported, so it
// isn't made.
async function getPriorWeekCases(
  supabase: SupabaseClient,
  outbreakIds: string[],
): Promise<Map<string, number>> {
  const dayStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  // Paged: one snapshot per outbreak per day means 121 active rows × an 8-day
  // window already sits within a few dozen rows of Supabase's 1,000-row reply
  // cap, and a truncated reply comes back as a success (see
  // reference_supabase_caps_queries_at_1000_rows).
  const fetchWindow = async (fromDaysAgo: number, toDaysAgo: number) => {
    const rows: { outbreak_id: string; cases: number; snapped_at: string }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data } = await supabase
        .from("outbreak_snapshots")
        .select("outbreak_id, cases, snapped_at")
        .in("outbreak_id", outbreakIds)
        .gte("snapped_at", dayStr(fromDaysAgo))
        .lte("snapped_at", dayStr(toDaysAgo))
        .order("snapped_at", { ascending: false })
        .range(offset, offset + 999);
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    // Most recent row per outbreak within the window.
    const byId = new Map<string, number>();
    for (const r of rows) if (!byId.has(r.outbreak_id)) byId.set(r.outbreak_id, r.cases);
    return byId;
  };

  // Same [2×DAYS_BACK, DAYS_BACK] window as getOutbreakTrendsBulk, then the
  // one before it — the same width, so a skipped snapshot cron is tolerated
  // identically on both sides of the comparison.
  const [atWeek1, atWeek2] = await Promise.all([fetchWindow(14, 7), fetchWindow(28, 14)]);

  const priorWeek = new Map<string, number>();
  for (const [id, week1Cases] of atWeek1) {
    const week2Cases = atWeek2.get(id);
    if (week2Cases === undefined) continue;
    priorWeek.set(id, week1Cases - week2Cases);
  }
  return priorWeek;
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
  const priorWeekCases = await getPriorWeekCases(supabase, outbreakIds);
  const blockedEmails = await getBlockedEmailSet(supabase);

  let fired = 0;
  let blockedSkipped = 0;
  let errors = 0;
  let notAccelerating = 0;

  for (const a of alerts as PredictiveAlert[]) {
    const o = oMap.get(a.outbreak_id);
    if (!o) continue;

    const trend = trends.get(a.outbreak_id);
    const rising = trend && trend.direction === "up" ? trend : null;
    const projected = rising ? projectedDoublingDays(rising.deltaPercent, rising.daysBack) : null;

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

    // The projection cleared the user's window — but on a cumulative counter
    // that alone doesn't mean the outbreak is accelerating (see
    // isAccelerating above). Confirm against the actual week-over-week case
    // count before making that claim, and stay silent when there's nothing to
    // confirm it with.
    const priorWeek = priorWeekCases.get(a.outbreak_id);
    if (!rising || priorWeek === undefined || !isAccelerating(rising.deltaCases, priorWeek)) {
      notAccelerating++;
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
  return NextResponse.json({ ok: true, fired, blockedSkipped, notAccelerating, errors });
}

/**
 * GET /api/cron/trigger-tripwires
 *
 * For each active tripwire, checks whether the outbreak's current case count
 * has crossed the threshold since the last check. If so, sends a single email
 * via Resend and records the trigger. Re-triggers if cases drop below threshold
 * then rise again (detected via last_checked_cases).
 *
 * Runs every 30 minutes via Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
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

const COPY: Record<string, {
  emailTitle:  string;
  currentCases: string;
  riskLevel:   string;
  viewBtn:     string;
  footer:      (threshold: string) => string;
  inAppTitle:  (disease: string, country: string, cases: string) => string;
  inAppBody:   (cases: string, threshold: string, risk: string) => string;
}> = {
  en: {
    emailTitle:  "⚠ Tripwire Alert",
    currentCases: "Current cases:",
    riskLevel:   "Risk level:",
    viewBtn:     "View outbreak →",
    footer:      (t) => `This alert was triggered because the outbreak crossed your configured threshold of ${t} cases. It will re-trigger if cases drop below the threshold and rise again.`,
    inAppTitle:  (d, c, n) => `⚠ ${d} (${c}) — ${n} cases`,
    inAppBody:   (n, t, r) => `Tripwire crossed: ${n} cases (threshold: ${t}) · Risk: ${r}`,
  },
  fr: {
    emailTitle:  "⚠ Alerte seuil critique",
    currentCases: "Cas actuels :",
    riskLevel:   "Niveau de risque :",
    viewBtn:     "Voir le foyer →",
    footer:      (t) => `Cette alerte a été déclenchée car le foyer a dépassé votre seuil configuré de ${t} cas. Elle se redéclenche si les cas repassent sous le seuil puis remontent.`,
    inAppTitle:  (d, c, n) => `⚠ ${d} (${c}) — ${n} cas`,
    inAppBody:   (n, t, r) => `Seuil franchi : ${n} cas (seuil : ${t}) · Risque : ${r}`,
  },
  es: {
    emailTitle:  "⚠ Alerta de umbral",
    currentCases: "Casos actuales:",
    riskLevel:   "Nivel de riesgo:",
    viewBtn:     "Ver brote →",
    footer:      (t) => `Esta alerta se activó porque el brote superó su umbral configurado de ${t} casos. Se reactivará si los casos bajan del umbral y vuelven a subir.`,
    inAppTitle:  (d, c, n) => `⚠ ${d} (${c}) — ${n} casos`,
    inAppBody:   (n, t, r) => `Umbral cruzado: ${n} casos (umbral: ${t}) · Riesgo: ${r}`,
  },
  ar: {
    emailTitle:  "⚠ تنبيه العتبة",
    currentCases: "الحالات الحالية:",
    riskLevel:   "مستوى الخطر:",
    viewBtn:     "← عرض التفشي",
    footer:      (t) => `أُطلق هذا التنبيه لأن التفشي تجاوز عتبتك المحددة وهي ${t} حالة. سيُعاد تشغيله إذا انخفضت الحالات عن العتبة ثم ارتفعت مرة أخرى.`,
    inAppTitle:  (d, c, n) => `⚠ ${d} (${c}) — ${n} حالة`,
    inAppBody:   (n, t, r) => `تجاوز العتبة: ${n} حالة (العتبة: ${t}) · الخطر: ${r}`,
  },
  id: {
    emailTitle:  "⚠ Peringatan batas",
    currentCases: "Kasus saat ini:",
    riskLevel:   "Tingkat risiko:",
    viewBtn:     "Lihat wabah →",
    footer:      (t) => `Peringatan ini dipicu karena wabah melampaui ambang batas Anda sebesar ${t} kasus. Akan dipicu lagi jika kasus turun di bawah ambang lalu naik kembali.`,
    inAppTitle:  (d, c, n) => `⚠ ${d} (${c}) — ${n} kasus`,
    inAppBody:   (n, t, r) => `Ambang dilampaui: ${n} kasus (ambang: ${t}) · Risiko: ${r}`,
  },
};

interface Tripwire {
  id: string;
  user_id: string;
  outbreak_id: string;
  threshold_cases: number;
  email: string;
  last_checked_cases: number;
}

interface Outbreak {
  id: string;
  disease_en: string | null;
  country_en: string | null;
  cases: number;
  risk_level: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!BREVO_KEY) return NextResponse.json({ ok: true, skipped: "BREVO_API_KEY not configured" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: tripwires } = await supabase
    .from("outbreak_tripwires")
    .select("id, user_id, outbreak_id, threshold_cases, email, last_checked_cases");

  if (!tripwires?.length) return NextResponse.json({ ok: true, fired: 0 });

  // Fetch user locales in bulk
  const userIds = [...new Set((tripwires as Tripwire[]).map((t) => t.user_id))];
  const { data: profileLocales } = await supabase
    .from("profiles").select("id, alert_locale").in("id", userIds);
  const localeMap: Record<string, string> = Object.fromEntries(
    (profileLocales ?? []).map((p: { id: string; alert_locale?: string | null }) => [p.id, p.alert_locale ?? "en"])
  );

  const outbreakIds = [...new Set((tripwires as Tripwire[]).map((t) => t.outbreak_id))];
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, risk_level")
    .in("id", outbreakIds)
    .eq("active", true);

  const oMap = new Map<string, Outbreak>();
  for (const o of (outbreaks ?? []) as Outbreak[]) oMap.set(o.id, o);

  let fired = 0;

  for (const tw of tripwires as Tripwire[]) {
    const o = oMap.get(tw.outbreak_id);
    if (!o) continue;

    const crossed = o.cases >= tw.threshold_cases && tw.last_checked_cases < tw.threshold_cases;

    // Always update last_checked_cases
    await supabase
      .from("outbreak_tripwires")
      .update({
        last_checked_cases: o.cases,
        ...(crossed ? { triggered_at: new Date().toISOString() } : {}),
      })
      .eq("id", tw.id);

    if (!crossed) continue;

    const locale       = localeMap[tw.user_id] ?? "en";
    const numLocale    = locale === "ar" ? "ar-SA" : locale;
    const isRtl        = locale === "ar";
    const lc           = COPY[locale] ?? COPY.en;
    const disease      = o.disease_en ?? "Unknown disease";
    const country      = o.country_en ?? "Unknown country";
    const casesStr     = o.cases.toLocaleString(numLocale);
    const thresholdStr = tw.threshold_cases.toLocaleString(numLocale);
    const deepLink     = `${APP_URL}/${locale}?outbreak=${o.id}`;

    try {
      await supabase.from("alert_notifications").insert({
        user_id:     tw.user_id,
        type:        "tripwire",
        title:       lc.inAppTitle(disease, country, casesStr),
        body:        lc.inAppBody(casesStr, thresholdStr, o.risk_level),
        outbreak_id: o.id,
      }).then(() => {}, () => {});

      await sendEmail(tw.email, `[HealthWatch] Tripwire : ${disease} — ${country} (${casesStr})`, `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
  <p style="color:#f87171;font-size:18px;font-weight:700;margin:0 0 8px">${lc.emailTitle}</p>
  <p style="margin:0 0 16px;font-size:14px;color:#94a3b8">HealthWatch Global</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="margin:0 0 8px;font-size:15px">
    <strong style="color:#fff">${esc(disease)}</strong> — ${esc(country)}
  </p>
  <p style="margin:0 0 4px;font-size:14px;color:#cbd5e1">
    ${lc.currentCases} <strong style="color:#f87171">${casesStr}</strong>
    &nbsp;(${thresholdStr})
  </p>
  <p style="margin:0 0 20px;font-size:14px;color:#cbd5e1">
    ${lc.riskLevel} <strong>${o.risk_level.toUpperCase()}</strong>
  </p>
  <a href="${deepLink}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    ${lc.viewBtn}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">
    ${lc.footer(thresholdStr)}
    <br/>To manage your tripwires: ${APP_URL}
  </p>
</div>`);
      fired++;
    } catch (err) {
      console.error(`[trigger-tripwires] Failed for tripwire ${tw.id}:`, err);
      Sentry.captureException(err, { tags: { cron: "trigger-tripwires", tripwire_id: tw.id, user_id: tw.user_id } });
    }
  }

  return NextResponse.json({ ok: true, fired });
}

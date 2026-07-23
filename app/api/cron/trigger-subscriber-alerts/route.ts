import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { notifyMobile } from "@/lib/mobile-notify";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

async function sendEmail(to: string | string[], subject: string, html: string) {
  const toArr = Array.isArray(to) ? to.map((e) => ({ email: e })) : [{ email: to }];
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:          toArr,
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo error ${res.status}: ${await res.text()}`);
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const RISK_LABEL: Record<string, Record<string, string>> = {
  en: { high: "HIGH", medium: "MEDIUM", low: "LOW" },
  fr: { high: "ÉLEVÉ", medium: "MODÉRÉ", low: "FAIBLE" },
  es: { high: "ALTO",  medium: "MEDIO",  low: "BAJO"  },
  ar: { high: "مرتفع", medium: "متوسط",  low: "منخفض" },
  id: { high: "TINGGI", medium: "SEDANG", low: "RENDAH" },
};

const SUBJECT: Record<string, (d: string, c: string) => string> = {
  en: (d, c) => `[HealthWatch] Update: ${d} — ${c}`,
  fr: (d, c) => `[HealthWatch] Mise à jour : ${d} — ${c}`,
  es: (d, c) => `[HealthWatch] Actualización: ${d} — ${c}`,
  ar: (d, c) => `[HealthWatch] تحديث: ${d} — ${c}`,
  id: (d, c) => `[HealthWatch] Pembaruan: ${d} — ${c}`,
};

const BODY_LABELS: Record<string, { subtitle: string; cases: string; deaths: string; cfr: string; risk: string; lastReport: string; view: string; footer: string }> = {
  en: { subtitle: "Outbreak subscriber alert", cases: "Cases:", deaths: "Deaths:", cfr: "CFR:", risk: "Risk level:", lastReport: "Last report:", view: "View outbreak →", footer: `You subscribed to updates for this outbreak on HealthWatch Global. To unsubscribe, open the outbreak detail and remove your email. ${APP_URL}` },
  fr: { subtitle: "Alerte abonné — foyer épidémique", cases: "Cas :", deaths: "Décès :", cfr: "Létalité :", risk: "Risque :", lastReport: "Dernier rapport :", view: "Voir le foyer →", footer: `Vous êtes abonné aux mises à jour de ce foyer sur HealthWatch Global. Pour vous désabonner, ouvrez les détails du foyer et supprimez votre email. ${APP_URL}` },
  es: { subtitle: "Alerta de seguimiento — brote", cases: "Casos:", deaths: "Fallecidos:", cfr: "Letalidad:", risk: "Riesgo:", lastReport: "Último informe:", view: "Ver brote →", footer: `Estás suscrito a las actualizaciones de este brote en HealthWatch Global. Para cancelar, abre el detalle del brote y elimina tu email. ${APP_URL}` },
  ar: { subtitle: "تنبيه متابعة التفشي", cases: "الحالات:", deaths: "الوفيات:", cfr: "معدل الوفيات:", risk: "مستوى الخطر:", lastReport: "آخر تقرير:", view: "← عرض التفشي", footer: `اشتركت في تحديثات هذا التفشي على HealthWatch Global. لإلغاء الاشتراك، افتح تفاصيل التفشي وأزل بريدك الإلكتروني. ${APP_URL}` },
  id: { subtitle: "Peringatan pemantauan wabah", cases: "Kasus:", deaths: "Kematian:", cfr: "CFR:", risk: "Tingkat risiko:", lastReport: "Laporan terakhir:", view: "Lihat wabah →", footer: `Anda berlangganan pembaruan wabah ini di HealthWatch Global. Untuk berhenti berlangganan, buka detail wabah dan hapus email Anda. ${APP_URL}` },
};

interface Subscriber {
  id: string; user_id: string; outbreak_id: string;
  emails: string[]; locale: string; last_sent_at: string | null;
}
interface Outbreak {
  id: string;
  disease: string; disease_en: string | null; disease_ar: string | null;
  country: string; country_en: string | null; country_ar: string | null;
  cases: number; deaths: number; risk_level: string; date: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!BREVO_KEY) return NextResponse.json({ ok: true, skipped: "BREVO_API_KEY not configured" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: subscribers } = await supabase
    .from("outbreak_subscribers")
    .select("id, user_id, outbreak_id, emails, locale, last_sent_at");

  if (!subscribers?.length) {
    await logCronRun(supabase, "trigger-subscriber-alerts", "ok", 0);
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const outbreakIds = [...new Set((subscribers as Subscriber[]).map((s) => s.outbreak_id))];
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, deaths, risk_level, date")
    .in("id", outbreakIds)
    .eq("active", true);

  const oMap = new Map<string, Outbreak>();
  for (const o of (outbreaks ?? []) as Outbreak[]) oMap.set(o.id, o);

  // Outbreak subscriptions are a paid feature (creation gated by
  // resolvedPlan() in app/api/outbreak-subscribers/route.ts), but this cron
  // never checked it at all — a subscription created during a trial kept
  // firing forever even after the trial expired without payment.
  const subUserIds = [...new Set((subscribers as Subscriber[]).map((s) => s.user_id))];
  const { data: profileRows } = await supabase
    .from("profiles").select("id, plan, trial_ends_at, stripe_subscription_id").in("id", subUserIds);
  const freeUserIds = new Set(
    (profileRows ?? []).filter((p) => resolvedPlan(p) === "free").map((p) => p.id)
  );

  const COOLDOWN_H = 24;
  let sent = 0;

  for (const sub of subscribers as Subscriber[]) {
    const o = oMap.get(sub.outbreak_id);
    if (!o || !sub.emails.length) continue;
    if (freeUserIds.has(sub.user_id)) continue;

    // Respect 24-hour cooldown
    if (sub.last_sent_at) {
      const h = (Date.now() - new Date(sub.last_sent_at).getTime()) / 3600000;
      if (h < COOLDOWN_H) continue;
    }

    const locale    = sub.locale in SUBJECT ? sub.locale : "en";
    const numLocale = locale === "ar" ? "ar-SA" : locale;
    const isRtl     = locale === "ar";
    const bl        = BODY_LABELS[locale] ?? BODY_LABELS.en;
    const disease   = getLocalizedDisease(o, locale);
    const country   = getLocalizedCountry(o, locale);
    const risk      = (RISK_LABEL[locale] ?? RISK_LABEL.en)[o.risk_level] ?? o.risk_level.toUpperCase();
    const deepLink  = `${APP_URL}/${locale}/outbreak/${o.id}`;
    const cfr       = o.cases > 0 && o.deaths != null ? (o.deaths / o.cases * 100).toFixed(1) : null;

    const subject = (SUBJECT[locale] ?? SUBJECT.en)(disease, country);
    const html = `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
  <p style="color:#60a5fa;font-size:18px;font-weight:700;margin:0 0 4px">HealthWatch Global</p>
  <p style="margin:0 0 16px;font-size:12px;color:#64748b">${bl.subtitle}</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#fff">${esc(disease)} — ${esc(country)}</p>
  <p style="margin:0 0 12px;font-size:13px;color:#94a3b8">
    ${bl.cases} <strong style="color:#f1f5f9">${o.cases.toLocaleString(numLocale)}</strong> &nbsp;|&nbsp;
    ${bl.deaths} <strong style="color:#f1f5f9">${(o.deaths ?? 0).toLocaleString(numLocale)}</strong>
    ${cfr ? `&nbsp;|&nbsp; ${bl.cfr} <strong style="color:#f1f5f9">${cfr}%</strong>` : ""}
  </p>
  <p style="margin:0 0 20px;font-size:13px;color:#94a3b8">
    ${bl.risk} <strong style="color:${o.risk_level === "high" ? "#f87171" : o.risk_level === "medium" ? "#fbbf24" : "#4ade80"}">${risk}</strong>
    &nbsp;|&nbsp; ${bl.lastReport} ${o.date}
  </p>
  <a href="${deepLink}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    ${bl.view}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">${bl.footer}</p>
</div>`;

    try {
      // Update dedup marker BEFORE sending — prevents re-send on cron retry
      await supabase
        .from("outbreak_subscribers")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", sub.id);

      if (isRealProduction) await sendEmail(sub.emails, subject, html);
      sent++;

      const inAppBody = `${disease} · ${country} · ${risk}`;

      await supabase.from("alert_notifications").insert({
        user_id:     sub.user_id,
        type:        "subscriber",
        title:       subject,
        body:        inAppBody,
        outbreak_id: o.id,
      }).then(() => {}, () => {});

      await notifyMobile(supabase, sub.user_id, { title: subject, body: inAppBody, outbreak_id: o.id });
    } catch (err) {
      console.error(`[trigger-subscriber-alerts] Failed for sub ${sub.id}:`, err);
      Sentry.captureException(err, { tags: { cron: "trigger-subscriber-alerts", sub_id: sub.id, user_id: sub.user_id } });
    }
  }

  await logCronRun(supabase, "trigger-subscriber-alerts", "ok", sent);
  return NextResponse.json({ ok: true, sent });
}

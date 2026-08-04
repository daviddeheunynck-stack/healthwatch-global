/**
 * GET /api/cron/send-sitrep-emails
 *
 * Sends weekly sitrep HTML email to all users who configured
 * scheduled reports. Plan-gated: Pro=1 recipient, Team=5, Enterprise=50.
 * Runs every Monday at 07:20 UTC via Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction, currentWeekOf } from "@/lib/cron-monitor";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { getBlockedEmailSet } from "@/lib/brevo-blocklist";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const esc   = (s: string | null | undefined) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

const PLAN_LIMITS: Record<string, number> = { pro: 1, team: 5, enterprise: 50 };
const PAID_PLANS = Object.keys(PLAN_LIMITS);

const RISK_LABEL: Record<string, Record<string, string>> = {
  fr: { high: "Élevé 🔴", medium: "Moyen 🟡", low: "Faible 🟢" },
  en: { high: "High 🔴", medium: "Medium 🟡", low: "Low 🟢" },
  es: { high: "Alto 🔴", medium: "Medio 🟡", low: "Bajo 🟢" },
  ar: { high: "مرتفع 🔴", medium: "متوسط 🟡", low: "منخفض 🟢" },
  id: { high: "Tinggi 🔴", medium: "Sedang 🟡", low: "Rendah 🟢" },
};

const SUBJECT: Record<string, string> = {
  fr: "HealthWatch Global — Rapport épidémiologique hebdomadaire",
  en: "HealthWatch Global — Weekly epidemic situation report",
  es: "HealthWatch Global — Informe epidemiológico semanal",
  ar: "HealthWatch Global — التقرير الوبائي الأسبوعي",
  id: "HealthWatch Global — Laporan situasi epidemi mingguan",
};

interface Outbreak {
  id: string;
  disease: string;
  disease_en: string | null;
  disease_ar: string | null;
  country: string;
  country_en: string | null;
  country_ar: string | null;
  region: string;
  risk_level: string;
  cases: number;
  deaths: number;
  is_pheic: boolean;
}

function buildEmailHtml(outbreaks: Outbreak[], locale: string, date: string): string {
  const rl = RISK_LABEL[locale] ?? RISK_LABEL.en;
  const numLocale = locale === "ar" ? "ar-SA" : locale;
  const isRtl     = locale === "ar";
  const sitrep_url = `${APP_URL}/${locale}/sitrep`;

  const header = {
    fr: "Situation épidémiologique mondiale",
    en: "Global epidemic situation",
    es: "Situación epidemiológica mundial",
    ar: "الوضع الوبائي العالمي",
    id: "Situasi epidemi global",
  }[locale] ?? "Global epidemic situation";

  const view_more = {
    fr: "Voir le rapport complet →",
    en: "View full report →",
    es: "Ver informe completo →",
    ar: "عرض التقرير الكامل ←",
    id: "Lihat laporan lengkap →",
  }[locale] ?? "View full report →";

  const casesLbl = { fr: "cas", en: "cases", es: "casos", ar: "حالة", id: "kasus" }[locale] ?? "cases";
  const deathsLbl = { fr: "décès", en: "deaths", es: "fallecidos", ar: "وفاة", id: "kematian" }[locale] ?? "deaths";

  const poweredBy = {
    fr: `Propulsé par <strong style="color:#9ca3af">HealthWatch Global</strong> — <a href="${APP_URL}" style="color:#6b7280">healthwatch-global.com</a>`,
    en: `Powered by <strong style="color:#9ca3af">HealthWatch Global</strong> — <a href="${APP_URL}" style="color:#6b7280">healthwatch-global.com</a>`,
    es: `Desarrollado por <strong style="color:#9ca3af">HealthWatch Global</strong> — <a href="${APP_URL}" style="color:#6b7280">healthwatch-global.com</a>`,
    ar: `بواسطة <strong style="color:#9ca3af">HealthWatch Global</strong> — <a href="${APP_URL}" style="color:#6b7280">healthwatch-global.com</a>`,
    id: `Didukung oleh <strong style="color:#9ca3af">HealthWatch Global</strong> — <a href="${APP_URL}" style="color:#6b7280">healthwatch-global.com</a>`,
  }[locale] ?? `Powered by <strong style="color:#9ca3af">HealthWatch Global</strong> — <a href="${APP_URL}" style="color:#6b7280">healthwatch-global.com</a>`;

  const manageNote = {
    fr: `Vous recevez cet email car vous avez configuré l'envoi hebdomadaire du sitrep. <a href="${APP_URL}" style="color:#6b7280">Gérer les préférences</a>`,
    en: `You are receiving this because you configured weekly sitrep delivery. <a href="${APP_URL}" style="color:#6b7280">Manage preferences</a>`,
    es: `Recibe este correo porque configuró el envío semanal del sitrep. <a href="${APP_URL}" style="color:#6b7280">Gestionar preferencias</a>`,
    ar: `تتلقى هذا البريد لأنك قمت بتفعيل الإرسال الأسبوعي للتقرير الوبائي. <a href="${APP_URL}" style="color:#6b7280">إدارة التفضيلات</a>`,
    id: `Anda menerima ini karena telah mengonfigurasi pengiriman sitrep mingguan. <a href="${APP_URL}" style="color:#6b7280">Kelola preferensi</a>`,
  }[locale] ?? `You are receiving this because you configured weekly sitrep delivery. <a href="${APP_URL}" style="color:#6b7280">Manage preferences</a>`;

  const rows = outbreaks.slice(0, 10).map((o) => {
    const disease = esc(getLocalizedDisease({ disease: o.disease, disease_en: o.disease_en ?? null, disease_ar: o.disease_ar ?? null }, locale));
    const country = esc(getLocalizedCountry({ country: o.country, country_en: o.country_en ?? null, country_ar: o.country_ar ?? null }, locale));
    const cfr = o.cases > 0 ? ` · CFR ${(o.deaths / o.cases * 100).toFixed(1)}%` : "";
    const pheic = o.is_pheic ? " · PHEIC" : "";
    return `
      <tr style="border-bottom:1px solid #374151">
        <td style="padding:10px 8px;font-weight:600;color:#f9fafb">${disease}</td>
        <td style="padding:10px 8px;color:#9ca3af">${country}</td>
        <td style="padding:10px 8px;color:#e5e7eb;font-variant-numeric:tabular-nums">${o.cases.toLocaleString(numLocale)}&nbsp;${casesLbl}${o.deaths > 0 ? ` · ${o.deaths.toLocaleString(numLocale)}&nbsp;${deathsLbl}` : ""}${cfr}${pheic}</td>
        <td style="padding:10px 8px;white-space:nowrap">${rl[o.risk_level] ?? o.risk_level}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f9fafb;direction:${isRtl ? "rtl" : "ltr"}">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;text-align:${isRtl ? "right" : "left"}">
    <div style="margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;letter-spacing:0.1em;text-transform:uppercase">HEALTHWATCH GLOBAL</p>
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700">${header}</h1>
      <p style="margin:0;font-size:13px;color:#6b7280">${date}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#1f2937;border-radius:8px;overflow:hidden">
      <tbody>${rows}</tbody>
    </table>

    <div style="margin-top:24px;text-align:center">
      <a href="${sitrep_url}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px">${view_more}</a>
    </div>

    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #374151;font-size:11px;color:#6b7280">
      <p style="margin:0">${poweredBy}</p>
      <p style="margin:4px 0 0">${manageNote}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!BREVO_KEY) return NextResponse.json({ error: "BREVO_API_KEY not configured" }, { status: 500 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Defensive wrapper: an uncaught exception anywhere before or between the
  // fetches/loop below (only the send itself has a local try/catch) used to
  // propagate straight out — bare 500, no Sentry event, logCronRun never
  // reached. Same root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runSendSitrepEmails(req, supabase);
  } catch (err) {
    console.error("[send-sitrep-emails] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "send-sitrep-emails" } });
    await logCronRun(supabase, "send-sitrep-emails", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runSendSitrepEmails(_req: NextRequest, supabase: SupabaseClient) {
  // Fetch all active scheduled reports
  const { data: reports } = await supabase
    .from("scheduled_reports")
    .select("id, user_id, recipients, locale, active")
    .eq("active", true);

  if (!reports?.length) {
    await logCronRun(supabase, "send-sitrep-emails", "ok", 0);
    return NextResponse.json({ ok: true, sent: 0, note: "no active reports" });
  }

  // Fetch all active high/medium outbreaks once (shared across all emails)
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, region, risk_level, cases, deaths, is_pheic")
    .eq("active", true)
    .in("risk_level", ["high", "medium"])
    .order("risk_level", { ascending: true })
    .order("cases", { ascending: false })
    .limit(20);

  const sorted = (outbreaks ?? []) as Outbreak[];

  const today = new Date().toISOString().split("T")[0];
  let totalSent = 0;
  let blockedSkipped = 0;
  let alreadySent = 0;
  let errors = 0;
  const now = new Date().toISOString();
  // scheduled_reports.last_sent_at already existed but was only ever written
  // after a send, never checked before one -- a manual re-invocation (or a
  // genuine duplicate Vercel Cron trigger) resent the same week's sitrep to
  // every recipient. Found 2026-08-04. weekOfIso is this week's Monday
  // 00:00 UTC: a report last sent before that boundary is eligible again,
  // one at or after it is not.
  const weekOfIso = `${currentWeekOf()}T00:00:00.000Z`;

  // report.recipients is a free-text list (not always a profiles row) —
  // matched against the full Brevo blocklist cache. See lib/brevo-blocklist.ts.
  const blockedEmails = await getBlockedEmailSet(supabase);

  for (const report of reports) {
    // Check user plan
    const { data: profile } = await supabase
      .from("profiles").select("plan").eq("id", report.user_id).single();
    const plan = profile?.plan ?? "free";
    if (!PAID_PLANS.includes(plan)) continue;

    const maxRecipients = PLAN_LIMITS[plan] ?? 1;
    const recipients = (report.recipients as string[])
      .filter((e) => !blockedEmails.has(e.toLowerCase()))
      .slice(0, maxRecipients);
    if (recipients.length === 0) { blockedSkipped++; continue; }

    // Claim before send, atomically: only succeeds if this report hasn't
    // already been marked sent since this week's Monday. A concurrent or
    // repeat invocation racing this one gets an empty `claimRows` and skips
    // rather than re-sending. Fails open (proceeds to send) on a claim
    // error, same trade-off as claimEmailSend/claimWeeklyDigestSend.
    const { data: claimRows, error: claimErr } = await supabase
      .from("scheduled_reports")
      .update({ last_sent_at: now })
      .eq("id", report.id)
      .or(`last_sent_at.is.null,last_sent_at.lt.${weekOfIso}`)
      .select("id");
    if (claimErr) {
      console.error(`[send-sitrep-emails] dedup claim failed for report ${report.id}, sending anyway:`, claimErr.message);
    } else if (!claimRows || claimRows.length === 0) {
      alreadySent++;
      continue;
    }

    const locale: string = report.locale || "en";
    const html    = buildEmailHtml(sorted, locale, today);
    const subject = SUBJECT[locale] ?? SUBJECT.en;

    try {
      if (isRealProduction) {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
          headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
            to:          recipients.map((e) => ({ email: e })),
            subject,
            htmlContent: html,
          }),
        });
        if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
      }
      totalSent += recipients.length;
    } catch (err) {
      errors++;
      console.error(`[send-sitrep-emails] Failed for report ${report.id}:`, err);
      Sentry.captureException(err, { tags: { cron: "send-sitrep-emails", report_id: report.id, user_id: report.user_id } });
    }
  }

  await logCronRun(supabase, "send-sitrep-emails", errors > 0 ? "error" : "ok", totalSent,
    errors > 0 ? `${errors} rapport(s) en échec` : undefined);
  return NextResponse.json({ ok: true, sent: totalSent, blockedSkipped, alreadySent, errors });
}

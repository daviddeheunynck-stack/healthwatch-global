/**
 * GET /api/cron/send-sitrep-emails
 *
 * Sends weekly sitrep HTML email to all users who configured
 * scheduled reports. Plan-gated: Pro=1 recipient, Team=5, Enterprise=50.
 * Runs every Monday at 07:20 UTC via Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();
const esc   = (s: string | null | undefined) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const RESEND_KEY       = clean(process.env.RESEND_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";
const FROM_EMAIL       = "HealthWatch Global <alerts@healthwatch-global.com>";

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
  country: string;
  country_en: string | null;
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

  const rows = outbreaks.slice(0, 10).map((o) => {
    const disease = esc(o.disease_en || o.disease);
    const country = esc(o.country_en || o.country);
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
      <p style="margin:0">Powered by <strong style="color:#9ca3af">HealthWatch Global</strong> — <a href="${APP_URL}" style="color:#6b7280">healthwatch-global.com</a></p>
      <p style="margin:4px 0 0">You are receiving this because you configured weekly sitrep delivery. <a href="${APP_URL}" style="color:#6b7280">Manage preferences</a></p>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!RESEND_KEY) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const resend   = new Resend(RESEND_KEY);

  // Fetch all active scheduled reports
  const { data: reports } = await supabase
    .from("scheduled_reports")
    .select("id, user_id, recipients, locale, active")
    .eq("active", true);

  if (!reports?.length)
    return NextResponse.json({ ok: true, sent: 0, note: "no active reports" });

  // Fetch all active high/medium outbreaks once (shared across all emails)
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, country, country_en, region, risk_level, cases, deaths, is_pheic")
    .eq("active", true)
    .in("risk_level", ["high", "medium"])
    .order("risk_level", { ascending: true })
    .order("cases", { ascending: false })
    .limit(20);

  const sorted = (outbreaks ?? []) as Outbreak[];

  const today = new Date().toISOString().split("T")[0];
  let totalSent = 0;
  const now = new Date().toISOString();

  for (const report of reports) {
    // Check user plan
    const { data: profile } = await supabase
      .from("profiles").select("plan").eq("id", report.user_id).single();
    const plan = profile?.plan ?? "free";
    if (!PAID_PLANS.includes(plan)) continue;

    const maxRecipients = PLAN_LIMITS[plan] ?? 1;
    const recipients = (report.recipients as string[]).slice(0, maxRecipients);
    if (recipients.length === 0) continue;

    const locale: string = report.locale || "en";
    const html    = buildEmailHtml(sorted, locale, today);
    const subject = SUBJECT[locale] ?? SUBJECT.en;

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipients,
        subject,
        html,
      });
      totalSent += recipients.length;
    } catch {
      // continue with next report
    }

    await supabase
      .from("scheduled_reports")
      .update({ last_sent_at: now })
      .eq("id", report.id);
  }

  return NextResponse.json({ ok: true, sent: totalSent });
}

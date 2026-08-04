/**
 * Cron: /api/cron/pilot-follow-up
 * Schedule: 0 8 * * * (daily 08:00 UTC)
 *
 * Targets Pro users whose account was activated 7.5–8.5 days ago.
 * Sends a personalized weekly signal email filtered to their saved region.
 * Goal: give pilots a concrete reason to return before they go silent.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction, claimEmailSend } from "@/lib/cron-monitor";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL || "https://healthwatch-global.com");

// ─── i18n ─────────────────────────────────────────────────────────────────────

const REGION_LABELS: Record<string, Record<string, string>> = {
  fr: { africa: "Afrique", asia: "Asie", americas: "Amériques", europe: "Europe", oceania: "Océanie", all: "Monde" },
  en: { africa: "Africa",  asia: "Asia",  americas: "Americas",  europe: "Europe", oceania: "Oceania",  all: "Global" },
  es: { africa: "África",  asia: "Asia",  americas: "Américas",  europe: "Europa", oceania: "Oceanía",  all: "Global" },
  ar: { africa: "أفريقيا", asia: "آسيا",  americas: "الأمريكتان", europe: "أوروبا", oceania: "أوقيانوسيا", all: "عالمي" },
  id: { africa: "Afrika",  asia: "Asia",  americas: "Amerika",   europe: "Eropa",  oceania: "Oseania",  all: "Global" },
};

const RISK_COLORS: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#22c55e",
};

const RISK_LABELS: Record<string, Record<string, string>> = {
  fr: { high: "ÉLEVÉ", medium: "MODÉRÉ", low: "FAIBLE" },
  en: { high: "HIGH",  medium: "MEDIUM", low: "LOW"    },
  es: { high: "ALTO",  medium: "MEDIO",  low: "BAJO"   },
  ar: { high: "مرتفع", medium: "متوسط",  low: "منخفض"  },
  id: { high: "TINGGI", medium: "SEDANG", low: "RENDAH" },
};

const L: Record<string, {
  subject: (region: string) => string;
  headline: (region: string) => string;
  intro: string;
  col_disease: string; col_country: string; col_risk: string;
  cta: string;
  footer: string;
}> = {
  fr: {
    subject:   (r) => `Signaux épidémiques — ${r} · Semaine en cours`,
    headline:  (r) => `Foyers actifs — ${r}`,
    intro:     "Voici les foyers actifs dans votre région de surveillance cette semaine, agrégés depuis OMS, ECDC, OPAS et Africa CDC.",
    col_disease: "Maladie", col_country: "Pays", col_risk: "Risque",
    cta:       "Voir le tableau de bord →",
    footer:    "HealthWatch Global · Surveillance épidémique temps réel",
  },
  en: {
    subject:   (r) => `Outbreak signals — ${r} · This week`,
    headline:  (r) => `Active outbreaks — ${r}`,
    intro:     "Here are the active outbreaks in your monitored region this week, aggregated from WHO, ECDC, PAHO & Africa CDC.",
    col_disease: "Disease", col_country: "Country", col_risk: "Risk",
    cta:       "View dashboard →",
    footer:    "HealthWatch Global · Real-time epidemic surveillance",
  },
  es: {
    subject:   (r) => `Señales de brotes — ${r} · Esta semana`,
    headline:  (r) => `Brotes activos — ${r}`,
    intro:     "Estos son los brotes activos en su región de vigilancia esta semana, agregados desde OMS, ECDC, PAHO y Africa CDC.",
    col_disease: "Enfermedad", col_country: "País", col_risk: "Riesgo",
    cta:       "Ver el panel →",
    footer:    "HealthWatch Global · Vigilancia epidémica en tiempo real",
  },
  ar: {
    subject:   (r) => `إشارات التفشي — ${r} · هذا الأسبوع`,
    headline:  (r) => `التفشيات النشطة — ${r}`,
    intro:     "فيما يلي التفشيات النشطة في منطقة مراقبتكم هذا الأسبوع، مجمّعة من WHO وECDC وPAHO وAfrica CDC.",
    col_disease: "المرض", col_country: "الدولة", col_risk: "الخطر",
    cta:       "← عرض لوحة القيادة",
    footer:    "HealthWatch Global · مراقبة وبائية في الوقت الفعلي",
  },
  id: {
    subject:   (r) => `Sinyal wabah — ${r} · Minggu ini`,
    headline:  (r) => `Wabah aktif — ${r}`,
    intro:     "Berikut wabah aktif di wilayah pemantauan Anda minggu ini, diagregasi dari WHO, ECDC, PAHO & Africa CDC.",
    col_disease: "Penyakit", col_country: "Negara", col_risk: "Risiko",
    cta:       "Lihat dasbor →",
    footer:    "HealthWatch Global · Pemantauan epidemi real-time",
  },
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(
  outbreaks: Array<{ disease: string; country: string; risk_level: string; disease_en?: string | null; disease_ar?: string | null; country_en?: string | null; country_ar?: string | null }>,
  locale: string,
  region: string,
  dashUrl: string,
): string {
  const l        = L[locale]       ?? L.en;
  const rl       = REGION_LABELS[locale] ?? REGION_LABELS.en;
  const riskL    = RISK_LABELS[locale]   ?? RISK_LABELS.en;
  const regionLabel = rl[region] ?? region;
  const isRtl    = locale === "ar";
  const dir      = isRtl ? "rtl" : "ltr";

  const rows = outbreaks.map((o) => {
    const color = RISK_COLORS[o.risk_level] ?? "#6b7280";
    const label = riskL[o.risk_level]       ?? o.risk_level.toUpperCase();
    const diseaseName = getLocalizedDisease({ disease: o.disease, disease_en: o.disease_en ?? null, disease_ar: o.disease_ar ?? null }, locale);
    const countryName = getLocalizedCountry({ country: o.country, country_en: o.country_en ?? null, country_ar: o.country_ar ?? null }, locale);
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:14px;color:#e5e7eb;">${esc(diseaseName)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:14px;color:#9ca3af;">${esc(countryName)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:12px;color:${color};font-weight:700;text-align:${isRtl ? "left" : "right"};">${label}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;" dir="${dir}">

  <div style="margin-bottom:24px;">
    <span style="color:#ef4444;font-weight:900;font-size:18px;">●</span>
    <span style="color:#fff;font-weight:700;font-size:15px;margin-${isRtl ? "right" : "left"}:8px;">HealthWatch Global</span>
  </div>

  <h1 style="color:#fff;font-size:19px;font-weight:700;margin:0 0 6px;">${l.headline(regionLabel)}</h1>
  <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">WHO · ECDC · PAHO · Africa CDC</p>
  <p style="color:#9ca3af;font-size:13px;margin:0 0 24px;line-height:1.5;">${l.intro}</p>

  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:${isRtl ? "right" : "left"};font-size:10px;color:#4b5563;padding-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">${l.col_disease}</th>
        <th style="text-align:${isRtl ? "right" : "left"};font-size:10px;color:#4b5563;padding-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">${l.col_country}</th>
        <th style="text-align:${isRtl ? "left" : "right"};font-size:10px;color:#4b5563;padding-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">${l.col_risk}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="margin-top:28px;text-align:center;">
    <a href="${dashUrl}"
       style="display:inline-block;background:#dc2626;color:#fff;font-weight:600;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      ${l.cta}
    </a>
  </div>

  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1e293b;">
    <p style="color:#374151;font-size:11px;text-align:center;margin:0;">${l.footer}</p>
  </div>

</div>
</body>
</html>`;
}

// ─── Email sender ─────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_KEY) throw new Error("BREVO_API_KEY not set");
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
  if (!res.ok) throw new Error(`Brevo: ${await res.text()}`);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  try {
    return await runPilotFollowUp(req, supabase);
  } catch (err) {
    console.error("[pilot-follow-up] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "pilot-follow-up" } });
    await logCronRun(supabase, "pilot-follow-up", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runPilotFollowUp(_req: NextRequest, supabase: SupabaseClient) {
  // ── 1. Find Pro users activated 7.5–8.5 days ago ─────────────────────────
  const now        = Date.now();
  const windowStart = new Date(now - 8.5 * 86_400_000).toISOString();
  const windowEnd   = new Date(now - 7.5 * 86_400_000).toISOString();

  const queryPilots = () =>
    createClient(SUPABASE_URL, SUPABASE_SERVICE)
      .from("profiles")
      .select("id, email, locale, display_filters, trial_ends_at, stripe_subscription_id")
      .in("plan", ["pro", "starter", "team"])
      .not("email", "is", null)
      .is("email_blocked_at", null)
      .gte("created_at", windowStart)
      .lt("created_at",  windowEnd);

  // Retries with a fresh client per attempt (up to 3) — absorbs transient
  // fetch/socket errors against Supabase ("TypeError: terminated" from a
  // stale keep-alive connection reused across serverless invocations). A
  // single retry reusing the same client could land on the same dead socket
  // — same fix as lib/outbreaks.ts queryWithRetry() (2026-07-24).
  let { data: pilots, error: pErr } = await queryPilots();
  if (pErr) ({ data: pilots, error: pErr } = await queryPilots());
  if (pErr) ({ data: pilots, error: pErr } = await queryPilots());

  if (pErr) {
    console.error("[pilot-follow-up] profiles query error:", pErr);
    Sentry.captureException(new Error(`[pilot-follow-up] profiles query failed: ${pErr.message}`), {
      tags: { cron: "pilot-follow-up" },
    });
    // This is a `return`, not a `throw` — GET()'s try/catch wrapper never sees
    // it, so a genuine query failure was as silent to cron-monitor as a missed
    // tick. Found 2026-07-18, same class of gap as sync-spf (2026-07-17).
    await logCronRun(supabase, "pilot-follow-up", "error", 0, pErr.message);
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  if (!pilots || pilots.length === 0) {
    await logCronRun(supabase, "pilot-follow-up", "ok", 0);
    return NextResponse.json({ sent: 0, skipped: 0, reason: "no pilots in window" });
  }

  // ── 2. For each pilot, get their region and query outbreaks ───────────────
  let sent       = 0;
  let skipped    = 0;
  let failed     = 0;
  let alreadySent = 0;

  const hasOptedOut = (u: { display_filters: unknown }) =>
    !!(u.display_filters as Record<string, unknown> | null)?.no_weekly_signal;

  for (const pilot of pilots) {
    if (!pilot.email || hasOptedOut(pilot)) { skipped++; continue; }

    // Skip expired trials with no Stripe sub
    if (pilot.trial_ends_at && new Date(pilot.trial_ends_at).getTime() < now && !pilot.stripe_subscription_id) {
      skipped++;
      continue;
    }

    // One-shot lifecycle email (fires once ever, around day 8) -- claim
    // before send via the same lifecycle_email_log used by
    // onboarding-sequence/trial-reminders/winback-sequence, rather than
    // relying solely on the ~24h created_at window above. Found 2026-08-04:
    // this route had no dedup at all, so a manual re-invocation (or a
    // genuine duplicate Vercel Cron trigger, still inside the same window)
    // resent the same email to every pilot in range.
    const claimed = await claimEmailSend(supabase, pilot.id, "pilot-follow-up", "day8");
    if (!claimed) { alreadySent++; continue; }

    const locale = (pilot.locale as string) ?? "en";
    const filters = pilot.display_filters as { region?: string } | null;
    const region  = (filters?.region && filters.region !== "all") ? filters.region : null;

    // Build outbreak query — filter by region if set, else global
    let query = supabase
      .from("outbreaks")
      .select("disease, disease_en, disease_ar, country, country_en, country_ar, risk_level")
      .eq("active", true)
      .in("risk_level", ["high", "medium"])
      .order("risk_level", { ascending: true }) // high before medium
      .order("cases",      { ascending: false })
      .limit(5);

    if (region) {
      query = query.eq("region", region);
    }

    const { data: outbreaks, error: oErr } = await query;

    // A genuine query error was indistinguishable from "no outbreaks in this
    // region right now" — both just incremented skipped with no report at
    // all, not even to failed. Same shape as weekly-signal's outErr/userErr
    // conflation (fixed 2026-07-30).
    if (oErr) {
      console.error(`[pilot-follow-up] outbreaks query failed for ${pilot.email}:`, oErr.message);
      Sentry.captureException(oErr, { tags: { cron: "pilot-follow-up", user_id: pilot.id } });
      failed++;
      continue;
    }
    if (!outbreaks || outbreaks.length === 0) {
      // No outbreaks to report — skip this user rather than send an empty email
      skipped++;
      continue;
    }

    // Build dashboard URL with region pre-applied
    const regionParam = region ? `?region=${region}` : "";
    const dashUrl     = `${APP_URL}/${locale}${regionParam}`;

    const l          = L[locale] ?? L.en;
    const rl         = REGION_LABELS[locale] ?? REGION_LABELS.en;
    const regionLabel = region ? (rl[region] ?? region) : (rl.all ?? "Global");

    const subject = l.subject(regionLabel);
    const html    = buildHtml(outbreaks, locale, region ?? "all", dashUrl);

    try {
      if (isRealProduction) {
        await sendEmail(pilot.email, subject, html);
      }
      sent++;
      console.log(`[pilot-follow-up] sent to ${pilot.email} (region: ${region ?? "all"})`);
    } catch (err) {
      console.error(`[pilot-follow-up] failed for ${pilot.email}:`, err);
      Sentry.captureException(err, { tags: { cron: "pilot-follow-up", user_id: pilot.id } });
      failed++;
    }

    // Throttle
    await new Promise((r) => setTimeout(r, 150));
  }

  // Was hardcoded "ok" — `failed` was tracked per-user but never consulted,
  // so a genuine send (or now query) failure still logged "ok". Same bug
  // fixed across ~15 other crons today (sync-outbreaks et al., 2026-07-29/30).
  await logCronRun(supabase, "pilot-follow-up", failed > 0 ? "error" : "ok", sent,
    failed > 0 ? `${failed} email(s)/requête(s) en échec` : undefined);
  return NextResponse.json({ sent, skipped, failed, alreadySent, total: pilots.length });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BREVO_API_KEY    = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const SUBJECTS: Record<string, string> = {
  fr: "Signaux épidémiques de la semaine — HealthWatch Global",
  es: "Señales epidémicas de la semana — HealthWatch Global",
  ar: "إشارات الأوبئة هذا الأسبوع — HealthWatch Global",
  id: "Sinyal epidemi minggu ini — HealthWatch Global",
  en: "This week's outbreak signals — HealthWatch Global",
};

const L: Record<string, {
  headline: string; col1: string; col2: string; col3: string; col4: string;
  riskHigh: string;
  upgradeTitle: string; upgradeDesc: string; upgradeCta: string;
  cta: string; unsub: string;
}> = {
  fr: {
    headline: "Signaux HIGH actifs cette semaine", col1: "Maladie", col2: "Pays", col3: "Cas", col4: "Risque", riskHigh: "ÉLEVÉ",
    upgradeTitle: "Décès et létalité masqués dans votre tableau de bord",
    upgradeDesc: "Votre plan gratuit cache le nombre de décès et le taux de létalité (CFR) pour chaque foyer. Ces données sont disponibles avec Pro.",
    upgradeCta: "Débloquer Pro — 14 jours gratuits →",
    cta: "Voir tous les foyers →", unsub: "Se désabonner",
  },
  es: {
    headline: "Señales HIGH activas esta semana", col1: "Enfermedad", col2: "País", col3: "Casos", col4: "Riesgo", riskHigh: "ALTO",
    upgradeTitle: "Fallecidos y letalidad ocultos en su panel",
    upgradeDesc: "Su plan gratuito oculta el número de fallecidos y la tasa de letalidad (CFR) para cada brote. Datos disponibles con Pro.",
    upgradeCta: "Desbloquear Pro — 14 días gratis →",
    cta: "Ver todos los brotes →", unsub: "Darse de baja",
  },
  ar: {
    headline: "إشارات HIGH النشطة هذا الأسبوع", col1: "المرض", col2: "الدولة", col3: "الحالات", col4: "الخطر", riskHigh: "مرتفع",
    upgradeTitle: "الوفيات ومعدل الفتك مخفيان في لوحتك",
    upgradeDesc: "تخفي خطتك المجانية عدد الوفيات ومعدل الفتك (CFR) لكل تفشٍّ. هذه البيانات متاحة مع Pro.",
    upgradeCta: "← فتح Pro — 14 يوماً مجاناً",
    cta: "← عرض جميع التفشيات", unsub: "إلغاء الاشتراك",
  },
  id: {
    headline: "Sinyal HIGH aktif minggu ini", col1: "Penyakit", col2: "Negara", col3: "Kasus", col4: "Risiko", riskHigh: "TINGGI",
    upgradeTitle: "Kematian dan CFR tersembunyi di dasbor Anda",
    upgradeDesc: "Paket gratis Anda menyembunyikan jumlah kematian dan tingkat fatalitas (CFR) untuk setiap wabah. Data tersedia dengan Pro.",
    upgradeCta: "Buka Pro — 14 hari gratis →",
    cta: "Lihat semua wabah →", unsub: "Berhenti berlangganan",
  },
  en: {
    headline: "Active HIGH-risk signals this week", col1: "Disease", col2: "Country", col3: "Cases", col4: "Risk", riskHigh: "HIGH",
    upgradeTitle: "Deaths and fatality rate hidden in your dashboard",
    upgradeDesc: "Your free plan hides the death count and case fatality rate (CFR) for every outbreak. These figures are available with Pro.",
    upgradeCta: "Unlock Pro — 14-day free trial →",
    cta: "View all outbreaks →", unsub: "Unsubscribe",
  },
};

function buildHtml(
  outbreaks: Array<{ disease: string; disease_en: string | null; disease_ar: string | null; country: string; country_en: string | null; country_ar: string | null; cases: number }>,
  locale: string,
  dashUrl: string,
  unsubUrl: string,
  pricingUrl: string,
): string {
  const l = L[locale] ?? L.en;
  const numLocale = locale === "ar" ? "ar-SA" : locale;
  const rows = outbreaks
    .map((o) => {
      const disease = getLocalizedDisease({ disease: o.disease, disease_en: o.disease_en ?? null, disease_ar: o.disease_ar ?? null }, locale);
      const country = getLocalizedCountry({ country: o.country, country_en: o.country_en ?? null, country_ar: o.country_ar ?? null }, locale);
      const casesStr = o.cases > 0 ? o.cases.toLocaleString(numLocale) : "—";
      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:14px;color:#e5e7eb;">${esc(disease)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:14px;color:#9ca3af;">${esc(country)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:13px;color:#e5e7eb;text-align:right;">${casesStr}</td>
        <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:13px;color:#f87171;text-align:right;font-weight:600;">${esc(l.riskHigh)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">
  <div style="margin-bottom:28px;">
    <span style="color:#ef4444;font-weight:900;font-size:18px;">●</span>
    <span style="color:#fff;font-weight:700;font-size:15px;margin-left:8px;">HealthWatch Global</span>
  </div>
  <h1 style="color:#fff;font-size:19px;font-weight:700;margin:0 0 6px;">${l.headline}</h1>
  <p style="color:#6b7280;font-size:12px;margin:0 0 24px;">WHO · ECDC · PAHO · Africa CDC</p>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;font-size:10px;color:#4b5563;padding-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">${l.col1}</th>
        <th style="text-align:left;font-size:10px;color:#4b5563;padding-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">${l.col2}</th>
        <th style="text-align:right;font-size:10px;color:#4b5563;padding-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">${l.col3}</th>
        <th style="text-align:right;font-size:10px;color:#4b5563;padding-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">${l.col4}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- Upgrade prompt -->
  <div style="margin-top:24px;background:#1e293b;border:1px solid #dc262633;border-radius:10px;padding:16px 20px;">
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#fca5a5;">${l.upgradeTitle}</p>
    <p style="margin:0 0 14px;font-size:13px;color:#94a3b8;line-height:1.6;">${l.upgradeDesc}</p>
    <a href="${pricingUrl}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:600;font-size:13px;padding:10px 22px;border-radius:7px;text-decoration:none;">${l.upgradeCta}</a>
  </div>

  <div style="margin-top:20px;text-align:center;">
    <a href="${dashUrl}" style="color:#4b5563;font-size:12px;text-decoration:underline;">${l.cta}</a>
  </div>
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1e293b;">
    <p style="color:#374151;font-size:11px;text-align:center;margin:0;">
      HealthWatch Global &middot;
      <a href="${unsubUrl}" style="color:#4b5563;">${l.unsub}</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

// Returns whether the email was actually sent (see weekly-digest for the
// same fix — sent++ used to run unconditionally even when the key was missing).
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.warn("[weekly-signal] BREVO_API_KEY not set — skipping");
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo: ${await res.text()}`);
  return true;
}

export async function GET(req: NextRequest) {
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Top HIGH active outbreaks (max 3, ordered by cases desc)
  const { data: outbreaks, error: outErr } = await supabase
    .from("outbreaks")
    .select("disease, disease_en, disease_ar, country, country_en, country_ar, cases")
    .eq("risk_level", "high")
    .eq("active", true)
    .order("cases", { ascending: false })
    .limit(3);

  if (outErr || !outbreaks?.length) {
    await logCronRun(supabase, "weekly-signal", "ok", 0);
    return NextResponse.json({ skipped: "no HIGH outbreaks" });
  }

  // Free users with email, registered more than 24h ago, who haven't opted out
  const { data: users, error: userErr } = await supabase
    .from("profiles")
    .select("id, email, locale, display_filters")
    .eq("plan", "free")
    .not("email", "is", null)
    .lt("created_at", new Date(Date.now() - 86_400_000).toISOString());

  if (userErr || !users?.length) {
    await logCronRun(supabase, "weekly-signal", "ok", 0);
    return NextResponse.json({ skipped: "no free users" });
  }

  let sent         = 0;
  let failed       = 0;
  let skippedNoKey = 0;

  for (const user of users) {
    if (!user.email) continue;
    const filters = user.display_filters as Record<string, unknown> | null;
    if (filters?.no_weekly_signal) continue;

    const locale = user.locale ?? "en";
    const unsubUrl = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(user.id)}&locale=${locale}`;
    const html = buildHtml(
      outbreaks,
      locale,
      `https://healthwatch-global.com/${locale}`,
      unsubUrl,
      `https://healthwatch-global.com/${locale}/pricing`,
    );
    try {
      if (isRealProduction) {
        const ok = await sendEmail(user.email, SUBJECTS[locale] ?? SUBJECTS.en, html);
        if (ok) sent++; else skippedNoKey++;
      } else {
        sent++;
      }
    } catch (e) {
      console.error(`[weekly-signal] ${user.email}:`, e);
      Sentry.captureException(e, { tags: { cron: "weekly-signal", user_id: user.id } });
      failed++;
    }
  }

  await logCronRun(supabase, "weekly-signal", skippedNoKey > 0 ? "error" : "ok", sent);
  return NextResponse.json({ sent, failed, skippedNoKey, outbreaks: outbreaks.length });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction, claimEmailSend, claimWeeklyEmailAddress, releaseEmailSend, releaseWeeklyEmailAddress, currentWeekOf } from "@/lib/cron-monitor";
import { getWeeklySuppressionSet } from "@/lib/mail-suppression";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { sendBrevoEmail } from "@/lib/brevo-send";

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
async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl?: string): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.warn("[weekly-signal] BREVO_API_KEY not set — skipping");
    return false;
  }
  await sendBrevoEmail({ to, subject, html, apiKey: BREVO_API_KEY, unsubscribeUrl });
  return true;
}

// Les deux verrous de cette route sont poses avant l'envoi ; ils doivent etre
// rendus ensemble des que l'envoi n'a pas lieu. Regroupes ici pour qu'aucun
// des deux chemins d'echec n'en oublie un.
async function releaseClaims(supabase: SupabaseClient, userId: string, email: string, weekOf: string) {
  await releaseWeeklyEmailAddress(supabase, email, weekOf, "weekly-signal");
  await releaseEmailSend(supabase, userId, "weekly-signal", weekOf);
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

  // Defensive wrapper: an uncaught exception anywhere before or between the
  // fetches/loop below (only the per-user send has a local try/catch) used to
  // propagate straight out — bare 500, no Sentry event, logCronRun never
  // reached. Same root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runWeeklySignal(req, supabase);
  } catch (err) {
    console.error("[weekly-signal] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "weekly-signal" } });
    await logCronRun(supabase, "weekly-signal", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runWeeklySignal(_req: NextRequest, supabase: SupabaseClient) {
  // Top HIGH active outbreaks (max 3, ordered by cases desc)
  const { data: outbreaks, error: outErr } = await supabase
    .from("outbreaks")
    .select("disease, disease_en, disease_ar, country, country_en, country_ar, cases")
    .eq("risk_level", "high")
    .eq("active", true)
    .order("cases", { ascending: false })
    .limit(3);

  // outErr and "legitimately 0 HIGH outbreaks this week" used to both log "ok"
  // — a real query error was indistinguishable from nothing-to-send.
  if (outErr) {
    console.error("[weekly-signal] outbreaks query:", outErr.message);
    Sentry.captureException(outErr, { tags: { cron: "weekly-signal" } });
    await logCronRun(supabase, "weekly-signal", "error", 0, outErr.message);
    return NextResponse.json({ error: outErr.message }, { status: 500 });
  }
  if (!outbreaks?.length) {
    await logCronRun(supabase, "weekly-signal", "ok", 0);
    return NextResponse.json({ skipped: "no HIGH outbreaks" });
  }

  // Free users with email, registered more than 24h ago, who haven't opted out
  const { data: users, error: userErr } = await supabase
    .from("profiles")
    .select("id, email, locale, display_filters")
    .eq("plan", "free")
    .not("email", "is", null)
    .is("email_blocked_at", null)
    .lt("created_at", new Date(Date.now() - 86_400_000).toISOString());

  if (userErr) {
    console.error("[weekly-signal] profiles query:", userErr.message);
    Sentry.captureException(userErr, { tags: { cron: "weekly-signal" } });
    await logCronRun(supabase, "weekly-signal", "error", 0, userErr.message);
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }
  if (!users?.length) {
    await logCronRun(supabase, "weekly-signal", "ok", 0);
    return NextResponse.json({ skipped: "no free users" });
  }

  let sent         = 0;
  let failed       = 0;
  let skippedNoKey = 0;
  let alreadySent  = 0;
  let crossSentSkipped = 0;
  let suppressed   = 0;

  // Meme source de suppression que les trois autres mailers du lundi. Le test
  // local qui existait ici ne regardait que display_filters.no_weekly_signal,
  // alors qu'un lecteur qui s'est desabonne depuis un email d'onboarding porte
  // no_onboarding_emails — deux drapeaux ecrits par deux routes de
  // desabonnement differentes, pour un seul geste de la part du lecteur.
  // Retabli le 2026-08-24 : perdu dans la fusion du 23 au soir, comme dans
  // weekly-digest.
  const { emails: suppressionSet, degraded: suppressionDegraded } =
    await getWeeklySuppressionSet(supabase);

  // Real profiles rows (unlike weekly-digest's standalone subscriptions), so
  // this reuses lifecycle_email_log/claimEmailSend directly, keyed on the
  // ISO week rather than a fixed one-shot step: this digest is meant to
  // repeat every week, not fire once ever. Found 2026-08-04: this route sent
  // unconditionally on every invocation, so a manual re-invocation resent
  // the same week's signal to every free user.
  const weekOf = currentWeekOf();

  for (const user of users) {
    if (!user.email) continue;
    if (suppressionSet.has(user.email.trim().toLowerCase())) { suppressed++; continue; }

    // Claim before send: a second invocation racing this one must see the
    // claim already taken, not an empty log it can still win.
    const claimed = await claimEmailSend(supabase, user.id, "weekly-signal", weekOf);
    if (!claimed) { alreadySent++; continue; }
    // Cross-cron: this address may also be a weekly-digest subscriber, which
    // runs first in vercel.json and normally wins the claim for the week —
    // see claimWeeklyEmailAddress's doc in lib/cron-monitor.ts.
    const emailClaimed = await claimWeeklyEmailAddress(supabase, user.email, weekOf, "weekly-signal");
    if (!emailClaimed) { crossSentSkipped++; continue; }

    const locale = user.locale ?? "en";
    const unsubUrl = `https://healthwatch-global.com/api/unsubscribe-signal?id=${encodeURIComponent(user.id)}&token=${signUnsubscribeToken(user.id)}&locale=${locale}`;
    const html = buildHtml(
      outbreaks,
      locale,
      `https://healthwatch-global.com/${locale}`,
      unsubUrl,
      `https://healthwatch-global.com/${locale}/pricing`,
    );
    try {
      if (isRealProduction) {
        const ok = await sendEmail(user.email, SUBJECTS[locale] ?? SUBJECTS.en, html, unsubUrl);
        if (ok) sent++;
        // Rien n'est parti : on rend les deux verrous poses juste au-dessus,
        // sinon la semaine de ce lecteur est consommee pour un email qu'il
        // n'a jamais recu. Voir releaseWeeklyEmailAddress dans
        // lib/cron-monitor.ts.
        else { skippedNoKey++; await releaseClaims(supabase, user.id, user.email, weekOf); }
      } else {
        sent++;
      }
    } catch (e) {
      console.error(`[weekly-signal] ${user.email}:`, e);
      Sentry.captureException(e, { tags: { cron: "weekly-signal", user_id: user.id } });
      failed++;
      await releaseClaims(supabase, user.id, user.email, weekOf);
    }
  }

  // Was only checking skippedNoKey — `failed`, incremented per-user in the
  // catch above, was tracked but never consulted here.
  const degradedNote = [
    suppressionDegraded ? "liste de suppression incomplète (une source en échec)" : null,
    failed > 0 ? `${failed} envoi(s) en échec` : null,
  ].filter(Boolean).join(" · ");
  await logCronRun(supabase, "weekly-signal",
    skippedNoKey > 0 || failed > 0 || suppressionDegraded ? "error" : "ok", sent,
    degradedNote || undefined);
  // Cette route ne loggait aucun resume — d'ou l'impossibilite de lire son
  // resultat dans les logs Vercel du 2026-08-24, alors que weekly-digest, lui,
  // se laissait lire.
  console.log(`[weekly-signal] Done, ${sent} sent, ${failed} failed, ${skippedNoKey} skipped (no key), ${suppressed} suppressed, ${alreadySent} already sent this week, ${crossSentSkipped} claimed by an earlier Monday mailer, ${users.length} total.`);
  return NextResponse.json({ sent, failed, skippedNoKey, suppressed, alreadySent, crossSentSkipped, outbreaks: outbreaks.length });
}

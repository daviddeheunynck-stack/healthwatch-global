import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^﻿/, "").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/^﻿/, "").trim();
const CRON_SECRET  = (process.env.CRON_SECRET ?? "").replace(/^﻿/, "").trim();
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL ?? "https://healthwatch-global.com").replace(/^﻿/, "").trim();
const BREVO_KEY    = (process.env.BREVO_API_KEY ?? "").replace(/^﻿/, "").trim();

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

type LocaleCopy = {
  subject:  (d: string, c: string) => string;
  intro:    (d: string, c: string) => string;
  title:    string;
  cases:    string;
  reported: string;
  risk:     string;
  view:     string;
  footer:   string;
};

const LOCALE_COPY: Record<string, LocaleCopy> = {
  fr: {
    subject:  (d, c) => `[HealthWatch] Déclaration PHEIC : ${d} — ${c}`,
    intro:    (d, c) => `L'OMS a déclaré une Urgence de Santé Publique de Portée Internationale (PHEIC) pour <strong>${d}</strong> en <strong>${c}</strong>.`,
    title:    "HealthWatch Global — Déclaration PHEIC",
    cases:    "Cas :",
    reported: "Signalé le :",
    risk:     "Risque :",
    view:     "Voir le tableau de bord →",
    footer:   "HealthWatch Global · Gérez vos préférences d'alertes dans le tableau de bord.",
  },
  es: {
    subject:  (d, c) => `[HealthWatch] Declaración PHEIC: ${d} — ${c}`,
    intro:    (d, c) => `La OMS ha declarado una Emergencia de Salud Pública de Importancia Internacional (PHEIC) por <strong>${d}</strong> en <strong>${c}</strong>.`,
    title:    "HealthWatch Global — Declaración PHEIC",
    cases:    "Casos:",
    reported: "Reportado:",
    risk:     "Riesgo:",
    view:     "Ver panel →",
    footer:   "HealthWatch Global · Gestione sus preferencias de alertas en el panel.",
  },
  ar: {
    subject:  (d, c) => `[HealthWatch] إعلان PHEIC: ${d} — ${c}`,
    intro:    (d, c) => `أعلنت منظمة الصحة العالمية حالة طوارئ صحية عامة دولية (PHEIC) بشأن <strong>${d}</strong> في <strong>${c}</strong>.`,
    title:    "HealthWatch Global — إعلان PHEIC",
    cases:    "الحالات:",
    reported: "تاريخ الإبلاغ:",
    risk:     "مستوى الخطر:",
    view:     "عرض لوحة المعلومات ←",
    footer:   "HealthWatch Global · أدر تفضيلات التنبيهات من لوحة المعلومات.",
  },
  id: {
    subject:  (d, c) => `[HealthWatch] Deklarasi PHEIC: ${d} — ${c}`,
    intro:    (d, c) => `WHO telah menyatakan Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC) untuk <strong>${d}</strong> di <strong>${c}</strong>.`,
    title:    "HealthWatch Global — Deklarasi PHEIC",
    cases:    "Kasus:",
    reported: "Dilaporkan:",
    risk:     "Risiko:",
    view:     "Lihat dasbor →",
    footer:   "HealthWatch Global · Kelola preferensi peringatan di dasbor Anda.",
  },
  en: {
    subject:  (d, c) => `[HealthWatch] PHEIC Declaration: ${d} — ${c}`,
    intro:    (d, c) => `WHO has declared a Public Health Emergency of International Concern (PHEIC) for <strong>${d}</strong> in <strong>${c}</strong>.`,
    title:    "HealthWatch Global — PHEIC Declaration",
    cases:    "Cases:",
    reported: "Reported:",
    risk:     "Risk:",
    view:     "View dashboard →",
    footer:   "HealthWatch Global · Manage alert preferences in your dashboard.",
  },
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  if (!BREVO_KEY) return new Response(JSON.stringify({ ok: true, skipped: "BREVO_API_KEY not configured" }), { status: 200 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Active PHEIC outbreaks
  const { data: pheicOutbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, cases, deaths, risk_level, date")
    .eq("active", true)
    .eq("is_pheic", true);

  if (!pheicOutbreaks?.length) {
    await logCronRun(supabase, "trigger-pheic-alerts", "ok", 0);
    return Response.json({ fired: 0 });
  }

  // 2. Pro users who want PHEIC alerts
  const { data: proUsers } = await supabase
    .from("profiles")
    .select("id, email, alert_locale")
    .in("plan", ["pro", "team", "enterprise"])
    .eq("pheic_alerts", true)
    .not("email", "is", null);

  if (!proUsers?.length) {
    await logCronRun(supabase, "trigger-pheic-alerts", "ok", 0);
    return Response.json({ fired: 0 });
  }

  // 3. Already-notified (type=pheic) per outbreak
  const outbreakIds = pheicOutbreaks.map((o) => o.id);
  const { data: existing } = await supabase
    .from("alert_notifications")
    .select("user_id, outbreak_id")
    .eq("type", "pheic")
    .in("outbreak_id", outbreakIds);

  const notifiedSet = new Set((existing ?? []).map((n) => `${n.user_id}::${n.outbreak_id}`));

  // Group by disease — one email per PHEIC event listing all affected countries.
  // Without grouping, each country row (DRC, Uganda, France…) triggers a separate
  // email for the same PHEIC declaration, spamming users.
  const diseaseMap = new Map<string, typeof pheicOutbreaks>();
  for (const o of pheicOutbreaks) {
    const key = (o.disease_en ?? "unknown").toLowerCase();
    if (!diseaseMap.has(key)) diseaseMap.set(key, []);
    diseaseMap.get(key)!.push(o);
  }

  let fired = 0;

  for (const [, outbreaks] of diseaseMap) {
    // Primary row = largest case count (main source country)
    const primary  = outbreaks.reduce((a, b) => (a.cases ?? 0) >= (b.cases ?? 0) ? a : b);
    const totalCases  = outbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);
    const totalDeaths = outbreaks.reduce((s, o) => s + (o.deaths ?? 0), 0);
    const cfr =
      totalCases > 0 && totalDeaths > 0
        ? `CFR ${(totalDeaths / totalCases * 100).toFixed(1)}%`
        : "";

    // Most recent date and highest risk across all outbreaks in the group
    const latestDate  = outbreaks.reduce((best, o) => (!best || (o.date ?? "") > best ? o.date ?? best : best), primary.date);
    const riskPriority: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 4 };
    const topRisk = outbreaks.reduce(
      (best, o) => (riskPriority[o.risk_level ?? ""] ?? 0) > (riskPriority[best] ?? 0) ? (o.risk_level ?? best) : best,
      primary.risk_level ?? "high",
    );

    for (const user of proUsers as Array<{ id: string; email: string; alert_locale?: string | null }>) {
      // Dedup: skip if user was already notified for ANY outbreak in this disease group.
      // This covers both old per-country records (e.g. user::uganda_id, user::france_id)
      // AND new grouped records (user::primary_id) inserted after this fix.
      const alreadyNotified = outbreaks.some((o) => notifiedSet.has(`${user.id}::${o.id}`));
      if (alreadyNotified) continue;

      const locale    = user.alert_locale ?? "en";
      const numLocale = locale === "ar" ? "ar-SA" : locale;
      const isRtl     = locale === "ar";
      const sep       = locale === "ar" ? "، " : ", ";
      const lc      = LOCALE_COPY[locale] ?? LOCALE_COPY.en;
      const disease  = getLocalizedDisease(primary, locale);
      const countries = outbreaks.map((o) => getLocalizedCountry(o, locale)).join(sep);
      const subject = lc.subject(disease, countries);
      const intro   = lc.intro(esc(disease), esc(countries));
      const dashUrl = `${APP_URL}/${locale}`;

      const html = `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
  <p style="color:#f87171;font-size:17px;font-weight:700;margin:0 0 4px">${lc.title}</p>
  <p style="font-size:12px;color:#64748b;margin:0 0 16px">${new Date().toISOString().split("T")[0]}</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="font-size:14px;margin:0 0 12px">${intro}</p>
  <ul style="font-size:13px;color:#cbd5e1;margin:0 0 16px;padding-left:20px">
    <li>${lc.cases} ${totalCases.toLocaleString(numLocale)}</li>
    ${cfr ? `<li>${cfr}</li>` : ""}
    <li>${lc.reported} ${latestDate}</li>
    <li>${lc.risk} <strong style="color:#f87171">${topRisk.toUpperCase()}</strong></li>
  </ul>
  <a href="${dashUrl}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    ${lc.view}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">${lc.footer}</p>
</div>`;

      try {
        const { error: insertErr } = await supabase.from("alert_notifications").insert({
          user_id:     user.id,
          type:        "pheic",
          title:       subject,
          body:        `${disease} · ${countries} · PHEIC`,
          outbreak_id: primary.id,
        });
        if (insertErr) {
          console.warn(`[trigger-pheic-alerts] Insert skipped for ${user.id}::${primary.id}: ${insertErr.message}`);
          continue;
        }

        await sendEmail(user.email, subject, html);
        // Add all outbreak ids for this disease group so the check above
        // catches them on the next cron run without a DB re-query.
        outbreaks.forEach((o) => notifiedSet.add(`${user.id}::${o.id}`));
        fired++;
      } catch (err) {
        console.error(`[trigger-pheic-alerts] Failed for user ${user.id} / outbreak ${primary.id}:`, err);
        Sentry.captureException(err, { tags: { cron: "trigger-pheic-alerts", user_id: user.id, outbreak_id: primary.id } });
      }
    }
  }

  await logCronRun(supabase, "trigger-pheic-alerts", "ok", fired);
  return Response.json({ fired });
}

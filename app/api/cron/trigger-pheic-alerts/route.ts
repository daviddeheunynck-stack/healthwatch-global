import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^﻿/, "").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/^﻿/, "").trim();
const CRON_SECRET  = (process.env.CRON_SECRET ?? "").replace(/^﻿/, "").trim();
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL ?? "https://healthwatch-global.com").replace(/^﻿/, "").trim();

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
    subject:  (d, c) => `[HealthWatch] 🚨 URGENCE PHEIC : ${d} — ${c}`,
    intro:    (d, c) => `L'OMS a déclaré une Urgence de Santé Publique de Portée Internationale (PHEIC) pour <strong>${d}</strong> en <strong>${c}</strong>.`,
    title:    "🚨 HealthWatch Global — Alerte PHEIC",
    cases:    "Cas :",
    reported: "Signalé le :",
    risk:     "Risque :",
    view:     "Voir le tableau de bord →",
    footer:   "HealthWatch Global · Gérez vos préférences d'alertes dans le tableau de bord.",
  },
  es: {
    subject:  (d, c) => `[HealthWatch] 🚨 EMERGENCIA PHEIC: ${d} — ${c}`,
    intro:    (d, c) => `La OMS ha declarado una Emergencia de Salud Pública de Importancia Internacional (PHEIC) por <strong>${d}</strong> en <strong>${c}</strong>.`,
    title:    "🚨 HealthWatch Global — Alerta PHEIC",
    cases:    "Casos:",
    reported: "Reportado:",
    risk:     "Riesgo:",
    view:     "Ver panel →",
    footer:   "HealthWatch Global · Gestione sus preferencias de alertas en el panel.",
  },
  ar: {
    subject:  (d, c) => `[HealthWatch] 🚨 طوارئ PHEIC: ${d} — ${c}`,
    intro:    (d, c) => `أعلنت منظمة الصحة العالمية حالة طوارئ صحية عامة دولية (PHEIC) بشأن <strong>${d}</strong> في <strong>${c}</strong>.`,
    title:    "🚨 HealthWatch Global — تنبيه PHEIC",
    cases:    "الحالات:",
    reported: "تاريخ الإبلاغ:",
    risk:     "مستوى الخطر:",
    view:     "عرض لوحة المعلومات ←",
    footer:   "HealthWatch Global · أدر تفضيلات التنبيهات من لوحة المعلومات.",
  },
  id: {
    subject:  (d, c) => `[HealthWatch] 🚨 DARURAT PHEIC: ${d} — ${c}`,
    intro:    (d, c) => `WHO telah menyatakan Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC) untuk <strong>${d}</strong> di <strong>${c}</strong>.`,
    title:    "🚨 HealthWatch Global — Peringatan PHEIC",
    cases:    "Kasus:",
    reported: "Dilaporkan:",
    risk:     "Risiko:",
    view:     "Lihat dasbor →",
    footer:   "HealthWatch Global · Kelola preferensi peringatan di dasbor Anda.",
  },
  en: {
    subject:  (d, c) => `[HealthWatch] 🚨 PHEIC ALERT: ${d} — ${c}`,
    intro:    (d, c) => `WHO has declared a Public Health Emergency of International Concern (PHEIC) for <strong>${d}</strong> in <strong>${c}</strong>.`,
    title:    "🚨 HealthWatch Global — PHEIC Alert",
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

  const resendKey = (process.env.RESEND_API_KEY ?? "").replace(/^﻿/, "").trim();
  if (!resendKey) return new Response(JSON.stringify({ ok: true, skipped: "RESEND_API_KEY not configured" }), { status: 200 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const resend   = new Resend(resendKey);

  // 1. Active PHEIC outbreaks
  const { data: pheicOutbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, risk_level, date")
    .eq("active", true)
    .eq("is_pheic", true);

  if (!pheicOutbreaks?.length) return Response.json({ fired: 0 });

  // 2. Pro users who want PHEIC alerts
  const { data: proUsers } = await supabase
    .from("profiles")
    .select("id, email, alert_locale")
    .in("plan", ["pro", "team", "enterprise"])
    .eq("pheic_alerts", true)
    .not("email", "is", null);

  if (!proUsers?.length) return Response.json({ fired: 0 });

  // 3. Already-notified (type=pheic) per outbreak
  const outbreakIds = pheicOutbreaks.map((o) => o.id);
  const { data: existing } = await supabase
    .from("alert_notifications")
    .select("user_id, outbreak_id")
    .eq("type", "pheic")
    .in("outbreak_id", outbreakIds);

  const notifiedSet = new Set((existing ?? []).map((n) => `${n.user_id}::${n.outbreak_id}`));

  let fired = 0;

  for (const outbreak of pheicOutbreaks) {
    const disease = outbreak.disease_en ?? "Unknown";
    const country = outbreak.country_en ?? "Unknown";
    const cfr =
      outbreak.cases > 0 && outbreak.deaths > 0
        ? `CFR ${(outbreak.deaths / outbreak.cases * 100).toFixed(1)}%`
        : "";

    for (const user of proUsers as Array<{ id: string; email: string; alert_locale?: string | null }>) {
      const key = `${user.id}::${outbreak.id}`;
      if (notifiedSet.has(key)) continue;

      const locale    = user.alert_locale ?? "en";
      const numLocale = locale === "ar" ? "ar-SA" : locale;
      const isRtl     = locale === "ar";
      const lc = LOCALE_COPY[locale] ?? LOCALE_COPY.en;
      const subject = lc.subject(disease, country);
      const intro   = lc.intro(esc(disease), esc(country));
      const dashUrl = `${APP_URL}/${locale}`;

      const html = `
<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;direction:${isRtl ? "rtl" : "ltr"};text-align:${isRtl ? "right" : "left"}">
  <p style="color:#f87171;font-size:17px;font-weight:700;margin:0 0 4px">${lc.title}</p>
  <p style="font-size:12px;color:#64748b;margin:0 0 16px">${new Date().toISOString().split("T")[0]}</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="font-size:14px;margin:0 0 12px">${intro}</p>
  <ul style="font-size:13px;color:#cbd5e1;margin:0 0 16px;padding-left:20px">
    <li>${lc.cases} ${outbreak.cases.toLocaleString(numLocale)}</li>
    ${cfr ? `<li>${cfr}</li>` : ""}
    <li>${lc.reported} ${outbreak.date}</li>
    <li>${lc.risk} <strong style="color:#f87171">HIGH${outbreak.risk_level === "high" ? "" : " — ".concat(outbreak.risk_level)}</strong></li>
  </ul>
  <a href="${dashUrl}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    ${lc.view}
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">${lc.footer}</p>
</div>`;

      try {
        await resend.emails.send({
          from:    "HealthWatch Global <alerts@healthwatch-global.com>",
          to:      user.email,
          subject,
          html,
        });

        void Promise.resolve(
          supabase.from("alert_notifications").insert({
            user_id:     user.id,
            type:        "pheic",
            title:       subject,
            body:        `${disease} · ${country} · PHEIC`,
            outbreak_id: outbreak.id,
          })
        ).catch(() => {});

        notifiedSet.add(key);
        fired++;
      } catch { /* email failure — skip */ }
    }
  }

  return Response.json({ fired });
}

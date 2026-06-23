import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COOLDOWN_H = 6;
const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

function riskMeetsThreshold(risk: string, minRisk: string): boolean {
  return (RISK_RANK[risk] ?? 0) >= (RISK_RANK[minRisk] ?? 0);
}

export async function GET(req: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? "").replace(/^﻿/, "").trim();
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`)
    return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const resendKey = (process.env.RESEND_API_KEY ?? "").replace(/^﻿/, "").trim();
  if (!resendKey) return Response.json({ ok: true, skipped: "RESEND_API_KEY not configured" });
  const resend = new Resend(resendKey);

  const { data: alerts } = await supabase
    .from("country_risk_alerts")
    .select("id, user_id, country_en, min_risk, email, last_fired_at");

  if (!alerts?.length) return Response.json({ fired: 0 });

  const alertUserIds = [...new Set(alerts.map((a) => a.user_id as string))];
  const { data: profileLocales } = await supabase
    .from("profiles").select("id, alert_locale").in("id", alertUserIds);
  const localeMap: Record<string, string> = Object.fromEntries(
    (profileLocales ?? []).map((p: { id: string; alert_locale?: string | null }) => [p.id, p.alert_locale ?? "en"])
  );

  const cooldownCutoff = new Date(Date.now() - COOLDOWN_H * 3_600_000).toISOString();
  let fired = 0;

  for (const alert of alerts) {
    if (alert.last_fired_at && alert.last_fired_at > cooldownCutoff) continue;

    const { data: outbreaks } = await supabase
      .from("outbreaks")
      .select("id, disease_en, country_en, risk_level, cases, deaths, is_pheic, date")
      .eq("active", true)
      .ilike("country_en", alert.country_en);

    const matches = (outbreaks ?? []).filter((o) =>
      riskMeetsThreshold(o.risk_level ?? "", alert.min_risk ?? "high")
    );
    if (!matches.length) continue;

    const locale = localeMap[alert.user_id] ?? "en";
    const top = matches[0];
    const pheic = top.is_pheic ? " [PHEIC]" : "";
    const cfr =
      top.cases > 0 && top.deaths > 0
        ? `CFR ${(top.deaths / top.cases * 100).toFixed(1)}%`
        : "";
    const level = (top.risk_level ?? "unknown").toUpperCase();

    const subject = `[HealthWatch] ${alert.country_en} — ${level}${pheic}: ${top.disease_en}`;

    const INTRO: Record<string, string> = {
      fr: `Un foyer à risque <strong>${level}</strong> a été détecté en <strong>${alert.country_en}</strong>.`,
      es: `Se ha detectado un brote de riesgo <strong>${level}</strong> en <strong>${alert.country_en}</strong>.`,
      ar: `تم رصد تفشٍّ ذو خطر <strong>${level}</strong> في <strong>${alert.country_en}</strong>.`,
      id: `Wabah berisiko <strong>${level}</strong> terdeteksi di <strong>${alert.country_en}</strong>.`,
      en: `A <strong>${level}</strong> risk outbreak has been detected in <strong>${alert.country_en}</strong>.`,
    };
    const LABELS: Record<string, [string, string, string, string, string]> = {
      fr: ["Maladie", "Cas", "🚨 PHEIC déclaré", "Signalé le", "Voir le tableau de bord →"],
      es: ["Enfermedad", "Casos", "🚨 PHEIC declarado", "Reportado", "Ver panel →"],
      ar: ["المرض", "الحالات", "🚨 إعلان PHEIC", "تاريخ الإبلاغ", "عرض لوحة المعلومات ←"],
      id: ["Penyakit", "Kasus", "🚨 PHEIC dideklarasikan", "Dilaporkan", "Lihat dasbor →"],
      en: ["Disease", "Cases", "🚨 PHEIC declared", "Reported", "View dashboard →"],
    };
    const lb = LABELS[locale] ?? LABELS.en;
    const intro = INTRO[locale] ?? INTRO.en;
    const dashUrl = `https://healthwatch-global.com/${locale}`;

    const html = `
<p>${intro}</p>
<ul>
  <li>${lb[0]}: ${top.disease_en}</li>
  <li>${lb[1]}: ${(top.cases ?? 0).toLocaleString(locale)}${cfr ? ` · ${cfr}` : ""}</li>
  ${top.is_pheic ? `<li>${lb[2]}</li>` : ""}
  <li>${lb[3]}: ${top.date}</li>
  ${matches.length > 1 ? `<li>+${matches.length - 1} other outbreak(s) in this country</li>` : ""}
</ul>
<p><a href="${dashUrl}">${lb[4]}</a></p>
<hr/>
<p style="color:#666;font-size:12px">HealthWatch Global · Manage alerts in your dashboard</p>`;

    try {
      await resend.emails.send({
        from: "HealthWatch Global <alerts@healthwatch-global.com>",
        to: alert.email,
        subject,
        html,
      });

      void Promise.resolve(
        supabase.from("alert_notifications").insert({
          user_id: alert.user_id,
          type: "country_risk",
          title: subject,
          body: `${top.disease_en} · ${alert.country_en} · ${(top.risk_level ?? "unknown").toUpperCase()}`,
        })
      ).catch(() => {});

      await supabase
        .from("country_risk_alerts")
        .update({ last_fired_at: new Date().toISOString() })
        .eq("id", alert.id);

      fired++;
    } catch {
      /* email failure — skip */
    }
  }

  return Response.json({ fired });
}

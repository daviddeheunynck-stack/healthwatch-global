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
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const { data: alerts } = await supabase
    .from("country_risk_alerts")
    .select("id, user_id, country_en, min_risk, email, last_fired_at");

  if (!alerts?.length) return Response.json({ fired: 0 });

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

    const top = matches[0];
    const pheic = top.is_pheic ? " [PHEIC]" : "";
    const cfr =
      top.cases > 0 && top.deaths > 0
        ? `CFR ${(top.deaths / top.cases * 100).toFixed(1)}%`
        : "";

    const subject = `[HealthWatch] ${alert.country_en} — ${(top.risk_level ?? "unknown").toUpperCase()}${pheic}: ${top.disease_en}`;
    const html = `
<p>A <strong>${(top.risk_level ?? "unknown").toUpperCase()}</strong> risk outbreak has been detected in <strong>${alert.country_en}</strong>.</p>
<ul>
  <li>Disease: ${top.disease_en}</li>
  <li>Cases: ${(top.cases ?? 0).toLocaleString("en")}${cfr ? ` · ${cfr}` : ""}</li>
  ${top.is_pheic ? "<li>🚨 PHEIC declared</li>" : ""}
  <li>Reported: ${top.date}</li>
  ${matches.length > 1 ? `<li>+${matches.length - 1} other outbreak(s) in this country</li>` : ""}
</ul>
<p><a href="https://healthwatch-global.com/en">View dashboard →</a></p>
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

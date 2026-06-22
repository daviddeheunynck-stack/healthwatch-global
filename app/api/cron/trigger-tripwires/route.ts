/**
 * GET /api/cron/trigger-tripwires
 *
 * For each active tripwire, checks whether the outbreak's current case count
 * has crossed the threshold since the last check. If so, sends a single email
 * via Resend and records the trigger. Re-triggers if cases drop below threshold
 * then rise again (detected via last_checked_cases).
 *
 * Runs every 30 minutes via Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET      = clean(process.env.CRON_SECRET);
const RESEND_KEY       = clean(process.env.RESEND_API_KEY);
const APP_URL          = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://healthwatch-global.com";

interface Tripwire {
  id: string;
  user_id: string;
  outbreak_id: string;
  threshold_cases: number;
  email: string;
  last_checked_cases: number;
}

interface Outbreak {
  id: string;
  disease_en: string | null;
  country_en: string | null;
  cases: number;
  risk_level: string;
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!RESEND_KEY) return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY not configured" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const resend   = new Resend(RESEND_KEY);

  const { data: tripwires } = await supabase
    .from("outbreak_tripwires")
    .select("id, user_id, outbreak_id, threshold_cases, email, last_checked_cases");

  if (!tripwires?.length) return NextResponse.json({ ok: true, fired: 0 });

  const outbreakIds = [...new Set((tripwires as Tripwire[]).map((t) => t.outbreak_id))];
  const { data: outbreaks } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, risk_level")
    .in("id", outbreakIds)
    .eq("active", true);

  const oMap = new Map<string, Outbreak>();
  for (const o of (outbreaks ?? []) as Outbreak[]) oMap.set(o.id, o);

  let fired = 0;

  for (const tw of tripwires as Tripwire[]) {
    const o = oMap.get(tw.outbreak_id);
    if (!o) continue;

    const crossed = o.cases >= tw.threshold_cases && tw.last_checked_cases < tw.threshold_cases;

    // Always update last_checked_cases
    await supabase
      .from("outbreak_tripwires")
      .update({
        last_checked_cases: o.cases,
        ...(crossed ? { triggered_at: new Date().toISOString() } : {}),
      })
      .eq("id", tw.id);

    if (!crossed) continue;

    const disease = o.disease_en ?? "Unknown disease";
    const country = o.country_en ?? "Unknown country";
    const deepLink = `${APP_URL}/en?outbreak=${o.id}`;

    try {
      // Log in-app notification (non-fatal)
      void Promise.resolve(supabase.from("alert_notifications").insert({
        user_id:     tw.user_id,
        type:        "tripwire",
        title:       `⚠ ${disease} (${country}) — ${o.cases.toLocaleString("en")} cases`,
        body:        `Tripwire crossed: ${o.cases.toLocaleString("en")} cases (threshold: ${tw.threshold_cases.toLocaleString("en")}) · Risk: ${o.risk_level}`,
        outbreak_id: o.id,
      })).catch(() => {});

      await resend.emails.send({
        from: "HealthWatch Global <alerts@healthwatch-global.com>",
        to:   tw.email,
        subject: `⚠ Tripwire: ${disease} (${country}) — ${o.cases.toLocaleString("en")} cases`,
        html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="color:#f87171;font-size:18px;font-weight:700;margin:0 0 8px">⚠ Tripwire Alert</p>
  <p style="margin:0 0 16px;font-size:14px;color:#94a3b8">HealthWatch Global</p>
  <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px"/>
  <p style="margin:0 0 8px;font-size:15px">
    <strong style="color:#fff">${disease}</strong> — ${country}
  </p>
  <p style="margin:0 0 4px;font-size:14px;color:#cbd5e1">
    Current cases: <strong style="color:#f87171">${o.cases.toLocaleString("en")}</strong>
    &nbsp;(threshold: ${tw.threshold_cases.toLocaleString("en")})
  </p>
  <p style="margin:0 0 20px;font-size:14px;color:#cbd5e1">
    Risk level: <strong>${o.risk_level.toUpperCase()}</strong>
  </p>
  <a href="${deepLink}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
    View outbreak →
  </a>
  <p style="margin-top:20px;font-size:11px;color:#475569">
    This alert was triggered because the outbreak crossed your configured threshold of ${tw.threshold_cases.toLocaleString("en")} cases.
    It will re-trigger if cases drop below the threshold and rise again.
    <br/>To manage your tripwires: ${APP_URL}
  </p>
</div>`,
      });
      fired++;
    } catch { /* Resend errors are non-fatal */ }
  }

  return NextResponse.json({ ok: true, fired });
}

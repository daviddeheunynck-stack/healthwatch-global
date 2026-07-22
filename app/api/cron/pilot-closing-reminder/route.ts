/**
 * Cron: /api/cron/pilot-closing-reminder
 * Schedule: 0 8 * * * (daily 08:00 UTC)
 *
 * The /pilot page promises institutional applicants a "45-min closing feedback
 * session" ending in a concrete paid proposal. Nothing previously delivered on
 * that promise — pilot accounts fell into the same generic trial-reminders
 * flow as a plain 14-day self-serve trial (generic €29/month copy, no human
 * follow-up, no Team-plan framing, no mention of the promised call).
 *
 * Pilot capacity is capped at 3 institutions/month (see app/[locale]/pilot),
 * so this does not try to automate the close — it reminds David, by email,
 * 7 days before each pilot's access lapses, with enough context (org, contact,
 * team size, use case) to personally book the session and send a real quote.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!BREVO_KEY) {
    console.warn("[pilot-closing-reminder] BREVO_API_KEY not set — skipping send");
    return false;
  }
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
  if (!res.ok) throw new Error(`Brevo error for ${to}: ${await res.text()}`);
  return true;
}

function buildReminderEmail(pilots: Array<{
  email: string; organization: string | null; trialEndsAt: string;
}>): string {
  const rows = pilots.map(p => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:14px;color:#e5e7eb;">${esc(p.organization || "—")}</td>
      <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:14px;color:#9ca3af;"><a href="mailto:${esc(p.email)}" style="color:#60a5fa;">${esc(p.email)}</a></td>
      <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:13px;color:#f59e0b;">${esc(p.trialEndsAt.slice(0, 10))}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:28px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#dc2626;padding:16px 24px;">
    <p style="margin:0;font-size:13px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Pilote institutionnel — clôture dans 7 jours</p>
  </td></tr>
  <tr><td style="background:#1e293b;padding:28px 24px;border:1px solid #334155;border-top:0;">
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.7;">
      L'accès Pro de ${pilots.length > 1 ? "ces pilotes" : "ce pilote"} expire dans 7 jours. La page /pilot promet une session de retour de 45 min qui se termine par une proposition payante concrète (plan Team, 149€/mois pour l'équipe, ou sur mesure) — c'est le moment de la programmer, avant que l'accès ne repasse automatiquement en gratuit.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead><tr>
        <th style="text-align:left;font-size:11px;color:#64748b;padding-bottom:8px;text-transform:uppercase;">Organisation</th>
        <th style="text-align:left;font-size:11px;color:#64748b;padding-bottom:8px;text-transform:uppercase;">Contact</th>
        <th style="text-align:left;font-size:11px;color:#64748b;padding-bottom:8px;text-transform:uppercase;">Expire le</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">Sans action, le compte repasse en Free automatiquement à échéance et le pilote se termine sans qu'aucune proposition payante n'ait été faite.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
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

  try {
    return await runPilotClosingReminder(supabase);
  } catch (err) {
    console.error("[pilot-closing-reminder] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "pilot-closing-reminder" } });
    await logCronRun(supabase, "pilot-closing-reminder", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runPilotClosingReminder(supabase: SupabaseClient) {
  // J-7 window: trial_ends_at in [now + 6.5d, now + 7.5d) — same ±0.5d pattern
  // as trial-reminders, wide enough to survive minor cron drift without
  // double-firing on a user across two consecutive days.
  const now = Date.now();
  const windowStart = new Date(now + 6.5 * 86_400_000).toISOString();
  const windowEnd   = new Date(now + 7.5 * 86_400_000).toISOString();

  const query = () =>
    supabase
      .from("profiles")
      .select("email, pilot_organization, trial_ends_at")
      .eq("is_pilot", true)
      .eq("plan", "pro")
      .is("stripe_subscription_id", null) // already converted → not a closing candidate
      .gte("trial_ends_at", windowStart)
      .lt("trial_ends_at", windowEnd);

  let { data: pilots, error } = await query();
  if (error) ({ data: pilots, error } = await query()); // one retry, same pattern as trial-reminders

  if (error) {
    console.error("[pilot-closing-reminder] query error:", error);
    Sentry.captureException(new Error(`[pilot-closing-reminder] query failed: ${error.message}`), {
      tags: { cron: "pilot-closing-reminder" },
    });
    await logCronRun(supabase, "pilot-closing-reminder", "error", 0, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pilots || pilots.length === 0) {
    await logCronRun(supabase, "pilot-closing-reminder", "ok", 0);
    return NextResponse.json({ sent: 0, reason: "no pilots ending in ~7 days" });
  }

  const eligible = pilots.filter(p => !!p.email && !!p.trial_ends_at);
  let sent = 0;

  if (eligible.length > 0) {
    const html = buildReminderEmail(eligible.map(p => ({
      email: p.email as string,
      organization: p.pilot_organization as string | null,
      trialEndsAt: p.trial_ends_at as string,
    })));
    const subject = `[PILOT 🔴] ${eligible.length} pilote${eligible.length > 1 ? "s" : ""} à clôturer sous 7 jours`;

    try {
      if (isRealProduction) {
        await sendEmail("david.deheunynck@gmail.com", subject, html);
      }
      sent = eligible.length;
    } catch (err) {
      console.error("[pilot-closing-reminder] send failed:", err);
      Sentry.captureException(err, { tags: { cron: "pilot-closing-reminder" } });
      await logCronRun(supabase, "pilot-closing-reminder", "error", 0,
        err instanceof Error ? err.message : String(err));
      return NextResponse.json({ error: "send failed" }, { status: 500 });
    }
  }

  await logCronRun(supabase, "pilot-closing-reminder", "ok", sent);
  return NextResponse.json({ sent, total: pilots.length });
}

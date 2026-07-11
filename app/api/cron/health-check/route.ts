import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { CRON_WINDOWS, logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { fetchSentryIssues } from "@/lib/sentry-issues";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const clean = (v: string | undefined) => (v ?? "").replace(/^﻿/, "").trim();

interface CronRun {
  ts:     string;
  status: string;
  rows:   number;
  error?: string;
}

export async function GET(req: NextRequest) {
  const cronSecret = clean(process.env.CRON_SECRET);
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`)
    return new Response("Unauthorized", { status: 401 });

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  // Without this, a crash before line 129 leaves no trace in site_config.
  const supabaseEarly = createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
  try {
    return await runHealthCheck(req, supabaseEarly);
  } catch (err) {
    console.error("[health-check] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "health-check" } });
    await logCronRun(supabaseEarly, "health-check", "error", 0,
      err instanceof Error ? err.message : String(err));
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runHealthCheck(_req: NextRequest, supabase: any) {
  const checkInId = isRealProduction
    ? Sentry.captureCheckIn(
        { monitorSlug: "health-check", status: "in_progress" },
        { schedule: { type: "crontab", value: "5 7 * * *" }, checkinMargin: 10, maxRuntime: 1, timezone: "UTC" },
      )
    : undefined;

  const brevoKey = clean(process.env.BREVO_API_KEY);

  const [[{ count: total }, { count: high }, { count: pheic }, { data: configRows }], sentryCheck] =
    await Promise.all([
      Promise.all([
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true).eq("risk_level", "high"),
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true).eq("is_pheic", true),
        supabase.from("site_config").select("key,value").like("key", "cron:run:%"),
      ]),
      fetchSentryIssues(),
    ]);

  const sentryIssues = sentryCheck.issues;
  const sentryBroken = !sentryCheck.ok;
  const sentryAlert  = sentryBroken || sentryIssues.length > 0;

  // Build map cronName -> last run info
  const cronMap: Record<string, CronRun & { ageH: number }> = {};
  for (const row of configRows ?? []) {
    const name = (row.key as string).replace("cron:run:", "");
    try {
      const run: CronRun = JSON.parse(row.value as string);
      const ageH = (Date.now() - new Date(run.ts).getTime()) / 3_600_000;
      cronMap[name] = { ...run, ageH };
    } catch { /* malformed, skip */ }
  }

  // Classify each cron against its expected window
  const overdue: string[] = [];
  const cronStatuses = Object.entries(CRON_WINDOWS).map(([name, windowH]) => {
    const run = cronMap[name];
    if (!run) {
      overdue.push(name);
      return { name, ageH: null, windowH, ok: false, label: "jamais" };
    }
    const ageH = Math.round(run.ageH);
    const ok   = run.ageH <= windowH;
    if (!ok) overdue.push(name);
    return { name, ageH, windowH, ok, label: `${ageH}h`, rows: run.rows, status: run.status };
  });

  const hasOverdue = overdue.length > 0;
  const emoji      = hasOverdue || sentryAlert || (pheic ?? 0) > 0 ? "⚠️" : "✅";

  const cronTableRows = cronStatuses
    .map(({ name, label, windowH, ok }) => {
      const color = ok ? "#34d399" : "#f87171";
      return `<tr>
      <td style="padding:3px 8px 3px 0;color:#94a3b8;font-size:12px">${name}</td>
      <td style="padding:3px 8px;font-size:12px;color:${color};font-weight:${ok ? "normal" : "700"}">${label}</td>
      <td style="padding:3px 0;font-size:12px;color:#64748b">/ ${windowH}h max</td>
    </tr>`;
    })
    .join("");

  const sentryIssueRows = sentryIssues
    .slice(0, 10)
    .map(
      (i) => `<tr>
      <td style="padding:3px 8px 3px 0;font-size:12px"><a href="${i.permalink}" style="color:#f87171;text-decoration:none">${i.title}</a></td>
      <td style="padding:3px 0;font-size:12px;color:#64748b">${i.count}× · ${i.level}</td>
    </tr>`,
    )
    .join("");

  const html = `
<div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="font-size:16px;font-weight:700;color:#60a5fa;margin:0 0 16px">HealthWatch — Health Check ${emoji}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
    <tr><td style="padding:6px 0;color:#94a3b8">Foyers actifs</td><td style="padding:6px 0;font-weight:600">${total ?? "?"}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8">Risque HIGH</td><td style="padding:6px 0;font-weight:600;color:#f87171">${high ?? "?"}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8">PHEIC actifs</td><td style="padding:6px 0;font-weight:600;color:#c084fc">${pheic ?? "?"}${(pheic ?? 0) > 0 ? " ⚠️" : ""}</td></tr>
    ${hasOverdue ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">⚠️ ${overdue.length} cron(s) en retard : ${overdue.join(", ")}</td></tr>` : ""}
    ${sentryBroken
      ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔧 Sentry non vérifiable : ${sentryCheck.error}</td></tr>`
      : sentryIssues.length > 0
      ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">⚠️ ${sentryIssues.length} erreur(s) Sentry (24h)</td></tr>`
      : `<tr><td style="padding:6px 0;color:#94a3b8">Erreurs Sentry (24h)</td><td style="padding:6px 0;font-weight:600;color:#34d399">0</td></tr>`}
  </table>
  <p style="font-size:12px;color:#60a5fa;margin:0 0 8px;font-weight:600">Dernier passage par cron</p>
  <table style="width:100%;border-collapse:collapse">${cronTableRows}</table>
  ${sentryIssueRows ? `
  <p style="font-size:12px;color:#f87171;margin:16px 0 8px;font-weight:600">Détail erreurs Sentry</p>
  <table style="width:100%;border-collapse:collapse">${sentryIssueRows}</table>` : ""}
  <p style="margin-top:16px;font-size:11px;color:#475569">${new Date().toISOString()}</p>
</div>`;

  const subject = `${emoji} HealthWatch — ${total ?? "?"} foyers${hasOverdue ? ` · ${overdue.length} cron(s) en retard` : ""}${sentryIssues.length > 0 ? ` · ${sentryIssues.length} erreur(s) Sentry` : ""} · ${new Date().toLocaleDateString("fr-FR")}`;

  if (!isRealProduction) {
    console.log("[health-check] non-production run — skipping Brevo email and Sentry check-in/alerts");
  } else if (!brevoKey) {
    Sentry.captureMessage("[health-check] BREVO_API_KEY not set — health report not sent", "error");
  } else {
    try {
      const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
          to:          [{ email: "david.deheunynck@yahoo.fr" }],
          subject,
          htmlContent: html,
        }),
      });
      if (!emailRes.ok) {
        const errText = await emailRes.text();
        Sentry.captureMessage(`[health-check] Brevo ${emailRes.status}: ${errText}`, "error");
      }
    } catch (emailErr) {
      Sentry.captureException(emailErr, { tags: { cron: "health-check" } });
    }
  }

  // Alert Sentry directly if crons are overdue (independent of email delivery)
  if (hasOverdue && isRealProduction) {
    Sentry.captureMessage(
      `[health-check] ${overdue.length} cron(s) overdue: ${overdue.join(", ")}`,
      "warning",
    );
  }

  await logCronRun(supabase, "health-check", hasOverdue || sentryAlert ? "error" : "ok", overdue.length + sentryIssues.length);

  if (isRealProduction) {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "health-check",
      status: hasOverdue || sentryAlert ? "error" : "ok",
    });
  }

  return Response.json({
    ok: !hasOverdue && !sentryAlert,
    total, high, pheic, overdue, cronStatuses, isRealProduction,
    sentry: { ok: sentryCheck.ok, issueCount: sentryIssues.length, error: sentryCheck.error },
  });
}

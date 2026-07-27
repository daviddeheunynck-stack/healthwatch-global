import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { CRON_WINDOWS, logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { fetchSentryIssues } from "@/lib/sentry-issues";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const clean = (v: string | undefined) => (v ?? "").replace(/^﻿/, "").trim();

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface CronRun {
  ts:     string;
  status: string;
  rows:   number;
  lastNonZero?: string;
  error?: string;
}

// Delivery crons mapped to the table that holds their audience — one row per
// user (per region/disease/etc. for the ones with multiple prefs each).
// Used to tell "nobody to send to" apart from "somebody's there but nothing
// went out", the distinction `logCronRun`'s plain ok/error status can't make
// on its own. Found 2026-07-27: 15 of 18 delivery crons were logging
// "ok, rows=0" on this same morning, including push-alerts after 49 silent
// days — a flat "rows=0 is fine" reading would have missed that too.
const DELIVERY_AUDIENCE: Record<string, string> = {
  "push-alerts":                 "push_subscriptions",
  "regional-alerts":             "user_alert_regions",
  "disease-alerts":              "user_alert_diseases",
  "watchlist-alerts":            "user_watchlist",
  "trigger-country-risk-alerts": "country_risk_alerts",
  "trigger-geofence-alerts":     "geofence_alerts",
  "trigger-category-alerts":     "category_alerts",
  "trigger-tripwires":           "outbreak_tripwires",
  "trigger-subscriber-alerts":   "outbreak_subscribers",
  "weekly-digest":               "subscriptions",
  "weekly-signal":               "subscriptions",
};

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

  const AUDIENCE_TABLES = Array.from(new Set(Object.values(DELIVERY_AUDIENCE)));

  const [[{ count: total }, { count: high }, { count: pheic }, { data: configRows }], sentryCheck, audienceCounts] =
    await Promise.all([
      Promise.all([
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true).eq("risk_level", "high"),
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true).eq("is_pheic", true),
        supabase.from("site_config").select("key,value").like("key", "cron:run:%"),
      ]),
      fetchSentryIssues(),
      // "subscriptions" (weekly-digest/weekly-signal) only counts active=true —
      // matches what those two crons themselves query as their send list.
      // Every other audience table here has no active/status flag of its own.
      Promise.all(AUDIENCE_TABLES.map((table) =>
        table === "subscriptions"
          ? supabase.from(table).select("*", { count: "exact", head: true }).eq("active", true)
          : supabase.from(table).select("*", { count: "exact", head: true }),
      )),
    ]);

  const audienceMap: Record<string, number> = {};
  AUDIENCE_TABLES.forEach((table, i) => { audienceMap[table] = audienceCounts[i]?.count ?? 0; });

  // David decided 2026-07-17 not to top up the Anthropic billing that backs
  // extractAdmin1LLM — it degrades gracefully to the regex fallback (see
  // lib/geo-extract-llm.ts), so this is now a known, accepted state rather
  // than something to action daily. Keep it out of this digest specifically;
  // /api/health's deep Sentry check is untouched, since that one is pulled
  // on demand for a genuine audit, not pushed unprompted every morning.
  const sentryIssues = sentryCheck.issues.filter(
    (i) => !i.title.startsWith("[geo-extract-llm] Anthropic API credit balance too low"),
  );
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

  // ── Delivery visibility: "nobody to send to" vs. "somebody's there and
  // nothing went out" ─────────────────────────────────────────────────────
  // A delivery cron logging "ok, rows=0" is indistinguishable from a stalled
  // one under the age-only check above — rows=0 is the correct, expected
  // state whenever its audience table is empty. Only flag a table that
  // actually has subscribers. "never" (no lastNonZero ever recorded) is the
  // worse case — exactly the push-alerts shape found 2026-07-27 (49 silent
  // days). "stalled" uses a per-cron threshold (3× its own expected window,
  // floored at 3 days) rather than one fixed number, since a weekly cron
  // going quiet for 4 days is normal but a 30-min trigger cron going quiet
  // for 4 days is not.
  const deliveryIssues: { name: string; audience: number; kind: "never" | "stalled" }[] = [];
  for (const [name, table] of Object.entries(DELIVERY_AUDIENCE)) {
    const audience = audienceMap[table] ?? 0;
    if (audience === 0) continue;
    const run = cronMap[name];
    if (!run?.lastNonZero) {
      // lastNonZero is new (added 2026-07-27) — a pre-existing site_config
      // entry won't have it yet even though its last logged run genuinely
      // delivered (rows > 0). Only "never" when that's also not the case,
      // so this doesn't false-positive on every delivery cron the first
      // time health-check runs after this field was introduced.
      if (!run || (run.rows ?? 0) === 0) deliveryIssues.push({ name, audience, kind: "never" });
      continue;
    }
    const daysSinceDelivery = (Date.now() - new Date(run.lastNonZero).getTime()) / 86_400_000;
    const windowH = CRON_WINDOWS[name] ?? 26;
    const stallThresholdDays = Math.max(3, (windowH / 24) * 3);
    if (daysSinceDelivery > stallThresholdDays) {
      deliveryIssues.push({ name, audience, kind: "stalled" });
    }
  }
  const deliveryAlert = deliveryIssues.length > 0;

  const emoji = hasOverdue || sentryAlert || deliveryAlert || (pheic ?? 0) > 0 ? "⚠️" : "✅";

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
      <td style="padding:3px 8px 3px 0;font-size:12px"><a href="${esc(i.permalink)}" style="color:#f87171;text-decoration:none">${esc(i.title)}</a></td>
      <td style="padding:3px 0;font-size:12px;color:#64748b">${esc(i.count)}× · ${esc(i.level)}</td>
    </tr>`,
    )
    .join("");

  const deliveryIssueRows = deliveryIssues
    .map(({ name, audience, kind }) => `<tr>
      <td style="padding:3px 8px 3px 0;color:#94a3b8;font-size:12px">${name}</td>
      <td style="padding:3px 8px;font-size:12px;color:#94a3b8">${audience} abonné(s)</td>
      <td style="padding:3px 0;font-size:12px;color:${kind === "never" ? "#f87171" : "#fbbf24"};font-weight:700">${kind === "never" ? "jamais livré" : "en panne"}</td>
    </tr>`)
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
      ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔧 Sentry non vérifiable : ${esc(sentryCheck.error ?? "")}</td></tr>`
      : sentryIssues.length > 0
      ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">⚠️ ${sentryIssues.length} erreur(s) Sentry (24h)</td></tr>`
      : `<tr><td style="padding:6px 0;color:#94a3b8">Erreurs Sentry (24h)</td><td style="padding:6px 0;font-weight:600;color:#34d399">0</td></tr>`}
  </table>
  <p style="font-size:12px;color:#60a5fa;margin:0 0 8px;font-weight:600">Dernier passage par cron</p>
  <table style="width:100%;border-collapse:collapse">${cronTableRows}</table>
  ${sentryIssueRows ? `
  <p style="font-size:12px;color:#f87171;margin:16px 0 8px;font-weight:600">Détail erreurs Sentry</p>
  <table style="width:100%;border-collapse:collapse">${sentryIssueRows}</table>` : ""}
  ${deliveryIssueRows ? `
  <p style="font-size:12px;color:#f87171;margin:16px 0 8px;font-weight:600">⚠️ Livraison en panne (des abonnés existent, rien envoyé récemment)</p>
  <table style="width:100%;border-collapse:collapse">${deliveryIssueRows}</table>` : ""}
  <p style="margin-top:16px;font-size:11px;color:#475569">${new Date().toISOString()}</p>
</div>`;

  const subject = `${emoji} HealthWatch — ${total ?? "?"} foyers${hasOverdue ? ` · ${overdue.length} cron(s) en retard` : ""}${sentryIssues.length > 0 ? ` · ${sentryIssues.length} erreur(s) Sentry` : ""}${deliveryAlert ? ` · ${deliveryIssues.length} canal(aux) en panne` : ""} · ${new Date().toLocaleDateString("fr-FR")}`;

  if (!isRealProduction) {
    console.log("[health-check] non-production run — skipping Brevo email and Sentry check-in/alerts");
  } else if (!brevoKey) {
    Sentry.captureMessage("[health-check] BREVO_API_KEY not set — health report not sent", "error");
  } else {
    try {
      const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
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

  // Same treatment as hasOverdue above, kept separate from logCronRun's own
  // status for the same reason sentryAlert is (see the check-in comment
  // below): this route completed fine either way, it's reporting on other
  // crons, not on itself.
  if (deliveryAlert && isRealProduction) {
    Sentry.captureMessage(
      `[health-check] ${deliveryIssues.length} delivery channel(s) stalled or never delivered: ${deliveryIssues.map((d) => `${d.name}(${d.kind})`).join(", ")}`,
      "warning",
    );
  }

  // logCronRun's status mirrors hasOverdue — read by this same route's own
  // cronMap/CRON_WINDOWS check next run, and by the email table below, to
  // color health-check's row. Independent of the Sentry Crons check-in below.
  await logCronRun(supabase, "health-check", hasOverdue ? "error" : "ok", overdue.length + sentryIssues.length);

  if (isRealProduction) {
    // The check-in only reflects whether this cron itself completed without
    // throwing — not hasOverdue (already reported separately above via
    // captureMessage) or sentryAlert (removed 2026-07-14, see git history:
    // that one created a real self-sustaining loop). Tying the check-in to
    // hasOverdue didn't loop, but still made the Sentry Crons issue "Cron
    // failure: health-check" look like this job was crashing, when it was
    // actually completing fine every day and honestly reporting an unrelated
    // cron running late (12 occurrences since 2026-06-30, none an actual
    // health-check failure). A genuine crash before this line still surfaces
    // correctly: the "in_progress" check-in opened above (checkInId) is left
    // dangling, and Sentry Crons reports a missed/timed-out check-in instead
    // of a misleading "ok". Found 2026-07-16.
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "health-check",
      status: "ok",
    });
    // captureCheckIn is fire-and-forget — without an explicit flush, a manual
    // curl trigger against this route showed the check-in still queued when
    // the serverless function returned, and Sentry recorded it as "timeout"
    // instead of "ok" once maxRuntime elapsed. A bounded flush here (capped
    // so a slow/unreachable Sentry endpoint can't hang the response) fixes
    // that without changing anything else. Found 2026-07-16.
    await Sentry.flush(2000);
  }

  return Response.json({
    ok: !hasOverdue && !sentryAlert && !deliveryAlert,
    total, high, pheic, overdue, cronStatuses, isRealProduction,
    sentry: { ok: sentryCheck.ok, issueCount: sentryIssues.length, error: sentryCheck.error },
    delivery: deliveryIssues,
  });
}

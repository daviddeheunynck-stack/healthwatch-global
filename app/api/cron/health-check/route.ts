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

// Independent per-delivery evidence, where a real log table already exists —
// more trustworthy than site_config's lastNonZero for a cron whose entry
// predates 2026-07-27 (that field only gets set going forward, on its own
// next rows>0 run). Found the same day lastNonZero shipped: a dry run of
// regional-alerts' own send logic showed every one of its 7 real paid
// subscribers had a genuine outbreak_alert_log row sent within the last 24h
// (some within the last hour) — the cron was never broken, it just hadn't
// had a rows>0 run yet since the field was introduced, so it read as "never"
// on day one. See project_health_check_delivery_false_positive_2026_07_27.
//
// Each entry MUST point at a log that only this cron's own delivery path
// writes — otherwise a healthy sibling cron's rows answer for a dead one and
// the check silently reports it as fine forever. Found 2026-07-29 security
// audit: `disease-alerts` was pointed at `outbreak_alert_log`, which it never
// writes (it logs to `disease_alert_log`, see its route line ~189). Because a
// broken delivery cron never gets a rows>0 run, its `lastNonZero` would stay
// unset permanently, so this fallback — not the site_config field — would be
// the only thing answering for it, and it was reading regional-alerts' fresh
// sends. A total disease-alerts outage would have reported "✅" indefinitely.
const REAL_EVIDENCE: Record<string, { table: string; column: string }> = {
  // outbreak_alert_log is also seeded by app/api/activate-trial (~line 187),
  // but that path writes those rows precisely because it just sent the user
  // the same regional digest email, so they are genuine deliveries here.
  "regional-alerts": { table: "outbreak_alert_log", column: "sent_at" },
  "disease-alerts":  { table: "disease_alert_log",  column: "sent_at" },
  "push-alerts":     { table: "outbreaks", column: "push_notified_at" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lastRealDelivery(supabase: any, cronName: string): Promise<string | null> {
  const ev = REAL_EVIDENCE[cronName];
  if (!ev) return null;
  const { data } = await supabase
    .from(ev.table)
    .select(ev.column)
    .not(ev.column, "is", null)
    .order(ev.column, { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.[ev.column] as string | undefined) ?? null;
}

interface ZeroRegionTrial { email: string; trialEndsAt: string }

// A trial with zero rows in user_alert_regions never receives an alert, and
// nothing else in the product notices — DELIVERY_AUDIENCE/deliveryIssues
// above only sees "somebody's there and rows>0 stalled", never a single
// account that was never enrolled at all. Found 2026-08-01:
// r.endangrukmanams@gmail.com ran its full 30-day trial (9 sequence emails,
// 0 alerts) after an OAuth enrollment bug (fixed same day, 906af61/d34363c)
// left it with no regions from day one. Signal only — this never enrolls
// anyone. A 0-region account could one day legitimately mean "opted out of
// everything" rather than "never enrolled"; that distinction doesn't exist
// yet (initial enrollment always writes 5 rows today), but a silent
// auto-fix here would break the moment it does. See
// marketing/product-ideas-log.md, 2026-08-01, idea 2.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkZeroRegionTrials(supabase: any): Promise<{ trials: ZeroRegionTrial[]; error: string | null }> {
  const { data: trialProfiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, email, trial_ends_at")
    .in("plan", ["starter", "pro"])
    .not("trial_ends_at", "is", null)
    .is("stripe_subscription_id", null);
  if (profilesErr) return { trials: [], error: profilesErr.message };
  if (!trialProfiles || trialProfiles.length === 0) return { trials: [], error: null };

  const ids = trialProfiles.map((p: { id: string }) => p.id);
  const { data: regionRows, error: regionErr } = await supabase
    .from("user_alert_regions")
    .select("user_id")
    .in("user_id", ids);
  if (regionErr) return { trials: [], error: regionErr.message };

  const enrolledIds = new Set((regionRows ?? []).map((r: { user_id: string }) => r.user_id));
  const now = Date.now();
  // Only actively-running trials are listed — an expired trial with 0
  // regions is no longer actionable (see r.endangrukmanams@, expired
  // 2026-08-01, deliberately excluded here rather than force-included).
  const trials: ZeroRegionTrial[] = trialProfiles
    .filter((p: { id: string; email: string | null; trial_ends_at: string | null }) =>
      !!p.email && !!p.trial_ends_at && !enrolledIds.has(p.id) && new Date(p.trial_ends_at).getTime() > now)
    .map((p: { email: string; trial_ends_at: string }) => ({ email: p.email, trialEndsAt: p.trial_ends_at }));
  return { trials, error: null };
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

  const AUDIENCE_TABLES = Array.from(new Set(Object.values(DELIVERY_AUDIENCE)));

  const [[{ count: total }, { count: high }, { count: pheic }, { data: configRows }], sentryCheck, audienceCounts, zeroRegionResult] =
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
      checkZeroRegionTrials(supabase),
    ]);

  const zeroRegionTrials    = zeroRegionResult.trials;
  const zeroRegionError     = zeroRegionResult.error;
  const hasZeroRegionTrials = zeroRegionTrials.length > 0;

  // `?? 0` on a FAILED count would read as "this channel has no subscribers",
  // and the delivery loop below skips an audience of 0 — so a transient error
  // on one of these tables silently disables that channel's delivery check for
  // the day instead of reporting anything. Same shape as the snapshot
  // dependency in data-quality: keep the errors and say so rather than
  // degrading quietly into a green report.
  const audienceMap: Record<string, number> = {};
  const audienceErrors: string[] = [];
  AUDIENCE_TABLES.forEach((table, i) => {
    const res = audienceCounts[i];
    if (res?.error) audienceErrors.push(`${table} (${res.error.message})`);
    audienceMap[table] = res?.count ?? 0;
  });

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

  // CRON_WINDOWS is a hand-maintained allowlist, so a cron that is scheduled and
  // logging runs but was never added to it is simply never looked at — it can
  // fail every day and this report stays green. Found 2026-07-29:
  // pilot-closing-reminder had been in that state since creation (scheduled
  // daily 08:00, logging its own "error" statuses, watched by nobody). Diffing
  // the cron:run:* keys against the table catches the next one automatically
  // instead of relying on someone thinking to check.
  const unmonitored = Object.keys(cronMap).filter((name) => !(name in CRON_WINDOWS)).sort();

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

  const hasOverdue    = overdue.length > 0;
  const hasUnmonitored = unmonitored.length > 0;

  // `ok` above is purely age-based, and run.status was carried into the table
  // row but never alerted on — so a cron that runs perfectly on schedule and
  // fails every single time showed up green. logCronRun has always recorded the
  // failure; nothing read it. "no_data" is a legitimate idle state (nothing to
  // send/ingest this run) and stays quiet; only "error" is surfaced.
  const erroring = Object.entries(cronMap)
    .filter(([name, run]) => name in CRON_WINDOWS && run.status === "error")
    .map(([name, run]) => ({ name, error: run.error ?? "(sans message)" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasErroring = erroring.length > 0;

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
    // lastNonZero is new (added 2026-07-27) — a pre-existing site_config entry
    // won't have it yet even though its last logged run genuinely delivered
    // (rows > 0). Fall back to a real per-delivery log where one exists
    // (REAL_EVIDENCE) before concluding "never" — confirmed necessary the
    // same day: regional-alerts read as "never" purely because this exact
    // run was its first with rows=0 since the field shipped, while
    // outbreak_alert_log showed real sends within the last hour.
    const effectiveLastNonZero = run?.lastNonZero ?? (await lastRealDelivery(supabase, name));
    if (!effectiveLastNonZero) {
      if (!run || (run.rows ?? 0) === 0) deliveryIssues.push({ name, audience, kind: "never" });
      continue;
    }
    const daysSinceDelivery = (Date.now() - new Date(effectiveLastNonZero).getTime()) / 86_400_000;
    const windowH = CRON_WINDOWS[name] ?? 26;
    const stallThresholdDays = Math.max(3, (windowH / 24) * 3);
    if (daysSinceDelivery > stallThresholdDays) {
      deliveryIssues.push({ name, audience, kind: "stalled" });
    }
  }
  const deliveryAlert = deliveryIssues.length > 0;

  const emoji = hasOverdue || hasUnmonitored || hasErroring || audienceErrors.length > 0 || sentryAlert || deliveryAlert || hasZeroRegionTrials || (pheic ?? 0) > 0 ? "⚠️" : "✅";

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

  const zeroRegionRows = zeroRegionTrials
    .map(({ email, trialEndsAt }) => `<tr>
      <td style="padding:3px 8px 3px 0;color:#94a3b8;font-size:12px">${esc(email)}</td>
      <td style="padding:3px 0;font-size:12px;color:#f87171;font-weight:700">0 région — essai jusqu'au ${esc(new Date(trialEndsAt).toLocaleDateString("fr-FR"))}</td>
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
    ${hasUnmonitored ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">⚠️ ${unmonitored.length} cron(s) NON surveillé(s) — écrivent un statut mais absents de CRON_WINDOWS, donc jamais vérifiés : ${esc(unmonitored.join(", "))}</td></tr>` : ""}
    ${audienceErrors.length > 0 ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">⚠️ Contrôle de livraison partiellement aveugle — comptage d'abonnés en échec : ${esc(audienceErrors.join(", "))}</td></tr>` : ""}
    ${hasErroring ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">⚠️ ${erroring.length} cron(s) à l'heure mais EN ERREUR au dernier passage : ${erroring.map((e) => `${esc(e.name)} (${esc(e.error.slice(0, 120))})`).join(" · ")}</td></tr>` : ""}
    ${zeroRegionError ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔧 Contrôle « essai sans région d'alerte » impossible : ${esc(zeroRegionError)}</td></tr>` : ""}
    ${hasZeroRegionTrials ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">⚠️ ${zeroRegionTrials.length} essai(s) actif(s) SANS AUCUNE région d'alerte configurée</td></tr>` : ""}
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
  ${zeroRegionRows ? `
  <p style="font-size:12px;color:#f87171;margin:16px 0 8px;font-weight:600">⚠️ Essais actifs sans aucune région d'alerte (signal seul, aucun enrôlement automatique)</p>
  <table style="width:100%;border-collapse:collapse">${zeroRegionRows}</table>` : ""}
  <p style="margin-top:16px;font-size:11px;color:#475569">${new Date().toISOString()}</p>
</div>`;

  const subject = `${emoji} HealthWatch — ${total ?? "?"} foyers${hasOverdue ? ` · ${overdue.length} cron(s) en retard` : ""}${sentryIssues.length > 0 ? ` · ${sentryIssues.length} erreur(s) Sentry` : ""}${deliveryAlert ? ` · ${deliveryIssues.length} canal(aux) en panne` : ""}${hasZeroRegionTrials ? ` · ${zeroRegionTrials.length} essai(s) sans région` : ""} · ${new Date().toLocaleDateString("fr-FR")}`;

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
    ok: !hasOverdue && !hasUnmonitored && !hasErroring && !sentryAlert && !deliveryAlert && !hasZeroRegionTrials,
    unmonitored,
    erroring,
    total, high, pheic, overdue, cronStatuses, isRealProduction,
    sentry: { ok: sentryCheck.ok, issueCount: sentryIssues.length, error: sentryCheck.error },
    delivery: deliveryIssues,
    zeroRegionTrials: { count: zeroRegionTrials.length, trials: zeroRegionTrials, error: zeroRegionError },
  });
}

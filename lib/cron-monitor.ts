/**
 * Cron monitoring utility.
 * Each sync cron calls logCronRun() at the end of its execution.
 * The health-check reads these entries and alerts on overdue crons.
 *
 * Storage: site_config table, key = "cron:run:{cronName}"
 * Value: JSON { ts, status, rows, error? }
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * True only on the real Vercel production deployment. Unset for `next dev`
 * and for preview builds. Gate any outbound side effect a real person could
 * receive (email, webhook, push, SMS) behind this — local/preview runs read
 * from the isolated dev Supabase project, so their data is not representative
 * and should never reach a third party. DB writes (logCronRun included) are
 * fine unguarded: they land in whichever Supabase project is configured.
 */
export const isRealProduction = process.env.VERCEL_ENV === "production";

/**
 * True when this invocation is either a genuine Vercel Cron trigger or an
 * explicit manual "?live=1" test override.
 *
 * Vercel adds an `x-vercel-cron-schedule` header to every scheduled cron
 * invocation (see https://vercel.com/docs/cron-jobs/manage-cron-jobs#reading-the-cron-schedule-header).
 * Vercel's own docs do not document this header (or the `vercel-cron/1.0`
 * user-agent) as cryptographically unspoofable — `CRON_SECRET`, checked
 * separately by each route, remains the only real authentication. So this is
 * a practical safeguard against *accidental* replay of a cron URL (a browser
 * tab, an ad-hoc curl during a debugging session — none of which set this
 * header or the query param by default), not a hardened defense against
 * someone who already holds CRON_SECRET and deliberately spoofs the header.
 * That threat model match is intentional: the incident this guards against
 * (saeed.mohamood@ receiving the same trial-ending email 3× in one hour on
 * 2026-07-15) was exactly an accidental manual replay, not an attack.
 *
 * Gate only the outbound send (Brevo call) behind this, not DB state
 * changes — those (e.g. expire-trials' plan downgrade) are already
 * idempotent and re-running them harmlessly is preferable to risking the
 * billing-critical downgrade silently not firing on a real scheduled run
 * because of a header-detection bug.
 */
export function isLiveCronInvocation(req: NextRequest): boolean {
  const isVercelCron = req.headers.get("x-vercel-cron-schedule") !== null;
  const liveParam = req.nextUrl.searchParams.get("live") === "1";
  return isVercelCron || liveParam;
}

export type CronStatus = "ok" | "error" | "no_data";

export interface CronRun {
  ts: string;
  status: CronStatus;
  rows: number;
  // ISO timestamp of the most recent run of this cron where rows > 0. Carried
  // forward across runs (see logCronRun) so a delivery cron that keeps logging
  // "ok, rows=0" can be told apart from one that's never actually delivered —
  // site_config only ever holds the latest run, so without this a stalled
  // channel and a legitimately-empty one look identical. Found 2026-07-27:
  // push-alerts logged "ok" every day for 49 days with 0 subscribers.
  lastNonZero?: string;
  error?: string;
}

/**
 * Log a cron execution result to site_config.
 * Call this at the end of every sync cron, success or failure.
 */
export async function logCronRun(
  supabase: SupabaseClient,
  cronName: string,
  status: CronStatus,
  rowsUpdated = 0,
  errorMsg?: string,
): Promise<void> {
  const { data: prevRow } = await supabase
    .from("site_config")
    .select("value")
    .eq("key", `cron:run:${cronName}`)
    .maybeSingle();
  let prevLastNonZero: string | undefined;
  if (prevRow?.value) {
    try { prevLastNonZero = (JSON.parse(prevRow.value) as CronRun).lastNonZero; } catch { /* malformed, ignore */ }
  }

  const value: CronRun = {
    ts: new Date().toISOString(),
    status,
    rows: rowsUpdated,
    ...(rowsUpdated > 0 ? { lastNonZero: new Date().toISOString() } : prevLastNonZero ? { lastNonZero: prevLastNonZero } : {}),
    ...(errorMsg ? { error: errorMsg.slice(0, 500) } : {}),
  };
  await supabase
    .from("site_config")
    .upsert({ key: `cron:run:${cronName}`, value: JSON.stringify(value) }, { onConflict: "key" })
    .then(({ error }) => {
      if (error) console.error(`[cron-monitor] failed to log ${cronName}:`, error.message);
    });
}

/**
 * Expected max gap (hours) before a cron is considered overdue.
 * Set to 1.5× the schedule interval to absorb Vercel timing jitter.
 */
export const CRON_WINDOWS: Record<string, number> = {
  // ── Sync crons ───────────────────────────────────────────────────────────────
  "sync-outbreaks":    2,    // hourly
  "check-new-don":     2,    // hourly at :20 — new WHO DON detector
  "sync-signals":      9,    // every 6h
  "sync-cdc-han":      7,    // every 4h
  "sync-ukhsa":        24,   // twice daily (06:00/14:00 → 16h overnight gap; 24h ≈ 1.5× to avoid 07:05 false-overdue)
  "sync-spf":          24,   // twice daily (07:00/15:00 → 16h overnight gap; 24h ≈ 1.5× to avoid 07:05 false-overdue)
  "sync-cdc-notices":  26,   // daily
  "sync-drc-sitrep":   26,   // daily — PHEIC cadence
  "sync-who-afro":     26,   // daily
  "sync-who-emro":     26,   // daily
  "sync-africa-cdc":   26,   // daily
  "sync-who-regional": 26,   // daily
  "sync-ncdc":         26,   // daily (NCDC weekly sitreps, checked daily)
  "check-mpox-sitrep": 26,   // daily
  "sync-paho-alerts":  26,   // daily
  "sync-ecdc-threats": 26,   // daily
  "sync-endemic-data": 26,   // daily
  "sync-usda-aphis":   26,   // daily
  // ── Alert delivery crons ─────────────────────────────────────────────────────
  "sync-brevo-blocklist": 26, // daily 06:00 — feeds profiles.email_blocked_at before the 06:xx sends below
  "regional-alerts":   26,   // daily 06:30
  "watchlist-alerts":  26,   // daily 06:40
  "push-alerts":       26,   // daily 06:45
  "disease-alerts":    26,   // daily 06:50
  "pilot-follow-up":   26,   // daily 08:00
  // Was scheduled in vercel.json and logging runs (including "error" statuses)
  // since creation, but never registered here — so health-check never looked at
  // it and an outage would have been invisible. Found 2026-07-29 by diffing the
  // cron:run:* keys in site_config against this table; health-check now reports
  // that mismatch itself instead of relying on someone thinking to check.
  "pilot-closing-reminder": 26,  // daily 08:00
  "data-quality":      26,   // daily 10:00
  // ── Billing & retention crons ────────────────────────────────────────────────
  "expire-trials":       26,  // daily — monetization critical
  "onboarding-sequence": 26,  // daily — trial email sequence
  "trial-reminders":     26,  // daily — conversion critical
  "winback-sequence":    26,  // daily — churn recovery
  "weekly-digest":      200,  // weekly Mon
  "send-sitrep-emails": 200,  // weekly Mon
  "weekly-signal":      200,  // weekly Mon (free-user newsletter)
  // ── Enterprise & infra crons ──────────────────────────────────────────────────
  "trigger-webhooks":          2,    // every 30min — enterprise webhook delivery
  // ── Trigger & coverage crons ──────────────────────────────────────────────────
  "trigger-tripwires":         2,    // every 30min
  "trigger-subscriber-alerts": 2,    // every 30min
  "trigger-category-alerts":   2,    // every 30min
  "trigger-pheic-alerts":      2,    // every 30min
  "disease-coverage":          2,    // hourly at :30
  "trigger-geofence-alerts":   9,    // every 6h
  "trigger-country-risk-alerts": 9,  // every 6h
  "trigger-regional-digest":  200,   // weekly Mon
  // ── Admin crons ──────────────────────────────────────────────────────────────
  "enrich-admin1":             2,    // hourly at :15
  // ── Monitoring ───────────────────────────────────────────────────────────────
  // health-check watches every other cron above; without an entry here, nothing
  // watches health-check itself. This only catches a *later* successful run
  // noticing its own previous run went stale — if the route stops being invoked
  // or fails hard enough to skip even the outer try/catch, no run remains to
  // report it. Still strictly better than zero self-monitoring. Added 2026-07-18.
  "health-check":              26,   // daily 07:05
};

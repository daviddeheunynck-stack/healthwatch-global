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
 *
 * Does NOT cover Vercel occasionally invoking the same scheduled run more
 * than once — Vercel's own cron docs call this out as possible, and both
 * invocations would carry this same header, so this check alone can't tell
 * them apart. For crons whose eligibility query is a pure time window with
 * no state-changing write to naturally exclude a user on a second pass
 * (onboarding-sequence, trial-reminders, winback-sequence — unlike
 * expire-trials' plan downgrade, or regional-alerts/disease-alerts'
 * outbreak_alert_log/disease_alert_log), pair this with claimEmailSend()
 * below to close that gap. See known-findings.json entry
 * "isLiveCronInvocation-does-not-cover-vercel-duplicate-delivery" for the
 * finding this addresses.
 */
export function isLiveCronInvocation(req: NextRequest): boolean {
  const isVercelCron = req.headers.get("x-vercel-cron-schedule") !== null;
  const liveParam = req.nextUrl.searchParams.get("live") === "1";
  return isVercelCron || liveParam;
}

/**
 * Atomically claims a one-time-per-user lifecycle email send, so two
 * near-simultaneous invocations of the same cron (see isLiveCronInvocation's
 * doc above) can't both send the same email to the same user. Call this
 * immediately before the actual send — NOT after, unlike
 * outbreak_alert_log/disease_alert_log's send-then-log ordering, which
 * exists to survive a crash between send and log on a SINGLE invocation.
 * That ordering is the wrong one here: two concurrent invocations both
 * checking "not yet logged" before either logs would both pass and both
 * send. Claiming first via INSERT ... ON CONFLICT DO NOTHING means only one
 * of two racing invocations gets the row, so only one sends.
 *
 * `step` identifies the specific lifecycle touch (e.g. "j1", "j3",
 * "trial_expired") — a user can be claimed once per (cron, step) for the
 * life of their account, not once per day; these are one-shot lifecycle
 * emails, not recurring digests.
 *
 * Fails open (returns true, i.e. "go ahead and send") on any unexpected DB
 * error, including the table not existing yet — a missing migration should
 * degrade to today's un-deduped behavior, not silently stop these
 * revenue-critical emails from sending at all.
 */
export async function claimEmailSend(
  supabase: SupabaseClient,
  userId: string,
  cronName: string,
  step: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("lifecycle_email_log")
    .upsert(
      { user_id: userId, cron_name: cronName, step },
      { onConflict: "user_id,cron_name,step", ignoreDuplicates: true },
    )
    .select("user_id");
  if (error) {
    console.error(`[cron-monitor] claimEmailSend failed for ${cronName}/${step}/${userId}, sending anyway:`, error.message);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Same atomic claim-before-send pattern as claimEmailSend, but keyed on a
 * subscriptions row instead of an auth.users id. weekly-digest's audience
 * (`subscriptions.email`) is a standalone newsletter address, not always
 * tied to a real account, so it can't use lifecycle_email_log's user_id FK.
 * One claim per (subscription, calendar week) rather than per lifecycle
 * step, since this digest is meant to repeat every week for the life of the
 * subscription rather than fire once ever. Found 2026-08-04: weekly-digest
 * had no dedup at all, so a manual re-invocation (or a genuine duplicate
 * Vercel Cron trigger) resent the same week's digest to every subscriber.
 * Fails open (returns true) on any DB error, same trade-off as
 * claimEmailSend: a missing/broken table degrades to today's unguarded
 * behavior rather than silently blocking the weekly send.
 */
export async function claimWeeklyDigestSend(
  supabase: SupabaseClient,
  subscriptionId: string,
  weekOf: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("weekly_digest_log")
    .upsert(
      { subscription_id: subscriptionId, week_of: weekOf },
      { onConflict: "subscription_id,week_of", ignoreDuplicates: true },
    )
    .select("subscription_id");
  if (error) {
    console.error(`[cron-monitor] claimWeeklyDigestSend failed for ${subscriptionId}/${weekOf}, sending anyway:`, error.message);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Monday (UTC) of the current calendar week, as "YYYY-MM-DD": the dedup key
 * for claimWeeklyDigestSend. Deliberately computed from wall-clock "now"
 * rather than passed in: a real Monday 07:00 UTC trigger and a same-day
 * manual re-invocation both land in the same week and must collide.
 */
export function currentWeekOf(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
  return monday.toISOString().slice(0, 10);
}

/**
 * Ping a Better Stack heartbeat URL, but only when this run's failure rate
 * stayed under a tolerable threshold — so Better Stack's uptime score means
 * "this cron did its job", not just "the route responded". Before this,
 * every one of the 4 heartbeat-monitored crons (sync-outbreaks,
 * trial-reminders, expire-trials, onboarding-sequence) pinged unconditionally
 * regardless of `failed`/`results.errors`, so a systemic ingestion or send
 * failure could show 100% Better Stack uptime while silently losing real
 * data — the same shape of gap as the sync-outbreaks status-hardcoding bug
 * fixed earlier (see the logCronRun call site there), just for the external
 * signal instead of the internal one. Found 2026-08-03, David's call: a
 * threshold rather than "always ping" (pure reachability, catches nothing
 * business-level) or "ping only on zero errors" (flags Better Stack as down
 * for a single one-off per-item failure that Sentry already captured with
 * more context).
 *
 * `attempted === 0` (nothing to do this run) still pings — an empty run
 * isn't a failure.
 */
const HEARTBEAT_ERROR_RATE_THRESHOLD = 0.2;

export function pingHeartbeatIfHealthy(url: string | undefined, failed: number, attempted: number): void {
  if (!url) return;
  if (attempted > 0 && failed / attempted > HEARTBEAT_ERROR_RATE_THRESHOLD) return;
  fetch(url).catch(() => {});
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
  "sync-taiwan-cdc":   26,   // daily 05:00 — NIDSS dengue coverage
  "sync-malaysia-dengue": 26, // daily 06:00 — iDengue dashboard, replaces a dead one-off manual insert (2026-08-05)
  // ── Funnel canary ────────────────────────────────────────────────────────────
  // Runs the real public email/password signup once a day and deletes the
  // account immediately after: see app/api/cron/signup-canary/route.ts and
  // marketing/product-ideas-log.md, 2026-08-04, idea 2. An "error" status here
  // (surfaced by the generic `erroring` check in health-check, no bespoke
  // block needed) is the whole point: nothing else exercises this path.
  "signup-canary":     26,   // daily 05:10
  // ── Alert delivery crons ─────────────────────────────────────────────────────
  "sync-brevo-blocklist": 26, // daily 06:00 — feeds profiles.email_blocked_at before the 10:xx sends below
  "regional-alerts":   26,   // daily 10:30 (moved from 06:30 on 2026-08-03, was firing ~22h ahead of same-day sync data)
  "watchlist-alerts":  26,   // daily 10:40 (moved from 06:40 on 2026-08-03)
  "push-alerts":       26,   // daily 10:45 (moved from 06:45 on 2026-08-03)
  "disease-alerts":    26,   // daily 10:50 (moved from 06:50 on 2026-08-03)
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
  // Both added 2026-08-03 alongside the Oceania coverage-gap fix (see
  // lib/geo-extract.ts callers / sync-wpro-dengue-update route for context) —
  // registered here the same day so they don't sit unmonitored like
  // pilot-closing-reminder did for weeks before anyone noticed (see the
  // unmonitored-crons comment above). Both weekly Mon, same 1.5x-interval
  // rationale as the other three above.
  "sync-pacific-surveillance": 200, // weekly Mon 08:15 — PSSS signal, never writes to outbreaks
  "sync-wpro-dengue-update":   200, // weekly Mon 08:20 — Dengue Situation Update, writes at source_priority=6
  // Same gap, same shape: created 2026-08-12 (see its route header), scheduled
  // in vercel.json and logging runs from day one, but never added here — so
  // health-check's unmonitored-crons diff correctly caught it 2026-08-14.
  // Weekly Mon 08:25, same 1.5x-interval rationale as the two entries above.
  "sync-samoa-dengue":         200,
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

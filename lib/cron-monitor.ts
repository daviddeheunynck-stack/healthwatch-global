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
import * as Sentry from "@sentry/nextjs";

/**
 * Un CONSTAT, pas une exception.
 *
 * Distinction posée le 2026-08-23. Sentry contenait six incidents ouverts dont
 * trois n'étaient pas des erreurs : la garde anti-régression de
 * sync-who-regional signalant qu'elle avait BLOQUÉ une écriture — donc un
 * succès —, et deux rapports de sondes (`health-check` sur les canaux de
 * livraison, `sync-pacific-surveillance` sur la couverture DLI). Rien n'avait
 * planté.
 *
 * Le coût n'est pas le désordre : `/api/health` bascule `sentry: "error"` dès
 * qu'un incident non résolu existe, donc une garde qui fait son travail faisait
 * passer la santé au rouge. Une boîte d'alertes qui crie pour des succès finit
 * par être ignorée, et c'est la vraie exception qui se perd dedans.
 *
 * Les constats restent envoyés — ils ont de la valeur, et Sentry sait les
 * grouper et les dater mieux qu'un log. Ils portent simplement le tag
 * `self_report`, que lib/sentry-issues.ts exclut du calcul de santé et compte
 * à part. Garder `captureException` / `captureMessage` direct pour ce qui a
 * réellement échoué.
 */
export function captureSelfReport(
  message: string,
  opts: { source: string; level?: "info" | "warning"; tags?: Record<string, string> },
): void {
  Sentry.captureMessage(message, {
    level: opts.level ?? "info",
    tags: { ...opts.tags, self_report: "true", self_report_source: opts.source },
  });
}

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
 * Cross-cron sibling of claimWeeklyDigestSend/claimEmailSend: claims a
 * (lowercased email, calendar week) pair shared across ALL weekly sends, not
 * just one cron's own rows. weekly-digest (subscriptions.email, explicit
 * opt-in newsletter) and weekly-signal (profiles.email, every free-plan
 * account) draw from two separate tables with no shared row id, so the same
 * address can be present in both — each cron's own row-keyed claim can't see
 * that, only that its own row hasn't been claimed yet. Found 2026-08-23: an
 * address in both tables got both emails, ~10 minutes apart, every Monday.
 *
 * Call this IN ADDITION to the cron's own row-keyed claim, after it
 * succeeds — both must pass before sending. Schedule order in vercel.json
 * matters: whichever weekly cron runs first wins the address for the week.
 *
 * L'ordre a change le 2026-08-23 au soir, quand ce verrou est passe de 2 a 4
 * mailers. Il etait : weekly-digest, weekly-signal, trigger-regional-digest,
 * send-sitrep-emails — un ordre concu quand seuls les deux premiers
 * verrouillaient, et ou l'argument tenait entre eux (un opt-in explicite bat
 * une relance ambiante servie a tous les comptes gratuits).
 *
 * Etendu aux quatre, ce meme ordre faisait perdre a un client payant le
 * rapport qu'il a demande au profit d'une newsletter gratuite. L'ordre est
 * desormais : send-sitrep-emails (06:50), trigger-regional-digest (07:00),
 * weekly-digest (07:05), weekly-signal (07:20) — du plus explicitement
 * demande au plus ambiant, ce qui preserve l'argument d'origine entre digest
 * et signal tout en placant le payant devant.
 *
 * Fails open ("unevaluable", which every caller treats as granted) on any DB
 * error, same trade-off as its siblings: a missing/broken table degrades to
 * today's un-deduped-across-crons behavior, not to silently blocking the
 * weekly send.
 *
 * Reworked 2026-08-25, same evening as claimOutbreakAlertDaily above and for
 * the same reason: this helper's own comment already named the risk the day
 * before ("l'appelant ne peut pas distinguer un verrou ACCORDE d'un verrou
 * INEVALUABLE : les deux renvoient true"), and that exact failure mode then
 * turned out to be live on outbreak_alert_daily_lock — every claim silently
 * taking the error branch since the lock shipped. weekly_email_send_log
 * itself was verified NOT to be in that state (24 real rows, all four
 * mailers represented) before this rewrite, so this is a parity fix against
 * a proven risk, not a response to a second live incident. Returns AlertClaim
 * instead of a boolean for the same reason as its sibling: callers now count
 * `unevaluable` and carry the verbatim DB error into logCronRun, so a future
 * silent failure here would be readable from site_config instead of only
 * Sentry.
 */
export async function claimWeeklyEmailAddress(
  supabase: SupabaseClient,
  email: string,
  weekOf: string,
  source: string,
): Promise<AlertClaim> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("weekly_email_send_log")
    .upsert(
      { email: normalized, week_of: weekOf, source },
      { onConflict: "email,week_of", ignoreDuplicates: true },
    )
    .select("email");
  if (error) {
    console.error(`[cron-monitor] claimWeeklyEmailAddress failed for ${source}/${normalized}/${weekOf}, sending anyway:`, error.message);
    Sentry.captureException(new Error(error.message), {
      tags: { helper: "claimWeeklyEmailAddress", source },
    });
    return { state: "unevaluable", error: error.message };
  }
  return { state: (data?.length ?? 0) > 0 ? "granted" : "taken" };
}

/**
 * Relache un verrou pose par claimWeeklyEmailAddress quand l'envoi qui devait
 * le suivre n'a finalement pas eu lieu (exception Brevo, cle absente).
 *
 * Le verrou est pose AVANT l'envoi, ce qui est le bon ordre pour la course
 * entre deux invocations. Mais sans relachement, un echec cote Brevo consomme
 * la semaine du destinataire : il ne recoit rien, et une re-invocation
 * manuelle le saute puisque son adresse est deja marquee servie. Constate le
 * 2026-08-24 — un « upstream connect error » sur une seule adresse pendant
 * weekly-signal, et cette lectrice a perdu sa semaine sans trace ailleurs que
 * dans les logs Vercel.
 *
 * Le filtre sur `source` est ce qui rend l'operation sure : on ne peut
 * effacer que son propre verrou, jamais celui qu'un autre mailer a pose sur
 * la meme adresse la meme semaine.
 *
 * N'echoue jamais bruyamment : ne pas reussir a relacher rend simplement le
 * comportement identique a celui d'avant ce helper.
 */
export async function releaseWeeklyEmailAddress(
  supabase: SupabaseClient,
  email: string,
  weekOf: string,
  source: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const { error } = await supabase
    .from("weekly_email_send_log")
    .delete()
    .eq("email", normalized)
    .eq("week_of", weekOf)
    .eq("source", source);
  if (error) {
    console.error(`[cron-monitor] releaseWeeklyEmailAddress failed for ${source}/${normalized}/${weekOf}:`, error.message);
    Sentry.captureException(new Error(error.message), {
      tags: { helper: "releaseWeeklyEmailAddress", source },
    });
  }
}

/** Pendant de claimEmailSend — voir releaseWeeklyEmailAddress. */
export async function releaseEmailSend(
  supabase: SupabaseClient,
  userId: string,
  cronName: string,
  step: string,
): Promise<void> {
  const { error } = await supabase
    .from("lifecycle_email_log")
    .delete()
    .eq("user_id", userId)
    .eq("cron_name", cronName)
    .eq("step", step);
  if (error) {
    console.error(`[cron-monitor] releaseEmailSend failed for ${cronName}/${step}/${userId}:`, error.message);
    Sentry.captureException(new Error(error.message), {
      tags: { helper: "releaseEmailSend", cron: cronName },
    });
  }
}

/** Pendant de claimWeeklyDigestSend — voir releaseWeeklyEmailAddress. */
export async function releaseWeeklyDigestSend(
  supabase: SupabaseClient,
  subscriptionId: string,
  weekOf: string,
): Promise<void> {
  const { error } = await supabase
    .from("weekly_digest_log")
    .delete()
    .eq("subscription_id", subscriptionId)
    .eq("week_of", weekOf);
  if (error) {
    console.error(`[cron-monitor] releaseWeeklyDigestSend failed for ${subscriptionId}/${weekOf}:`, error.message);
    Sentry.captureException(new Error(error.message), {
      tags: { helper: "releaseWeeklyDigestSend" },
    });
  }
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
 * Today (UTC) as "YYYY-MM-DD" — the dedup key for
 * claimOutbreakAlertDaily/releaseOutbreakAlertDaily below.
 */
export function currentAlertDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cross-cron per-(user, outbreak, day) claim shared by regional-alerts,
 * watchlist-alerts and disease-alerts. Each of the three independently
 * decides whether a given outbreak is new/escalated/surged for a given user
 * and, before this, would email regardless of whether one of the other two
 * had already told that same user about that same outbreak minutes earlier
 * in the same run. Call this immediately before adding a qualifying
 * (user, outbreak) pair to the batch that will be emailed — NOT after — same
 * race-safety reasoning as claimWeeklyEmailAddress above. The three crons run
 * in specificity order (watchlist -> disease -> regional, see vercel.json),
 * so on a normal day the most targeted alert is the one that wins the claim
 * and the broader ones back off.
 *
 * Fails open ("unevaluable", which every caller treats as granted) on any DB
 * error, same trade-off as claimWeeklyEmailAddress — a missing/broken table
 * degrades to the pre-2026-08-24 un-deduped-across-crons behavior, not to
 * silently dropping the alert.
 *
 * Returns three states rather than a boolean, and this is the whole point of
 * the 2026-08-25 rewrite. The boolean conflated "claim GRANTED" with "claim
 * UNEVALUABLE" — both meant "go ahead and send" — so a lock that errored on
 * every single call was indistinguishable, from the caller's side, from a
 * lock working perfectly. That is exactly what happened in production: on
 * 2026-08-25 at 10:50 UTC regional-alerts claimed 117 pairs, emailed all of
 * them (profiles.trial_value_email_sent_at was stamped at 10:50:52.301, which
 * only the real send path does), and outbreak_alert_daily_lock stayed empty —
 * every claim had taken the error branch since the lock shipped the day
 * before. logCronRun recorded "ok", the JSON response showed normal counters,
 * and the only witness was a Sentry event nobody reads daily. Callers now
 * count `unevaluable` and carry `error` into their run log, so the DB message
 * that names the cause is readable from site_config without Sentry. The same
 * blind spot existed on claimWeeklyEmailAddress above — same rewrite applied
 * there the same evening, reusing this type, once the incident above showed
 * it wasn't hypothetical.
 */
export type AlertClaim = {
  /** granted = this cron owns the (user/address, outbreak/week) pair and must
   *  send. taken = a more specific/earlier cron already claimed it, skip the
   *  send. unevaluable = the lock could not be consulted; send anyway, but
   *  say so. */
  state: "granted" | "taken" | "unevaluable";
  /** Verbatim DB error, set only on "unevaluable". */
  error?: string;
};

export async function claimOutbreakAlertDaily(
  supabase: SupabaseClient,
  userId: string,
  outbreakId: string,
  alertDate: string,
  source: string,
): Promise<AlertClaim> {
  const { data, error } = await supabase
    .from("outbreak_alert_daily_lock")
    .upsert(
      { user_id: userId, outbreak_id: outbreakId, alert_date: alertDate, source },
      { onConflict: "user_id,outbreak_id,alert_date", ignoreDuplicates: true },
    )
    .select("user_id");
  if (error) {
    console.error(`[cron-monitor] claimOutbreakAlertDaily failed for ${source}/${userId}/${outbreakId}/${alertDate}, sending anyway:`, error.message);
    Sentry.captureException(new Error(error.message), {
      tags: { helper: "claimOutbreakAlertDaily", source },
    });
    return { state: "unevaluable", error: error.message };
  }
  return { state: (data?.length ?? 0) > 0 ? "granted" : "taken" };
}

/**
 * Releases a claim from claimOutbreakAlertDaily when the send that was
 * supposed to follow it never happened (Brevo error, missing API key) — same
 * reasoning as releaseWeeklyEmailAddress. Without this, a failed send from
 * whichever cron claimed first permanently blocks the later, broader crons
 * from ever delivering that alert for the day, since they'd see the lock as
 * already taken.
 *
 * Scoped by `source` for the same safety reason as releaseWeeklyEmailAddress:
 * a cron can only release its own claim, never one a sibling cron holds on
 * the same (user, outbreak, day).
 */
export async function releaseOutbreakAlertDaily(
  supabase: SupabaseClient,
  userId: string,
  outbreakId: string,
  alertDate: string,
  source: string,
): Promise<void> {
  const { error } = await supabase
    .from("outbreak_alert_daily_lock")
    .delete()
    .eq("user_id", userId)
    .eq("outbreak_id", outbreakId)
    .eq("alert_date", alertDate)
    .eq("source", source);
  if (error) {
    console.error(`[cron-monitor] releaseOutbreakAlertDaily failed for ${source}/${userId}/${outbreakId}/${alertDate}:`, error.message);
    Sentry.captureException(new Error(error.message), {
      tags: { helper: "releaseOutbreakAlertDaily", source },
    });
  }
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
  // ISO timestamp of the most recent run where the cron's core comparison
  // logic executed against real candidate data (e.g. disease-alerts found
  // active outbreaks matching a subscription and walked its escalation check
  // against them), regardless of whether anything crossed the alert
  // threshold. `lastNonZero` alone can't distinguish "genuinely nothing to
  // send" from "broken" for a small-audience delivery cron — that was exactly
  // the disease-alerts/watchlist-alerts shape found 2026-08-10 (single
  // subscriber, real escalation logic, legitimately quiet for weeks) that
  // motivated STALL_THRESHOLD_OVERRIDE_DAYS in health-check.ts. Carried
  // forward like lastNonZero when a run has nothing to evaluate this time.
  evaluatedAt?: string;
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
  evaluatedAt?: string,
): Promise<void> {
  const { data: prevRow } = await supabase
    .from("site_config")
    .select("value")
    .eq("key", `cron:run:${cronName}`)
    .maybeSingle();
  let prevLastNonZero: string | undefined;
  let prevEvaluatedAt: string | undefined;
  if (prevRow?.value) {
    try {
      const prev = JSON.parse(prevRow.value) as CronRun;
      prevLastNonZero = prev.lastNonZero;
      prevEvaluatedAt = prev.evaluatedAt;
    } catch { /* malformed, ignore */ }
  }

  const value: CronRun = {
    ts: new Date().toISOString(),
    status,
    rows: rowsUpdated,
    ...(rowsUpdated > 0 ? { lastNonZero: new Date().toISOString() } : prevLastNonZero ? { lastNonZero: prevLastNonZero } : {}),
    ...(errorMsg ? { error: errorMsg.slice(0, 500) } : {}),
    ...(evaluatedAt ? { evaluatedAt } : prevEvaluatedAt ? { evaluatedAt: prevEvaluatedAt } : {}),
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
  // Window raised from 26 (daily-shaped) to 200 (weekly-shaped) 2026-08-23: the route's own
  // header says "Weekly sync" / "Monday 07:30 UTC", matching its slow-moving national-bulletin
  // siblings below (sync-pacific-surveillance/wpro-dengue/samoa-dengue), but vercel.json had it
  // firing daily — 7x more than intended against 3 national government sources. Found by
  // scripts/check-cron-schedule.mjs's first run; fixed in vercel.json, not here, since the
  // comment's stated intent looks right and vercel.json looks like the thing that drifted.
  "sync-endemic-data": 200,  // Schedule: 30 7 * * 1
  "sync-usda-aphis":   26,   // daily
  "sync-taiwan-cdc":   26,   // daily 05:00 — NIDSS dengue coverage
  "sync-malaysia-dengue": 26, // Schedule: 5 6 * * * — iDengue dashboard, replaces a dead one-off manual insert (2026-08-05)
  // ── Funnel canary ────────────────────────────────────────────────────────────
  // Runs the real public email/password signup once a day and deletes the
  // account immediately after: see app/api/cron/signup-canary/route.ts and
  // marketing/product-ideas-log.md, 2026-08-04, idea 2. An "error" status here
  // (surfaced by the generic `erroring` check in health-check, no bespoke
  // block needed) is the whole point: nothing else exercises this path.
  "signup-canary":     26,   // daily 05:10
  // ── Alert delivery crons ─────────────────────────────────────────────────────
  "sync-brevo-blocklist": 26, // daily 06:00 — feeds profiles.email_blocked_at before the 10:xx sends below
  "watchlist-alerts":  26,   // daily 10:30 (moved from 06:40 on 2026-08-03, then from 10:40 to 10:30 on 2026-08-24 — most specific of the three alert crons now runs first, see outbreak_alert_daily_lock)
  "disease-alerts":    26,   // daily 10:40 (moved from 06:50 on 2026-08-03, then from 10:50 to 10:40 on 2026-08-24)
  "push-alerts":       26,   // daily 10:45 (moved from 06:45 on 2026-08-03)
  "regional-alerts":   26,   // daily 10:50 (moved from 06:30 on 2026-08-03, was firing ~22h ahead of same-day sync data; then from 10:30 to 10:50 on 2026-08-24 — broadest of the three alert crons now runs last)
  "pilot-follow-up":   26,   // Schedule: 30 8 * * *
  // Was scheduled in vercel.json and logging runs (including "error" statuses)
  // since creation, but never registered here — so health-check never looked at
  // it and an outage would have been invisible. Found 2026-07-29 by diffing the
  // cron:run:* keys in site_config against this table; health-check now reports
  // that mismatch itself instead of relying on someone thinking to check.
  "pilot-closing-reminder": 26,  // Schedule: 35 8 * * *
  "data-quality":      26,   // Schedule: 5 10 * * *
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

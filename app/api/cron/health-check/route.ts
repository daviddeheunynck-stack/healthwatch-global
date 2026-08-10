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

// Per-channel override for the "stalled" threshold below — most delivery
// channels' natural cadence tracks their own run frequency (CRON_WINDOWS), so
// deriving the threshold from that is a reasonable default. push-alerts is
// the exception: unlike disease-alerts/watchlist-alerts/regional-alerts (which
// fire on any case-count change to an EXISTING outbreak, so several days of
// silence really is suspicious), push-alerts only fires when a genuinely NEW
// outbreak row is first created (see app/api/cron/push-alerts/route.ts) —
// decoupled from how often the cron itself runs. New-outbreak creation
// happens on the order of days-to-weeks, not the ~3.25-day generic formula
// this cron's own daily 26h window would otherwise derive. Confirmed
// 2026-08-08 (again — same root cause diagnosed 2026-08-06 by the
// daily-health-check routine but never actually shipped): last real outbreak
// creation was 2026-08-04, so push-alerts correctly had nothing to send,
// and the generic threshold flagged it anyway. 14 days is generous enough to
// absorb a normal quiet stretch while still catching a genuine regression
// like the original 49-silent-day incident that motivated this whole check.
const STALL_THRESHOLD_OVERRIDE_DAYS: Record<string, number> = {
  "push-alerts": 14,
  // Same root cause, different shape: disease-alerts/watchlist-alerts dedup
  // per (user, outbreak/disease) against each subscriber's OWN last-alerted
  // state, and re-fire only on a real escalation (>=20% case surge or a
  // risk_level increase) for THAT subscriber's specific tracked items — not
  // "any change anywhere". With a small subscriber base, one person's tracked
  // items can legitimately sit flat for a while even as the product overall
  // stays healthy. Confirmed 2026-08-10: joanne.mcgovern@yale.edu (currently
  // the sole subscriber to both channels) had 0 rows sent 3 days running —
  // dry-run against live data showed every one of her 6 tracked Measles
  // outbreaks moved between -2.5% and +1.1% since her 2026-08-06 alert, and
  // her watchlisted Peru outbreak hadn't moved at all — genuinely nothing to
  // send her, not a broken pipeline.
  "disease-alerts": 14,
  "watchlist-alerts": 14,
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

// Companion to lastRealDelivery above — answers "has anyone in this audience
// actually had a chance to be delivered to yet", so a brand-new subscriber
// doesn't read as a broken cron just because the daily run hasn't come
// around since they signed up. Best-effort: a table without its own
// created_at column (user_alert_regions, at least as of 2026-08-06) or any
// query error returns false ("don't suppress") so a lookup failure never
// hides a real outage.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function allSubscribersJoinedAfter(supabase: any, table: string, runTs: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data?.created_at) return false;
  return new Date(data.created_at).getTime() > new Date(runTs).getTime();
}

// Consumer webmail + known test/dev domains — excluded so the institutional-
// subscription check below doesn't flag the six test rows already known
// (marketing/product-ideas-log.md, 2026-07-31) or the routine flow of real
// people subscribing from a personal address. Not exhaustive by design: a
// false negative here just means one institutional signup goes unflagged,
// same acceptable trade-off as the heuristic's own risk note (2026-07-31,
// idea 2) — visibility only, never a scored/automated outreach trigger.
const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "yahoo.fr", "hotmail.com", "hotmail.fr",
  "outlook.com", "outlook.fr", "icloud.com", "live.com", "live.fr",
  "aol.com", "protonmail.com", "proton.me", "gmx.com", "gmx.de",
  "mail.com", "yandex.com", "qq.com", "163.com",
  "healthwatch-global.com", "healthwatch-test.dev", "example.com",
]);

// Just the test/dev domains, not the full consumer-webmail list above — used
// to filter out disposable prod accounts (e2e/test scripts, diagnostic
// probes) from guards where a real gmail.com/yahoo.fr user is exactly what
// must NOT be filtered (unlike the institutional check, most of the real
// user base is on consumer domains). See alert_locale drift guard below.
const TEST_EMAIL_DOMAINS = new Set(["healthwatch-global.com", "healthwatch-test.dev", "example.com"]);

interface InstitutionalSubscription { email: string; region: string; createdAt: string }

// The public /subscribe form produces a non-consumer-domain address roughly
// once every six or seven weeks (2026-07-31 measurement: 2 in ~10 weeks,
// jalal.nourlil@pasteur.ma and iqakhtar@iom.int) — the IOM one sat unnoticed
// for hours because nothing surfaces it anywhere, discovered by chance while
// looking for something else. This never scores or ranks anything: seeing an
// address is not consent to be prospected, and the decision to reach out
// stays David's. See marketing/product-ideas-log.md, 2026-07-31, idea 2.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkInstitutionalSubscriptions(supabase: any): Promise<{ rows: InstitutionalSubscription[]; error: string | null }> {
  const since = new Date(Date.now() - 26 * 3_600_000).toISOString(); // 26h: daily cadence + cron-jitter buffer
  const { data, error } = await supabase
    .from("subscriptions")
    .select("email, region, created_at")
    .gte("created_at", since);
  if (error) return { rows: [], error: error.message };
  const rows: InstitutionalSubscription[] = (data ?? [])
    .filter((r: { email: string | null }) => {
      const domain = r.email?.split("@")[1]?.toLowerCase();
      return !!domain && !CONSUMER_EMAIL_DOMAINS.has(domain);
    })
    .map((r: { email: string; region: string; created_at: string }) => ({ email: r.email, region: r.region, createdAt: r.created_at }));
  return { rows, error: null };
}

interface StuckInvite { email: string; organization: string | null; daysSinceInvite: number }

// ZABRE and Mulamba are the two original stuck invites that motivated this
// check (see the comment below) — David has repeatedly, explicitly decided
// (2026-07-23, reaffirmed since) to wait passively for them to reach back out
// themselves: no re-sent magic links, no follow-up, and not to be surfaced as
// "needs unblocking". This check's daily re-flagging of the same two known,
// already-decided cases was exactly that, so they're excluded here — found
// 2026-08-03. Anyone else stuck is a genuinely new case and still gets
// flagged; if either of these two ever signs in, they drop out of the
// underlying query on their own and this list stops matching anything.
const STUCK_INVITE_KNOWN_WAITING = new Set([
  "zrhyacinthe2@gmail.com",
  "davmulambamangole@gmail.com",
]);

// The path-not-the-stock lesson (2026-08-02): three July fixes each only
// applied to accounts created afterward, so ZABRE/Mulamba/ouedraogodaouda2408
// sat with a broken invite link for weeks before anyone noticed. Rather than
// a hand-maintained "did we fix the stock" checklist, which rots the moment
// it's written (that was the actual objection raised the same day), this
// re-runs the ZABRE-shaped check live every day: any admin-invited pilot,
// invited more than 3 days ago (grace period for a fresh invite), who has
// never once signed in. Catches the *next* stuck invite before it becomes a
// multi-week saga, instead of auditing the last one.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkStuckPilotInvites(supabase: any): Promise<{ invites: StuckInvite[]; error: string | null }> {
  const { data: pilots, error } = await supabase
    .from("profiles")
    .select("id, email, pilot_organization, created_at")
    .eq("is_pilot", true)
    .is("stripe_subscription_id", null);
  if (error) return { invites: [], error: error.message };
  if (!pilots || pilots.length === 0) return { invites: [], error: null };

  const threeDaysAgo = Date.now() - 3 * 86_400_000;
  const candidates = pilots.filter((p: { created_at: string }) => new Date(p.created_at).getTime() < threeDaysAgo);

  const invites: StuckInvite[] = [];
  for (const p of candidates as { id: string; email: string; pilot_organization: string | null; created_at: string }[]) {
    if (STUCK_INVITE_KNOWN_WAITING.has(p.email.toLowerCase())) continue;
    const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(p.id);
    if (userErr) continue; // best-effort — a lookup failure here shouldn't hide the others
    if (!userRes?.user?.last_sign_in_at) {
      invites.push({
        email: p.email,
        organization: p.pilot_organization,
        daysSinceInvite: Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000),
      });
    }
  }
  return { invites, error: null };
}

// Confirms the click→visit chain measured 2026-07-31 (Brevo click timestamp
// to product_events row, 8-10s apart, 4/4 real visits on the window) is still
// the shape of things — informational only, no target/threshold exists yet
// to alert against. Same Brevo call shape as lib/brevo-blocklist.ts.
//
// Found 2026-08-03: a corporate email security gateway prefetches every link
// in a message to scan it, GET-only, all at once — the IOM's own gateway hit
// 3 distinct links (dashboard, pricing, unsubscribe) on the same messageId
// within 98ms and, unfiltered, that reads as the best buying signal ever
// recorded (a "pricing" click that had never once happened before). Real
// clicks in the 24/07-31/07 sample were 8-10s apart; a rafale — ≥2 distinct
// links on one messageId inside RAFALE_WINDOW_MS — is the bot signature, not
// a fast human. The whole messageId's clicks are dropped from the count
// rather than guessing which ones were "real", since the gateway can also
// prefetch a single link with no human follow-up at all.
const RAFALE_WINDOW_MS = 2_000;

async function fetchClickVisitRatio(apiKey: string): Promise<{ clicks: number | null; visits: number | null; botClicksExcluded: number | null }> {
  try {
    const res = await fetch(
      "https://api.brevo.com/v3/smtp/statistics/events?event=clicks&days=7&limit=500",
      { headers: { "api-key": apiKey }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return { clicks: null, visits: null, botClicksExcluded: null };
    const body = (await res.json()) as { events?: { messageId?: string; link?: string; date?: string }[] };
    const events = body.events ?? [];

    const byMessage = new Map<string, { link?: string; ts: number }[]>();
    for (const e of events) {
      if (!e.messageId || !e.date) continue;
      const list = byMessage.get(e.messageId) ?? [];
      list.push({ link: e.link, ts: new Date(e.date).getTime() });
      byMessage.set(e.messageId, list);
    }

    let botClicksExcluded = 0;
    let clicks = 0;
    for (const list of byMessage.values()) {
      list.sort((a, b) => a.ts - b.ts);
      const distinctLinks = new Set(list.map((c) => c.link)).size;
      const span = list[list.length - 1].ts - list[0].ts;
      const isRafale = distinctLinks >= 2 && span < RAFALE_WINDOW_MS;
      if (isRafale) botClicksExcluded += list.length;
      else clicks += list.length;
    }

    return { clicks, visits: null, botClicksExcluded };
  } catch {
    // best-effort — a Brevo hiccup shouldn't fail the whole report
    return { clicks: null, visits: null, botClicksExcluded: null };
  }
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

// The viability go/no-go decision date — see [[project_hwg_viability_decision_window_2026_07_24]].
// A trial ending after this date will never get its conversion ask before
// the decision is made from whatever data exists on that day. Found
// 2026-08-02: Institut Pasteur (jalal.nourlil@pasteur.ma, trial_ends_at
// 2026-09-13, is_pilot=false) sits outside every automated conversion path
// — pilot-closing-reminder filters on is_pilot, trial-reminders/winback fire
// off trial_ends_at itself, all three weeks after the decision. General
// case, not a Pasteur-specific fix: any trial extended (manually or by a
// future bug) past this date is invisible to the same three mechanisms.
const VIABILITY_DECISION_DATE = "2026-08-21";

// David declined to act on the Institut Pasteur case (is_pilot=true vs.
// contact outside the product) — 2026-08-03, "oublie Pasteur" then "ça
// disparait" when it kept showing up here. Same shape as
// STUCK_INVITE_KNOWN_WAITING below: a decided, not-actionable case excluded
// so daily re-surfacing doesn't nag about something already settled. If this
// address is ever re-enrolled in another trial or Pasteur trial_ends_at
// changes, it re-evaluates on its own — this is a one-off dismissal, not a
// standing "ignore this account" rule.
//
// ZABRE/Mulamba added the same day for the identical reason — see
// STUCK_INVITE_KNOWN_WAITING's comment for the full "wait passively, don't
// touch" history. That set excludes them from the *login* check; this one is
// a different check (trial_ends_at past the decision horizon) that happens
// to also catch them, so it needs its own entry rather than inheriting the
// other set's exclusion.
const DECISION_HORIZON_DISMISSED = new Set([
  "jalal.nourlil@pasteur.ma",
  "zrhyacinthe2@gmail.com",
  "davmulambamangole@gmail.com",
]);

interface DecisionHorizonTrial { email: string; trialEndsAt: string; isPilot: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkDecisionHorizonTrials(supabase: any): Promise<{ trials: DecisionHorizonTrial[]; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("email, trial_ends_at, is_pilot")
    .in("plan", ["starter", "pro", "team", "enterprise"])
    .is("stripe_subscription_id", null)
    .gt("trial_ends_at", VIABILITY_DECISION_DATE);
  if (error) return { trials: [], error: error.message };
  const trials: DecisionHorizonTrial[] = (data ?? [])
    .filter((p: { email: string | null }) => !!p.email && !DECISION_HORIZON_DISMISSED.has(p.email.toLowerCase()))
    .map((p: { email: string; trial_ends_at: string; is_pilot: boolean | null }) =>
      ({ email: p.email, trialEndsAt: p.trial_ends_at, isPilot: !!p.is_pilot }));
  return { trials, error: null };
}

// Informational only — this table is genuinely bimodal today (0 regions or
// all 5, nothing between), which is either "personalization nobody uses" or
// "the flood risk from 2026-07-27/28" depending on how you read it. No
// threshold to alert on; just keeps the shape visible without a hand-run
// query. See marketing/product-ideas-log.md, 2026-07-28 idea 1 and 2026-08-02
// idea 3 — the flood risk itself is already mitigated (regional-alerts
// batches to one email/user/run and caps at MAX_DIGEST_ITEMS_PER_EMAIL, see
// 8641ba1/e7f78f2), so this is pure visibility, not a call to action.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRegionEnrollmentStock(supabase: any): Promise<{ zero: number; partial: number; full: number; error: string | null }> {
  const { data: allProfiles, error: profErr } = await supabase.from("profiles").select("id");
  if (profErr) return { zero: 0, partial: 0, full: 0, error: profErr.message };
  const { data: regionRows, error: regionErr } = await supabase.from("user_alert_regions").select("user_id");
  if (regionErr) return { zero: 0, partial: 0, full: 0, error: regionErr.message };

  const countByUser = new Map<string, number>();
  for (const r of (regionRows ?? []) as { user_id: string }[]) {
    countByUser.set(r.user_id, (countByUser.get(r.user_id) ?? 0) + 1);
  }
  let zero = 0, partial = 0, full = 0;
  for (const p of (allProfiles ?? []) as { id: string }[]) {
    const n = countByUser.get(p.id) ?? 0;
    if (n === 0) zero++;
    else if (n >= 5) full++;
    else partial++;
  }
  return { zero, partial, full, error: null };
}

interface AuthFailureSummary { flow: string; method: string; errorCode: string; count: number }

// Reads what app/[locale]/signup/page.tsx and app/[locale]/login/page.tsx
// started writing on 2026-08-04 (see auth_failures migration and
// track-auth-failure/route.ts). Only is_system rows count: a wrong
// password or an already-registered email is the person, not the product,
// and counting those would make this cry wolf within days, same lesson as
// the alert_locale drift guard above. No "zero success" comparison: at 1-2
// real email signups a month, any system-classified failure is itself worth
// seeing, so a plain count replaces a threshold. See
// marketing/product-ideas-log.md, 2026-08-04, idea 1.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAuthFailures(supabase: any): Promise<{ failures: AuthFailureSummary[]; error: string | null }> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("auth_failures")
    .select("flow, method, error_code")
    .eq("is_system", true)
    .gte("created_at", since);
  if (error) return { failures: [], error: error.message };

  const counts = new Map<string, AuthFailureSummary>();
  for (const r of (data ?? []) as { flow: string; method: string; error_code: string }[]) {
    const key = `${r.flow}:${r.method}:${r.error_code}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { flow: r.flow, method: r.method, errorCode: r.error_code, count: 1 });
  }
  return { failures: Array.from(counts.values()).sort((a, b) => b.count - a.count), error: null };
}

const BUNDLE_SECRET_PATTERNS = ["sb_secret_", "service_role", "sk_live_", "rk_live_", "whsec_", "xkeysib-", "sntrys_"];
const BUNDLE_SCAN_PAGES = ["/en", "/en/signup", "/en/pricing", "/en/account"];
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://healthwatch-global.com").trim();

interface BundleSecretMatch { page: string; chunk: string; pattern: string }

// The 2026-08-04 leak (a Supabase secret key inlined into
// NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel) was never in the repo or its git
// history: daily-security-audit's grep is structurally blind to it, since
// the defect was in an env var's *value*, not its name or any line of code.
// Only checking what's actually served can catch this class of leak. Best-
// effort and intentionally narrow: only chunks referenced by these four
// pages are scanned, so a secret inlined into a rarely-hit route would slip
// through: a net, not a proof of absence. See
// marketing/product-ideas-log.md, 2026-08-04, idea 3.
async function scanDeployedBundleForSecrets(): Promise<{ matches: BundleSecretMatch[]; error: string | null }> {
  try {
    const matches: BundleSecretMatch[] = [];
    const seenChunks = new Set<string>();
    for (const page of BUNDLE_SCAN_PAGES) {
      const res = await fetch(`${APP_URL}${page}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const html = await res.text();
      const srcs = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
      for (const src of srcs) {
        const chunkUrl = src.startsWith("http") ? src : `${APP_URL}${src}`;
        if (seenChunks.has(chunkUrl)) continue;
        seenChunks.add(chunkUrl);
        const chunkRes = await fetch(chunkUrl, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
        if (!chunkRes?.ok) continue;
        const js = await chunkRes.text();
        for (const pattern of BUNDLE_SECRET_PATTERNS) {
          if (js.includes(pattern)) matches.push({ page, chunk: chunkUrl, pattern });
        }
      }
    }
    return { matches, error: null };
  } catch (err) {
    return { matches: [], error: err instanceof Error ? err.message : String(err) };
  }
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

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    [{ count: total }, { count: high }, { count: pheic }, { data: configRows }],
    sentryCheck,
    audienceCounts,
    zeroRegionResult,
    institutionalResult,
    stuckInviteResult,
    decisionHorizonResult,
    regionEnrollmentStock,
    alertLocaleDriftResult,
    clickVisitResult,
    { count: visits7d },
    authFailureResult,
    bundleSecretResult,
  ] = await Promise.all([
      Promise.all([
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true).eq("risk_level", "high"),
        supabase.from("outbreaks").select("*", { count: "exact", head: true }).eq("active", true).eq("is_pheic", true),
        supabase.from("site_config").select("key,value").like("key", "cron:run:%"),
      ]),
      fetchSentryIssues(),
      // "subscriptions" (weekly-digest/weekly-signal) only counts active=true —
      // matches what those two crons themselves query as their send list.
      // country_risk_alerts/geofence_alerts/category_alerts only count
      // confirmed_at IS NOT NULL (added 2026-08-08, double opt-in on the
      // free-text email field) — an unconfirmed row can never fire by
      // design, so counting it as "audience" would eventually make the
      // never-delivered check below flag a row that's correctly, permanently
      // pending as a false delivery outage. Every other audience table here
      // has no such flag of its own.
      Promise.all(AUDIENCE_TABLES.map((table) =>
        table === "subscriptions"
          ? supabase.from(table).select("*", { count: "exact", head: true }).eq("active", true)
          : ["country_risk_alerts", "geofence_alerts", "category_alerts"].includes(table)
          ? supabase.from(table).select("*", { count: "exact", head: true }).not("confirmed_at", "is", null)
          : supabase.from(table).select("*", { count: "exact", head: true }),
      )),
      checkZeroRegionTrials(supabase),
      checkInstitutionalSubscriptions(supabase),
      checkStuckPilotInvites(supabase),
      checkDecisionHorizonTrials(supabase),
      fetchRegionEnrollmentStock(supabase),
      // Regression guard for the 2026-08-02 fix (22c0fb1): any row still (or
      // again) drifted — locale set but alert_locale stuck on its own DEFAULT
      // 'en' — means the fix regressed or a new write path skipped it, not
      // that the one-off backfill missed something (that part's done).
      supabase.from("profiles").select("email, locale, alert_locale").neq("locale", "en").eq("alert_locale", "en"),
      brevoKey ? fetchClickVisitRatio(brevoKey) : Promise.resolve({ clicks: null, visits: null, botClicksExcluded: null }),
      supabase.from("product_events").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      checkAuthFailures(supabase),
      scanDeployedBundleForSecrets(),
    ]);

  const zeroRegionTrials    = zeroRegionResult.trials;
  const zeroRegionError     = zeroRegionResult.error;
  const hasZeroRegionTrials = zeroRegionTrials.length > 0;

  const institutionalSubs  = institutionalResult.rows;
  const institutionalError = institutionalResult.error;
  const hasInstitutionalSubs = institutionalSubs.length > 0;

  const stuckInvites    = stuckInviteResult.invites;
  const stuckInviteError = stuckInviteResult.error;
  const hasStuckInvites  = stuckInvites.length > 0;

  const decisionHorizonTrials    = decisionHorizonResult.trials;
  const decisionHorizonError     = decisionHorizonResult.error;
  const hasDecisionHorizonTrials = decisionHorizonTrials.length > 0;

  // Excludes healthwatch-test.dev and other known test/dev domains — a
  // verification script for this very guard wrote 5 disposable accounts to
  // prod on 2026-08-03 and, unfiltered, they'd have made this alert cry
  // "regression" every morning even though the real drift it exists to
  // catch was already fixed. See marketing/product-ideas-log.md, 2026-08-03, idea 3.
  const alertLocaleDrift    = (alertLocaleDriftResult.data ?? []).filter(
    (r: { email: string }) => !TEST_EMAIL_DOMAINS.has((r.email.split("@")[1] ?? "").toLowerCase())
  );
  const alertLocaleDriftErr = alertLocaleDriftResult.error?.message ?? null;
  const hasAlertLocaleDrift = alertLocaleDrift.length > 0;

  const clickVisitRatio = {
    clicks: clickVisitResult.clicks,
    visits: visits7d ?? null,
    botClicksExcluded: clickVisitResult.botClicksExcluded,
  };

  const authFailures      = authFailureResult.failures;
  const authFailureError  = authFailureResult.error;
  const hasAuthFailures   = authFailures.length > 0;

  const bundleSecretMatches = bundleSecretResult.matches;
  const bundleSecretError   = bundleSecretResult.error;
  const hasBundleSecrets    = bundleSecretMatches.length > 0;

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
      if (!run || (run.rows ?? 0) === 0) {
        // Don't cry wolf for a subscriber who joined after the cron's own
        // last logged run — they haven't had a single opportunity to be
        // delivered to yet. Found 2026-08-06: joanne.mcgovern@yale.edu
        // subscribed to disease-alerts/watchlist-alerts at 23:2x UTC on
        // 2026-08-05; both crons had last run 10:4x/10:5x UTC that same day
        // (before she signed up), and this check read them as broken. Only
        // suppress when the run actually happened AND every current
        // subscriber postdates it — anyone who predates the last run and
        // still got nothing is a real issue and still gets flagged.
        const tooNewForDelivery = run?.ts ? await allSubscribersJoinedAfter(supabase, table, run.ts) : false;
        if (!tooNewForDelivery) deliveryIssues.push({ name, audience, kind: "never" });
      }
      continue;
    }
    const daysSinceDelivery = (Date.now() - new Date(effectiveLastNonZero).getTime()) / 86_400_000;
    const windowH = CRON_WINDOWS[name] ?? 26;
    const stallThresholdDays = STALL_THRESHOLD_OVERRIDE_DAYS[name] ?? Math.max(3, (windowH / 24) * 3);
    if (daysSinceDelivery > stallThresholdDays) {
      deliveryIssues.push({ name, audience, kind: "stalled" });
    }
  }
  const deliveryAlert = deliveryIssues.length > 0;

  // institutionalSubs/hasInstitutionalSubs deliberately excluded — a real
  // institutional signup is good news, not a fault, and shouldn't turn the
  // report red. hasStuckInvites/hasAlertLocaleDrift are regression guards on
  // real past bugs and do count toward the alert state.
  const emoji = hasOverdue || hasUnmonitored || hasErroring || audienceErrors.length > 0 || sentryAlert || deliveryAlert || hasZeroRegionTrials || hasStuckInvites || hasAlertLocaleDrift || hasAuthFailures || hasBundleSecrets || (pheic ?? 0) > 0 ? "⚠️" : "✅";

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

  const stuckInviteRows = stuckInvites
    .map(({ email, organization, daysSinceInvite }) => `<tr>
      <td style="padding:3px 8px 3px 0;color:#94a3b8;font-size:12px">${esc(email)}${organization ? ` (${esc(organization)})` : ""}</td>
      <td style="padding:3px 0;font-size:12px;color:#f87171;font-weight:700">jamais connecté — invité il y a ${daysSinceInvite}j</td>
    </tr>`)
    .join("");

  const alertLocaleDriftRows = alertLocaleDrift
    .map(({ email, locale, alert_locale }: { email: string; locale: string; alert_locale: string }) => `<tr>
      <td style="padding:3px 8px 3px 0;color:#94a3b8;font-size:12px">${esc(email)}</td>
      <td style="padding:3px 0;font-size:12px;color:#f87171;font-weight:700">locale=${esc(locale)} / alert_locale=${esc(alert_locale)}</td>
    </tr>`)
    .join("");

  const authFailureRows = authFailures
    .map(({ flow, method, errorCode, count }) => `<tr>
      <td style="padding:3px 8px 3px 0;color:#94a3b8;font-size:12px">${esc(flow)}/${esc(method)}</td>
      <td style="padding:3px 8px;font-size:12px;color:#94a3b8">${esc(errorCode)}</td>
      <td style="padding:3px 0;font-size:12px;color:#f87171;font-weight:700">${count}×</td>
    </tr>`)
    .join("");

  const bundleSecretRows = bundleSecretMatches
    .map(({ page, chunk, pattern }) => `<tr>
      <td style="padding:3px 8px 3px 0;color:#94a3b8;font-size:12px">${esc(page)}</td>
      <td style="padding:3px 8px;font-size:12px;color:#f87171;font-weight:700">${esc(pattern)}</td>
      <td style="padding:3px 0;font-size:12px;color:#64748b;word-break:break-all">${esc(chunk)}</td>
    </tr>`)
    .join("");

  const institutionalSubRows = institutionalSubs
    .map(({ email, region, createdAt }) => `<tr>
      <td style="padding:3px 8px 3px 0;color:#94a3b8;font-size:12px">${esc(email)}</td>
      <td style="padding:3px 8px;font-size:12px;color:#94a3b8">${esc(region)}</td>
      <td style="padding:3px 0;font-size:12px;color:#64748b">${esc(new Date(createdAt).toLocaleString("fr-FR"))}</td>
    </tr>`)
    .join("");

  const html = `
<div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
  <p style="font-size:16px;font-weight:700;color:#60a5fa;margin:0 0 16px">HealthWatch — Health Check ${emoji}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
    <tr><td style="padding:6px 0;color:#94a3b8">Foyers actifs</td><td style="padding:6px 0;font-weight:600">${total ?? "?"}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8">Risque HIGH</td><td style="padding:6px 0;font-weight:600;color:#f87171">${high ?? "?"}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8">PHEIC actifs</td><td style="padding:6px 0;font-weight:600;color:#c084fc">${pheic ?? "?"}${(pheic ?? 0) > 0 ? " ⚠️" : ""}</td></tr>
    <tr><td style="padding:6px 0;color:#94a3b8">Clics email → visites (7j)</td><td style="padding:6px 0;font-weight:600">${clickVisitRatio.clicks ?? "?"} → ${clickVisitRatio.visits ?? "?"}${clickVisitRatio.botClicksExcluded ? ` <span style="color:#64748b;font-weight:400">(${clickVisitRatio.botClicksExcluded} clic(s) scanner exclu(s))</span>` : ""}</td></tr>
    ${bundleSecretError ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔧 Balayage secrets du bundle déployé impossible : ${esc(bundleSecretError)}</td></tr>` : ""}
    ${hasBundleSecrets ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">🔴 SECRET EXPOSÉ dans le bundle JS déployé, ${bundleSecretMatches.length} occurrence(s), voir détail ci-dessous</td></tr>` : ""}
    ${authFailureError ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔧 Contrôle « échecs auth système » impossible : ${esc(authFailureError)}</td></tr>` : ""}
    ${hasAuthFailures ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">⚠️ ${authFailures.reduce((n, f) => n + f.count, 0)} échec(s) d'inscription/connexion de type système (24h)</td></tr>` : ""}
    ${regionEnrollmentStock.error
      ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔧 Contrôle « répartition régions d'alerte » impossible : ${esc(regionEnrollmentStock.error)}</td></tr>`
      : `<tr><td style="padding:6px 0;color:#94a3b8">Régions d'alerte (comptes)</td><td style="padding:6px 0;font-weight:600">${regionEnrollmentStock.zero} à 0 · ${regionEnrollmentStock.partial} entre les deux · ${regionEnrollmentStock.full} à 5</td></tr>`}
    ${hasStuckInvites ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">⚠️ ${stuckInvites.length} pilote(s) invité(s) jamais connecté(s) — même trou que ZABRE/Mulamba/ouedraogodaouda2408</td></tr>` : ""}
    ${decisionHorizonError ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔧 Contrôle « essais après l'horizon de décision » impossible : ${esc(decisionHorizonError)}</td></tr>` : ""}
    ${hasDecisionHorizonTrials ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔔 ${decisionHorizonTrials.length} essai(s) dont l'échéance dépasse le ${VIABILITY_DECISION_DATE} — aucun mécanisme automatisé (trial-reminders/winback/pilot-closing) ne les touche avant la décision : ${esc(decisionHorizonTrials.map((t) => `${t.email}${t.isPilot ? " (pilote)" : ""} (${t.trialEndsAt.slice(0, 10)})`).join(", "))}</td></tr>` : ""}
    ${alertLocaleDriftErr ? `<tr><td colspan="2" style="padding:8px 0;color:#fbbf24;font-weight:700">🔧 Contrôle « dérive alert_locale » impossible : ${esc(alertLocaleDriftErr)}</td></tr>` : ""}
    ${hasAlertLocaleDrift ? `<tr><td colspan="2" style="padding:8px 0;color:#f87171;font-weight:700">⚠️ ${alertLocaleDrift.length} compte(s) avec alert_locale de nouveau désynchronisé — régression possible du fix du 02/08</td></tr>` : ""}
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
  ${stuckInviteRows ? `
  <p style="font-size:12px;color:#f87171;margin:16px 0 8px;font-weight:600">⚠️ Invitations pilote jamais ouvertes</p>
  <table style="width:100%;border-collapse:collapse">${stuckInviteRows}</table>` : ""}
  ${alertLocaleDriftRows ? `
  <p style="font-size:12px;color:#f87171;margin:16px 0 8px;font-weight:600">⚠️ Comptes alert_locale désynchronisé</p>
  <table style="width:100%;border-collapse:collapse">${alertLocaleDriftRows}</table>` : ""}
  ${bundleSecretRows ? `
  <p style="font-size:12px;color:#f87171;margin:16px 0 8px;font-weight:600">🔴 Secret(s) détecté(s) dans le bundle JS servi publiquement</p>
  <table style="width:100%;border-collapse:collapse">${bundleSecretRows}</table>` : ""}
  ${authFailureRows ? `
  <p style="font-size:12px;color:#f87171;margin:16px 0 8px;font-weight:600">⚠️ Échecs d'inscription/connexion système (24h)</p>
  <table style="width:100%;border-collapse:collapse">${authFailureRows}</table>` : ""}
  ${institutionalError ? `
  <p style="font-size:12px;color:#fbbf24;margin:16px 0 8px;font-weight:600">🔧 Contrôle « abonnement institutionnel » impossible : ${esc(institutionalError)}</p>` : ""}
  ${institutionalSubRows ? `
  <p style="font-size:12px;color:#60a5fa;margin:16px 0 8px;font-weight:600">🔔 Abonnement(s) sur domaine non grand public (24h) — visibilité seule, aucune action automatique</p>
  <table style="width:100%;border-collapse:collapse">${institutionalSubRows}</table>` : ""}
  <p style="margin-top:16px;font-size:11px;color:#475569">${new Date().toISOString()}</p>
</div>`;

  const subject = `${emoji}${hasBundleSecrets ? " 🔴 SECRET EXPOSÉ" : ""} HealthWatch — ${total ?? "?"} foyers${hasOverdue ? ` · ${overdue.length} cron(s) en retard` : ""}${sentryIssues.length > 0 ? ` · ${sentryIssues.length} erreur(s) Sentry` : ""}${deliveryAlert ? ` · ${deliveryIssues.length} canal(aux) en panne` : ""}${hasZeroRegionTrials ? ` · ${zeroRegionTrials.length} essai(s) sans région` : ""}${hasStuckInvites ? ` · ${stuckInvites.length} invite(s) bloquée(s)` : ""}${hasAuthFailures ? ` · ${authFailures.reduce((n, f) => n + f.count, 0)} échec(s) auth système` : ""}${hasInstitutionalSubs ? ` · 🔔 ${institutionalSubs.length} abonnement(s) institutionnel(s)` : ""}${hasDecisionHorizonTrials ? ` · 🔔 ${decisionHorizonTrials.length} essai(s) après le ${VIABILITY_DECISION_DATE}` : ""} · ${new Date().toLocaleDateString("fr-FR")}`;

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

  // Highest severity of anything this route checks: a live, publicly
  // exposed secret, not just a stalled cron. "error" level (not "warning"
  // like the two above) so it doesn't get lost among routine overdue-cron
  // noise. See marketing/product-ideas-log.md, 2026-08-04, idea 3.
  if (hasBundleSecrets && isRealProduction) {
    Sentry.captureMessage(
      `[health-check] SECRET EXPOSED in deployed JS bundle: ${bundleSecretMatches.map((m) => `${m.pattern}@${m.page}`).join(", ")}`,
      "error",
    );
  }

  if (hasAuthFailures && isRealProduction) {
    Sentry.captureMessage(
      `[health-check] ${authFailures.reduce((n, f) => n + f.count, 0)} system-classified signup/login failure(s) in 24h: ${authFailures.map((f) => `${f.flow}/${f.method}:${f.errorCode}(${f.count})`).join(", ")}`,
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
    ok: !hasOverdue && !hasUnmonitored && !hasErroring && !sentryAlert && !deliveryAlert && !hasZeroRegionTrials && !hasStuckInvites && !hasAlertLocaleDrift && !hasAuthFailures && !hasBundleSecrets,
    unmonitored,
    erroring,
    total, high, pheic, overdue, cronStatuses, isRealProduction,
    sentry: { ok: sentryCheck.ok, issueCount: sentryIssues.length, error: sentryCheck.error },
    delivery: deliveryIssues,
    zeroRegionTrials: { count: zeroRegionTrials.length, trials: zeroRegionTrials, error: zeroRegionError },
    stuckPilotInvites: { count: stuckInvites.length, invites: stuckInvites, error: stuckInviteError },
    alertLocaleDrift: { count: alertLocaleDrift.length, rows: alertLocaleDrift, error: alertLocaleDriftErr },
    institutionalSubscriptions: { count: institutionalSubs.length, rows: institutionalSubs, error: institutionalError },
    decisionHorizonTrials: { count: decisionHorizonTrials.length, trials: decisionHorizonTrials, error: decisionHorizonError, horizon: VIABILITY_DECISION_DATE },
    regionEnrollmentStock,
    clickVisitRatio,
    authFailures: { count: authFailures.reduce((n, f) => n + f.count, 0), breakdown: authFailures, error: authFailureError },
    bundleSecrets: { count: bundleSecretMatches.length, matches: bundleSecretMatches, error: bundleSecretError },
  });
}

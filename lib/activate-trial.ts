import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { buildSignupDigestEmail } from "@/lib/signup-digest-email";
import { isRealProduction } from "@/lib/cron-monitor";

const TRIAL_DAYS = 14;
const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
export const ALL_REGIONS = ["africa", "asia", "americas", "europe", "oceania"] as const;

const BREVO_API_KEY = (process.env.BREVO_API_KEY || "").trim();
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://healthwatch-global.com").trim();

async function sendEmail(to: string, subject: string, html: string) {
  // Throw rather than return silently: this is a user-facing alert email whose
  // outbreak_alert_log rows are already written by the time we get here, so a
  // silent skip would permanently suppress those outbreaks for the user without
  // ever delivering the digest. Same choice as lib/../cron/regional-alerts.
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not set");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo error: ${await res.text()}`);
}

interface ActivateTrialResult {
  activated: boolean;
  trial_ends_at?: string;
}

// Shared by every path that can grant Pro access (standard 14-day trial via
// activateTrial() below, admin-invited pilots, self-serve pilot confirmation).
// One retry on transient failure before giving up — found 2026-07-25: a real
// signup silently ended up with 0 alert regions for their whole trial with no
// Sentry trace, because the captureException below used to fire without a
// flush and never reached Sentry in the serverless function before it exited.
// Previously reimplemented separately in admin/invite and pilot/confirm
// (2026-08-01 consolidation) — a fix to the retry/reporting logic used to
// require updating three copies in lockstep.
export async function enrollAlertRegions(
  admin: SupabaseClient,
  userId: string,
  source: string,
  regions: readonly string[] = ALL_REGIONS
): Promise<boolean> {
  const alertRows = regions.map((region) => ({ user_id: userId, region, min_risk: "medium" }));

  let { error } = await admin
    .from("user_alert_regions")
    .upsert(alertRows, { onConflict: "user_id,region", ignoreDuplicates: true });

  if (error) {
    console.error(`[${source}] alert enrollment failed, retrying once:`, error.message);
    ({ error } = await admin
      .from("user_alert_regions")
      .upsert(alertRows, { onConflict: "user_id,region", ignoreDuplicates: true }));
  }

  if (error) {
    console.error(`[${source}] default alert enrollment failed after retry:`, error);
    Sentry.captureException(new Error(`[${source}] alert enrollment failed: ${error.message}`), {
      tags: { user_id: userId },
    });
    await Sentry.flush(2000);
    return false;
  }

  return true;
}

// Shared by every path that can grant a new trial (signup form → /api/activate-trial,
// and Google OAuth → auth/callback). Found 2026-08-01: auth/callback used to
// set plan/trial_ends_at itself without calling this, which both skipped the alert
// enrollment below AND permanently blocked it afterwards — the idempotence guard
// treats any account with trial_ends_at set as already activated. Every trial-granting
// path must go through here so enrollment can never again be skipped this way.
export async function activateTrial(
  admin: SupabaseClient,
  user: { id: string; email?: string | null },
  options: { priorityRegion?: (typeof ALL_REGIONS)[number] | null } = {}
): Promise<ActivateTrialResult> {
  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("plan, trial_ends_at, alert_locale")
    .eq("id", user.id)
    .single();

  if (fetchErr) {
    throw new Error(`activateTrial: profile fetch failed: ${fetchErr.message}`);
  }

  // Idempotent — only activate once, and only for free users
  if (profile?.plan !== "free" || profile.trial_ends_at) {
    return { activated: false };
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ plan: "pro", trial_ends_at: trialEndsAt })
    .eq("id", user.id);

  if (updateErr) {
    console.error("[activate-trial] update failed:", updateErr);
    Sentry.captureException(new Error(`[activate-trial] DB update failed: ${updateErr.message}`), {
      tags: { user_id: user.id },
    });
    await Sentry.flush(2000);
    throw new Error(`activateTrial: profile update failed: ${updateErr.message}`);
  }

  // Default-enroll every new trial into regional alerts (opt-out, not opt-in).
  // Before this, 0 of the 11 real signups ever configured an alert region themselves,
  // so the personalized re-engagement emails the product promises at signup never
  // fired for anyone. "medium" balances enough signal to prove value during the
  // 14-day trial against flooding a brand-new inbox. Best-effort: a failure here
  // shouldn't fail trial activation itself.
  //
  // Targeted by default when the signup form collected a priority region
  // (2026-07-27): enrolling in all 5 regions unconditionally meant every
  // other alert-preference surface in the product (per-disease, watchlist,
  // tripwires, geofence, country-risk, per-outbreak subscribe) stayed at 0
  // users across the board — nobody has a reason to narrow something they
  // never noticed was broad in the first place. A weekly email about one
  // country you asked about is a product; one about five continents reads
  // like a newsletter. "All regions" stays one click away and is still the
  // fallback for anyone who skips the question (or, as with OAuth, never saw it).
  const regionsToEnroll = options.priorityRegion ? [options.priorityRegion] : ALL_REGIONS;
  const alertRows = regionsToEnroll.map((region) => ({
    user_id: user.id,
    region,
    min_risk: "medium",
  }));
  const enrolled = await enrollAlertRegions(admin, user.id, "activate-trial", regionsToEnroll);

  if (enrolled) {
    // One-time "state of play" digest of outbreaks already active in the
    // user's regions at signup. The regular per-event alert emails
    // (regional-alerts cron) only fire on outbreaks created/updated after
    // enrollment, so without this a foyer that's already active and stable
    // never reaches the user at all — audited 2026-07-26, new trials were
    // seeing as little as 9% of the outbreaks genuinely live in their
    // regions. Best-effort, same as the enrollment above: never fail
    // activation over this.
    try {
      const minRiskByRegion = new Map(alertRows.map((r) => [r.region, r.min_risk]));

      const { data: activeOutbreaks, error: obErr } = await admin
        .from("outbreaks")
        .select("id, region, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, cases")
        .eq("active", true)
        .in("region", alertRows.map((r) => r.region))
        .limit(1000);

      if (obErr) throw new Error(`outbreaks query failed: ${obErr.message}`);

      const qualifying = (activeOutbreaks ?? []).filter((o) => {
        const minRisk = minRiskByRegion.get(o.region);
        if (!minRisk) return false;
        return (RISK_RANK[o.risk_level ?? ""] ?? 0) >= (RISK_RANK[minRisk] ?? 0);
      });

      if (qualifying.length > 0) {
        const locale = (profile.alert_locale as string | null) ?? "en";
        const DIGEST_DISPLAY_CAP = 10;
        const sortedQualifying = [...qualifying]
          .sort((a, b) => (RISK_RANK[b.risk_level ?? ""] ?? 0) - (RISK_RANK[a.risk_level ?? ""] ?? 0));
        const topOutbreaks = sortedQualifying.slice(0, DIGEST_DISPLAY_CAP);
        const overflowOutbreaks = sortedQualifying.slice(DIGEST_DISPLAY_CAP);

        const { subject, html } = buildSignupDigestEmail(
          locale,
          topOutbreaks,
          qualifying.length,
          `${APP_URL}/${locale}`,
          `${APP_URL}/${locale}/account#regional-alerts`,
          overflowOutbreaks
        );

        // Send BEFORE writing outbreak_alert_log. If sendEmail throws, the
        // log must stay unwritten: that table is exactly what regional-alerts
        // compares future case counts/risk against, so marking these
        // outbreaks "seen" without a real send would silently exclude this
        // user from every future regional alert on them too, not just this
        // digest. Same reordering as regional-alerts/disease-alerts
        // (2026-07-30) — this route had the identical log-before-send
        // ordering, just with the error already thrown into Sentry via the
        // catch below rather than swallowed outright.
        //
        // Only a non-production environment is a legitimate reason not to
        // send. A missing BREVO_API_KEY or a profile with no email address
        // is a real failure and must surface in Sentry via the catch below.
        if (!isRealProduction) {
          console.log("[activate-trial] signup digest skipped: not a production environment");
        } else if (!user.email) {
          throw new Error("signup digest: user has no email address");
        } else {
          await sendEmail(user.email, subject, html);
        }

        // Log every qualifying outbreak at its current state — not just the
        // ones shown in the email — so the next regional-alerts cron run
        // only re-fires on a genuine escalation/surge from here, instead of
        // treating all of them as "new" and sending one email per outbreak.
        const sentAt = new Date().toISOString();
        const { error: logErr } = await admin.from("outbreak_alert_log").upsert(
          qualifying.map((o) => ({
            user_id: user.id,
            outbreak_id: String(o.id),
            risk_level: o.risk_level,
            cases_at_alert: o.cases ?? null,
            sent_at: sentAt,
          })),
          { onConflict: "user_id,outbreak_id" }
        );
        if (logErr) throw new Error(`outbreak_alert_log upsert failed: ${logErr.message}`);
      }
    } catch (digestErr) {
      console.error("[activate-trial] signup digest failed:", digestErr);
      Sentry.captureException(digestErr, { tags: { user_id: user.id, part: "signup-digest" } });
      await Sentry.flush(2000);
    }
  }

  console.log(`[activate-trial] Trial activated until ${trialEndsAt}`);
  return { activated: true, trial_ends_at: trialEndsAt };
}

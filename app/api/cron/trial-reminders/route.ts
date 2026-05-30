import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildTrialEndingEmail } from "@/lib/trial-ending-email";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_KEY        = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_KEY) {
    console.warn("[trial-reminders] BREVO_API_KEY not set — skipping send");
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error for ${to}: ${err}`);
  }
}

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // ── Target window: trial_ends_at in [now + 2.5d, now + 3.5d) ───────────────
  // The cron runs daily at 09:30 UTC. The ±0.5-day window around J-3 ensures
  // each user is caught exactly once even if the cron drifts slightly.
  const windowStart = new Date(Date.now() + 2.5 * 86_400_000).toISOString();
  const windowEnd   = new Date(Date.now() + 3.5 * 86_400_000).toISOString();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, plan, trial_ends_at")
    .in("plan", ["starter", "pro"])
    .not("trial_ends_at", "is", null)
    .gte("trial_ends_at", windowStart)
    .lt("trial_ends_at", windowEnd);

  if (error) {
    console.error("[trial-reminders] DB query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    console.log("[trial-reminders] No trials ending in ~3 days.");
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  console.log(`[trial-reminders] ${profiles.length} trial(s) ending in ~3 days`);

  let sent   = 0;
  let failed = 0;

  for (const profile of profiles) {
    if (!profile.email) continue;

    try {
      // Fetch locale from subscriptions table; fall back to "en"
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("locale")
        .eq("email", profile.email)
        .maybeSingle();
      const locale = (sub as any)?.locale ?? "en";

      const plan = profile.plan as "starter" | "pro";
      const { subject, html } = buildTrialEndingEmail(plan, locale, profile.trial_ends_at);

      await sendEmail(profile.email, subject, html);
      sent++;
    } catch (err) {
      console.error(`[trial-reminders] Failed for ${profile.email}:`, err);
      failed++;
    }

    // Throttle — stay within Brevo rate limits
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`[trial-reminders] Done — ${sent} sent, ${failed} failed.`);
  return NextResponse.json({ sent, failed, total: profiles.length });
}

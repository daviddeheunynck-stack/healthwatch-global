import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildJ3Email, buildJ12Email } from "@/lib/onboarding-emails";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const BREVO_API_KEY    = clean(process.env.BREVO_API_KEY);
const SUPABASE_URL     = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${err}`);
  }
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = clean(process.env.CRON_SECRET);
  const auth = req.headers.get("authorization");
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BREVO_API_KEY) {
    return NextResponse.json({ error: "BREVO_API_KEY not set" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // ── Find trial users (pro + trial_ends_at + no Stripe sub) at J+3 ─────────
  // J+3 = "discover your Pro features" nudge.
  // We target signup-trial users specifically (stripe_subscription_id IS NULL)
  // to avoid duplicating the Stripe-native trial_will_end webhook email.
  const { data: j3Users, error: j3Err } = await supabase
    .from("profiles")
    .select("id, email, plan, locale, trial_ends_at")
    .eq("plan", "pro")
    .not("trial_ends_at", "is", null)
    .is("stripe_subscription_id", null)
    .filter("created_at", "gte", new Date(Date.now() - 3.5 * 86400_000).toISOString())
    .filter("created_at", "lt",  new Date(Date.now() - 2.5 * 86400_000).toISOString());

  if (j3Err) {
    console.error("[onboarding] J+3 query error:", j3Err);
    return NextResponse.json({ error: j3Err.message }, { status: 500 });
  }

  // ── Find trial users at J+12 ("2 days left, subscribe now") ──────────────
  const { data: j12Users, error: j12Err } = await supabase
    .from("profiles")
    .select("id, email, plan, locale, trial_ends_at")
    .eq("plan", "pro")
    .not("trial_ends_at", "is", null)
    .is("stripe_subscription_id", null)
    .filter("created_at", "gte", new Date(Date.now() - 12.5 * 86400_000).toISOString())
    .filter("created_at", "lt",  new Date(Date.now() - 11.5 * 86400_000).toISOString());

  if (j12Err) {
    console.error("[onboarding] J+12 query error:", j12Err);
    return NextResponse.json({ error: j12Err.message }, { status: 500 });
  }

  let j3Sent = 0, j3Failed = 0;
  let j12Sent = 0, j12Failed = 0;

  // ── Send J+3 emails ───────────────────────────────────────────────────────
  for (const user of j3Users ?? []) {
    if (!user.email) continue;
    try {
      // Use profiles.locale (set at signup) — more reliable than subscriptions
      const locale = user.locale || "fr";
      const { subject, html } = buildJ3Email(locale);
      await sendEmail(user.email, subject, html);
      j3Sent++;
      await new Promise((r) => setTimeout(r, 150)); // rate-limit friendly
    } catch (err) {
      console.error(`[onboarding] J+3 failed for ${user.email}:`, err);
      j3Failed++;
    }
  }

  // ── Send J+12 emails ──────────────────────────────────────────────────────
  for (const user of j12Users ?? []) {
    if (!user.email) continue;
    try {
      const locale = user.locale || "fr";
      const { subject, html } = buildJ12Email(locale);
      await sendEmail(user.email, subject, html);
      j12Sent++;
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`[onboarding] J+12 failed for ${user.email}:`, err);
      j12Failed++;
    }
  }

  console.log(`[onboarding] J+3: ${j3Sent} sent, ${j3Failed} failed | J+12: ${j12Sent} sent, ${j12Failed} failed`);

  return NextResponse.json({
    j3: { sent: j3Sent, failed: j3Failed, total: (j3Users ?? []).length },
    j12: { sent: j12Sent, failed: j12Failed, total: (j12Users ?? []).length },
  });
}

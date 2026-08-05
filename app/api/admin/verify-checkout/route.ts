/**
 * GET /api/admin/verify-checkout?user_id=<uuid>
 *        OR ?email=<email>
 *
 * Diagnostic endpoint — returns the Stripe + DB state for a user so you
 * can verify a test checkout actually updated the DB.
 *
 * Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  const email  = searchParams.get("email");

  if (!userId && !email) {
    return NextResponse.json({ error: "Provide ?user_id= or ?email=" }, { status: 400 });
  }
  // email is optional (userId is the alternative lookup key) but wasn't
  // format-checked when present — aligned with the regex every other
  // email-accepting route in the repo already uses.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let query = supabase
    .from("profiles")
    .select("id, email, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, locale, created_at");

  if (userId) query = query.eq("id", userId);
  else        query = query.eq("email", email!);

  const { data, error } = await query.maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  const trialEnd = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
  const trialActive = trialEnd ? trialEnd > now : false;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86_400_000))
    : null;

  return NextResponse.json({
    ok: true,
    user: {
      id:          data.id,
      email:       data.email,
      plan:        data.plan,
      trial_ends_at:             data.trial_ends_at,
      trial_active:              trialActive,
      trial_days_left:           trialDaysLeft,
      stripe_customer_id:        data.stripe_customer_id    ?? "(not set)",
      stripe_subscription_id:    data.stripe_subscription_id ?? "(not set)",
      locale:      data.locale,
      created_at:  data.created_at,
    },
    checks: {
      has_stripe_customer:      !!data.stripe_customer_id,
      has_stripe_subscription:  !!data.stripe_subscription_id,
      is_paid:                  ["starter", "pro", "team", "enterprise"].includes(data.plan),
      trial_or_paid:            ["starter", "pro", "team", "enterprise"].includes(data.plan) || trialActive,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

let _stripe: Stripe | null = null;
function getStripe() {
  return (_stripe ??= new Stripe(clean(process.env.STRIPE_SECRET_KEY), {
    apiVersion: "2026-04-22.dahlia",
  }));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, days = 14 } = await req.json() as { email: string; days?: number };
  // Only checked non-empty before — aligned with the regex every other
  // email-accepting route in the repo already uses (subscribe, team/invite,
  // admin/invite, etc). A malformed value here just 404s on the .eq() lookup
  // below rather than doing anything unsafe, but there's no reason for this
  // one route to be the odd one out.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const admin = createServiceClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("id, plan, trial_ends_at, stripe_subscription_id")
    .eq("email", email)
    .single();

  if (fetchErr || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const base = new Date();
  base.setDate(base.getDate() + days);
  base.setUTCHours(23, 59, 59, 0);
  const newEndsAt    = base.toISOString();
  const trialEndUnix = Math.floor(base.getTime() / 1000);

  // If user has a Stripe subscription, check its status
  if (profile.stripe_subscription_id) {
    let sub: Stripe.Subscription;
    try {
      sub = await getStripe().subscriptions.retrieve(profile.stripe_subscription_id);
    } catch (err) {
      // A transient Stripe error (timeout, rate limit) was previously
      // silently treated as "canceled", which nulls stripe_subscription_id
      // in the DB below even if the subscription is genuinely still
      // active/trialing in Stripe — desyncing DB state from a real, possibly
      // paying subscription, with the admin told "done" regardless. Report
      // and refuse rather than guess on an unknown state.
      console.error("[extend-trial] Stripe retrieve failed:", err);
      Sentry.captureException(err, { tags: { route: "admin-extend-trial", user_id: profile.id } });
      return NextResponse.json({ error: "Could not verify Stripe subscription status — try again" }, { status: 502 });
    }

    if (sub.status === "active") {
      return NextResponse.json({ error: "Active paid subscription — use Stripe dashboard" }, { status: 409 });
    }

    if (sub.status === "trialing") {
      await getStripe().subscriptions.update(profile.stripe_subscription_id, { trial_end: trialEndUnix });
      const { error: updateErr } = await admin.from("profiles").update({ plan: "pro", trial_ends_at: newEndsAt }).eq("id", profile.id);
      if (updateErr) {
        console.error("[extend-trial] DB update failed (stripe path):", updateErr);
        Sentry.captureException(new Error(`[extend-trial] DB update failed: ${updateErr.message}`), { tags: { route: "admin-extend-trial", user_id: profile.id } });
        return NextResponse.json({ error: "Stripe updated but DB write failed — check Sentry" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, trial_ends_at: newEndsAt, via: "stripe" });
    }

    // Canceled / past_due — manage in DB only, clear stale sub ID
    const { error: updateErr } = await admin.from("profiles").update({
      plan: "pro",
      trial_ends_at: newEndsAt,
      stripe_subscription_id: null,
    }).eq("id", profile.id);
    if (updateErr) {
      console.error("[extend-trial] DB update failed (canceled path):", updateErr);
      Sentry.captureException(new Error(`[extend-trial] DB update failed: ${updateErr.message}`), { tags: { route: "admin-extend-trial", user_id: profile.id } });
      return NextResponse.json({ error: "DB write failed — check Sentry" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, trial_ends_at: newEndsAt, via: "db" });
  }

  // No Stripe subscription — DB only
  const { error: updateErr } = await admin.from("profiles").update({ plan: "pro", trial_ends_at: newEndsAt }).eq("id", profile.id);
  if (updateErr) {
    console.error("[extend-trial] DB update failed (no-sub path):", updateErr);
    Sentry.captureException(new Error(`[extend-trial] DB update failed: ${updateErr.message}`), { tags: { route: "admin-extend-trial", user_id: profile.id } });
    return NextResponse.json({ error: "DB write failed — check Sentry" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, trial_ends_at: newEndsAt, via: "db" });
}

/**
 * Extend a user's Pro trial by N days.
 * Works for users with no Stripe subscription OR with a canceled Stripe subscription.
 * Run: npx tsx scripts/extend-trial.ts <email> <days>
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const email = process.argv[2];
const days  = parseInt(process.argv[3] ?? "14", 10);

if (!email) {
  console.error("Usage: npx tsx scripts/extend-trial.ts <email> [days]");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

async function run() {
  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, email, plan, trial_ends_at, stripe_subscription_id")
    .eq("email", email)
    .single();

  if (fetchErr || !profile) {
    console.error("User not found:", email, fetchErr?.message);
    process.exit(1);
  }

  console.log("Current DB state:");
  console.log(`  id:                  ${profile.id}`);
  console.log(`  plan:                ${profile.plan}`);
  console.log(`  trial_ends_at:       ${profile.trial_ends_at ?? "null"}`);
  console.log(`  stripe_subscription: ${profile.stripe_subscription_id ?? "none"}`);

  // If there's a Stripe subscription ID, check whether it's actually active
  if (profile.stripe_subscription_id) {
    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    } catch {
      console.log(`  Stripe sub not found (deleted/purged) — treating as no subscription`);
      sub = { status: "canceled" } as Stripe.Subscription;
    }

    console.log(`  Stripe sub status:   ${sub.status}`);

    if (sub.status === "trialing") {
      // Extend the trial end date on the Stripe subscription directly
      const base = new Date();
      base.setDate(base.getDate() + days);
      base.setUTCHours(23, 59, 59, 0);
      const newEndsAt = base.toISOString();
      const trialEndUnix = Math.floor(base.getTime() / 1000);

      console.log(`\n→ Extending Stripe trial to ${newEndsAt} …`);
      await stripe.subscriptions.update(profile.stripe_subscription_id, {
        trial_end: trialEndUnix,
      });
      console.log("  Stripe updated ✓");

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ plan: "pro", trial_ends_at: newEndsAt })
        .eq("id", profile.id);

      if (updateErr) {
        console.error("DB update failed:", updateErr.message);
        process.exit(1);
      }

      console.log(`\n✅  Trial extended for ${email}`);
      console.log(`  plan:          pro`);
      console.log(`  trial_ends_at: ${newEndsAt}  (+${days} days)`);
      return;
    }

    if (sub.status === "active") {
      console.error("\n⚠️  Paid active subscription — no trial to extend. Add a coupon/credit in the Stripe dashboard instead.");
      process.exit(1);
    }

    // Subscription is canceled/past_due/unpaid — safe to manage in DB only
    console.log("  → Subscription is not active; managing access in DB only.");
  }

  const base = new Date();
  base.setDate(base.getDate() + days);
  base.setUTCHours(23, 59, 59, 0);
  const newEndsAt = base.toISOString();

  const updates: Record<string, unknown> = {
    plan: "pro",
    trial_ends_at: newEndsAt,
  };
  // Clear the stale sub ID so the checkout route can grant a fresh Stripe trial if they upgrade
  if (profile.stripe_subscription_id) {
    updates.stripe_subscription_id = null;
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", profile.id);

  if (updateErr) {
    console.error("Update failed:", updateErr.message);
    process.exit(1);
  }

  console.log(`\n✅  Access extended for ${email}`);
  console.log(`  plan:          pro`);
  console.log(`  trial_ends_at: ${newEndsAt}  (+${days} days)`);
  if (updates.stripe_subscription_id === null) {
    console.log(`  stripe_sub:    cleared (was canceled)`);
  }
}

run().catch((err) => { console.error(err); process.exit(1); });

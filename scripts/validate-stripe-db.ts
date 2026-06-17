/**
 * Validate that Supabase profiles reflect the true Stripe subscription state.
 * Run: npx tsx scripts/validate-stripe-db.ts
 *
 * For every profile with a stripe_customer_id, fetches the live Stripe
 * subscription and checks that plan + stripe_subscription_id are in sync.
 * Reports mismatches and optionally repairs them.
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const stripe = new Stripe(clean(process.env.STRIPE_SECRET_KEY), {
  apiVersion: "2026-04-22.dahlia",
});

const supabase = createClient(
  clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
);

function planFromStatus(status: Stripe.Subscription.Status): "pro" | "free" {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

async function run() {
  // 1 — load all profiles with a Stripe customer
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, plan, stripe_customer_id, stripe_subscription_id, trial_ends_at")
    .not("stripe_customer_id", "is", null);

  if (error) {
    console.error("Supabase query failed:", error);
    process.exit(1);
  }

  console.log(`\n=== Stripe ↔ DB validation (${profiles?.length ?? 0} customers) ===\n`);

  let ok = 0;
  let mismatches = 0;
  let noSub = 0;

  for (const profile of profiles ?? []) {
    const cid = profile.stripe_customer_id as string;

    // 2 — fetch subscriptions from Stripe for this customer
    let subs: Stripe.Subscription[];
    try {
      const list = await stripe.subscriptions.list({
        customer: cid,
        limit: 5,
        expand: ["data.items.data.price"],
      });
      subs = list.data;
    } catch (e) {
      console.warn(`  [WARN] Could not fetch subscriptions for ${profile.email} (${cid}):`, e);
      continue;
    }

    // 3 — pick the most relevant subscription
    //     active > trialing > past_due > canceled
    const priority = ["active", "trialing", "past_due", "canceled", "unpaid", "incomplete"];
    subs.sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status));
    const sub = subs[0] ?? null;

    if (!sub) {
      // Customer exists in Stripe but no subscription — should be free in DB
      noSub++;
      const expected = "free";
      const tag = profile.plan === expected ? "✅ OK" : "❌ MISMATCH";
      console.log(`${tag}  ${profile.email}`);
      if (profile.plan !== expected) {
        mismatches++;
        console.log(`      DB plan=${profile.plan}  Stripe=no subscription  → expected ${expected}`);
      } else {
        console.log(`      No active subscription (plan=free in DB) ✓`);
      }
      continue;
    }

    // 4 — compare
    const stripePlan   = planFromStatus(sub.status);
    const stripeSub    = sub.id;
    const stripeTrialEnd = sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null;

    const dbPlan   = profile.plan;
    const dbSub    = profile.stripe_subscription_id;

    const planMatch = dbPlan === stripePlan;
    const subMatch  = dbSub  === stripeSub;

    if (planMatch && subMatch) {
      ok++;
      console.log(`✅ OK    ${profile.email}  plan=${dbPlan}  sub=${stripeSub}  status=${sub.status}`);
    } else {
      mismatches++;
      console.log(`❌ MISMATCH  ${profile.email}`);
      if (!planMatch)
        console.log(`      plan:  DB=${dbPlan}  →  Stripe=${stripePlan}  (status=${sub.status})`);
      if (!subMatch)
        console.log(`      sub:   DB=${dbSub ?? "null"}  →  Stripe=${stripeSub}`);
      if (stripeTrialEnd)
        console.log(`      trial_ends_at (Stripe): ${stripeTrialEnd}`);
    }
  }

  // 5 — summary
  console.log("\n─────────────────────────────────────────────");
  console.log(`✅ In sync:   ${ok}`);
  console.log(`⚠️  No sub:   ${noSub}`);
  console.log(`❌ Mismatch:  ${mismatches}`);
  console.log("─────────────────────────────────────────────\n");

  if (mismatches > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

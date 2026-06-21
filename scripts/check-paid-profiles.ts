/**
 * Diagnostic: list all non-free profiles and flag anomalies.
 * Run: npx tsx scripts/check-paid-profiles.ts
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

async function run() {
  // 1. All non-free profiles
  const { data: paid, error: e1 } = await supabase
    .from("profiles")
    .select("id, email, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, created_at")
    .neq("plan", "free")
    .order("created_at", { ascending: false });

  if (e1) { console.error("Query failed:", e1.message); process.exit(1); }

  console.log(`\n=== Non-free profiles (${paid?.length ?? 0}) ===\n`);
  for (const p of paid ?? []) {
    const trialExpired = p.trial_ends_at && new Date(p.trial_ends_at) < new Date();
    const flag = trialExpired ? " ⚠️  TRIAL EXPIRED" : "";
    console.log(`${p.email}`);
    console.log(`  plan:            ${p.plan}${flag}`);
    console.log(`  trial_ends_at:   ${p.trial_ends_at ?? "null"}`);
    console.log(`  stripe_customer: ${p.stripe_customer_id ?? "MISSING ⚠️"}`);
    console.log(`  stripe_sub:      ${p.stripe_subscription_id ?? "MISSING ⚠️"}`);
    console.log(`  created_at:      ${p.created_at}`);
    console.log();
  }

  // 2. Profiles with stripe_customer_id but plan = 'free' (potential missed webhook)
  const { data: orphans, error: e2 } = await supabase
    .from("profiles")
    .select("id, email, plan, stripe_customer_id, stripe_subscription_id")
    .eq("plan", "free")
    .not("stripe_customer_id", "is", null);

  if (e2) { console.error("Orphan query failed:", e2.message); process.exit(1); }

  if ((orphans?.length ?? 0) > 0) {
    console.log(`=== ⚠️  Free users WITH a Stripe customer ID (${orphans!.length}) — possible missed webhook ===\n`);
    for (const p of orphans!) {
      console.log(`${p.email}`);
      console.log(`  stripe_customer: ${p.stripe_customer_id}`);
      console.log(`  stripe_sub:      ${p.stripe_subscription_id ?? "null"}`);

      // Check Stripe subscription status
      if (p.stripe_subscription_id) {
        try {
          const sub = await stripe.subscriptions.retrieve(p.stripe_subscription_id);
          console.log(`  Stripe sub status: ${sub.status} (plan: ${sub.items.data[0]?.price?.id})`);
          if (sub.status === "active" || sub.status === "trialing") {
            console.log(`  ❌  ACTIVE Stripe sub but plan=free in DB — webhook missed this user!`);
          }
        } catch {
          console.log(`  Stripe sub: not found (deleted/purged)`);
        }
      }
      console.log();
    }
  } else {
    console.log("=== ✅  No free users with orphaned Stripe customer IDs ===\n");
  }
}

run().catch((err) => { console.error(err); process.exit(1); });

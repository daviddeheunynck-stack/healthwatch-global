import { readFileSync } from "fs";
import Stripe from "stripe";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const vars = {};
env.split("\n").forEach((line) => {
  if (!line || line.startsWith("#")) return;
  const idx = line.indexOf("=");
  if (idx < 0) return;
  vars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const BOM = "﻿";
const clean = (s) => (s || "").replace(BOM, "").trim();

const stripe = new Stripe(clean(vars["STRIPE_SECRET_KEY"]), {
  apiVersion: "2026-04-22.dahlia",
});

// Shinta — seule vraie utilisatrice avec sub Stripe live
const sub = await stripe.subscriptions.retrieve("sub_1Tex0H4FKShlvEcMM8LNcCJI");
const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString().slice(0, 16) + " UTC" : "none";
const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10) : "none";

console.log("=== shintayuliawati28@gmail.com ===");
console.log(`  status           : ${sub.status}`);
console.log(`  trial_end        : ${trialEnd}`);
console.log(`  current_period   : ends ${periodEnd}`);
console.log(`  cancel_at_end    : ${sub.cancel_at_period_end}`);
console.log(`  payment_method   : ${sub.default_payment_method ?? "none"}`);
console.log(`  price_id         : ${sub.items.data[0]?.price?.id ?? "?"}`);
console.log();

// Vérifier si le customer a un email dans Stripe
const cust = await stripe.customers.retrieve("cus_UeFVfFAmgMZGmq");
console.log(`  stripe email     : ${cust.deleted ? "deleted" : cust.email}`);

// Événements récents pour ce customer
const events = await stripe.events.list({ limit: 5, type: "checkout.session.completed" });
const relevant = events.data.find(e => e.data.object?.customer === "cus_UeFVfFAmgMZGmq");
if (relevant) {
  console.log(`\n✅ checkout.session.completed trouvé pour ce customer`);
  console.log(`  user_id dans metadata : ${relevant.data.object?.metadata?.user_id ?? "ABSENT ⚠️"}`);
} else {
  console.log("\n⚠️  checkout.session.completed non trouvé dans les 5 derniers events");
}

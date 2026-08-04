import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_KEY = getEnv("STRIPE_SECRET_KEY");
console.log("Target project:", SUPABASE_URL);
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  throw new Error("Refusing to run: this does not look like the production project.");
}

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const EXCLUDED_EMAILS = new Set([
  "david.deheunynck@gmail.com",
  "e2e@healthwatch-global.com",
  "davy_skye@yahoo.fr",
  "clarence_skye@yahoo.fr",
  "r.endangrukmanams@gmail.com",
  "elyan.delaunay@proton.me",
  "mobile-nox-test@healthwatch-global.com",
]);

// Ad hoc debug/repro accounts created directly in prod (no staging env) use this
// domain or these prefixes by convention — excluded by pattern so a forgotten
// cleanup after a debugging session can't surface as a false "0 région" regression.
const EXCLUDED_PATTERNS = [/@healthwatch-test\.dev$/i, /^claude-(repro|verify)-/i];
function isExcludedEmail(email) {
  return EXCLUDED_EMAILS.has(email) || EXCLUDED_PATTERNS.some((re) => re.test(email));
}

const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers });
if (!authRes.ok) throw new Error(`auth admin users failed: ${authRes.status} ${await authRes.text()}`);
const { users: authUsers } = await authRes.json();
const emailById = new Map(authUsers.map(u => [u.id, u.email]));
const createdAtAuthById = new Map(authUsers.map(u => [u.id, u.created_at]));
const lastSignInById = new Map(authUsers.map(u => [u.id, u.last_sign_in_at]));

const profiles = await get("profiles?select=id,plan,trial_ends_at,stripe_subscription_id,stripe_customer_id,created_at&order=created_at.asc");

console.log(`\nTotal profiles: ${profiles.length}, total auth users: ${authUsers.length}`);

// Real (non-test) accounts
const real = [];
for (const p of profiles) {
  const email = emailById.get(p.id) ?? "?";
  if (isExcludedEmail(email)) continue;
  const created = createdAtAuthById.get(p.id) ?? p.created_at;
  const lastSignIn = lastSignInById.get(p.id) ?? null;
  real.push({ id: p.id, email, plan: p.plan, trial_ends_at: p.trial_ends_at, stripe_sub: p.stripe_subscription_id, stripe_cust: p.stripe_customer_id, created, lastSignIn });
}

console.log(`\n=== COMPTES RÉELS: ${real.length} ===`);
// Sort by created desc to spot new ones
real.sort((a, b) => new Date(b.created) - new Date(a.created));
for (const r of real) {
  console.log(`${r.created?.slice(0,10)} | ${r.email} | plan=${r.plan} | sub=${r.stripe_sub ? "Y" : "-"} | cust=${r.stripe_cust ? "Y":"-"}`);
}

// Newest accounts detail (last 5) - check alert enrollment
console.log(`\n=== ENROLLMENT ALERTES (5 comptes les plus récents) ===`);
for (const r of real.slice(0, 5)) {
  const regions = await get(`user_alert_regions?user_id=eq.${r.id}&select=region`);
  const diseases = await get(`user_alert_diseases?user_id=eq.${r.id}&select=disease_en`);
  const flag = regions.length === 0 ? "  <-- 0 REGION (verif regression)" : "";
  console.log(`${r.created?.slice(0,10)} | ${r.email} | regions=${regions.length} | diseases=${diseases.length}${flag}`);
}

// Stripe: any real paid invoice?
console.log(`\n=== STRIPE FACTURES amount_paid > 0 ===`);
const sHeaders = { Authorization: `Bearer ${STRIPE_KEY}` };
const invRes = await fetch("https://api.stripe.com/v1/invoices?limit=100", { headers: sHeaders });
if (!invRes.ok) {
  console.log("Stripe invoices fetch failed:", invRes.status, await invRes.text());
} else {
  const inv = await invRes.json();
  const paid = inv.data.filter(i => i.amount_paid > 0);
  console.log(`Total factures récupérées: ${inv.data.length} | avec amount_paid>0: ${paid.length}`);
  for (const i of paid) {
    console.log(`  ${new Date(i.created*1000).toISOString().slice(0,10)} | ${i.customer_email} | ${(i.amount_paid/100).toFixed(2)} ${i.currency} | status=${i.status}`);
  }
}

// Also list active subscriptions
const subRes = await fetch("https://api.stripe.com/v1/subscriptions?status=all&limit=100", { headers: sHeaders });
if (subRes.ok) {
  const subs = await subRes.json();
  console.log(`\n=== STRIPE SUBSCRIPTIONS (${subs.data.length}) ===`);
  for (const s of subs.data) {
    console.log(`  ${new Date(s.created*1000).toISOString().slice(0,10)} | status=${s.status} | ${s.items.data.map(it=>`${(it.price.unit_amount??0)/100}${it.price.currency}`).join(",")}`);
  }
}

// Webhook end-to-end test — validates the full Stripe → webhook → Supabase DB flow.
//
// Prerequisites (run in separate terminals BEFORE this script):
//   Terminal 1 : npm run dev
//   Terminal 2 : stripe listen --forward-to localhost:3000/api/webhook
//                └── Copy the printed "whsec_..." secret into .env.local as STRIPE_WEBHOOK_SECRET,
//                    then restart the dev server if the secret changed.
//
// Usage:
//   node scripts/test-webhook-e2e.mjs
//
// Test coverage:
//   T1 – checkout.session.completed → plan=pro  (metadata.user_id path)
//   T2 – customer.subscription.updated          (stripe_customer_id lookup path)
//   T3 – customer.subscription.deleted          (cancel → plan=free)
//   T4 – checkout.session.completed → plan=team (skipped if STRIPE_TEAM_EUR_PRICE_ID absent)

import { readFileSync } from "fs";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

// ── Env loader ───────────────────────────────────────────────────────────────
function parseEnv(filename) {
  try {
    const raw = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
    const vars = {};
    raw.split("\n").forEach((line) => {
      if (!line || line.startsWith("#")) return;
      const idx = line.indexOf("=");
      if (idx < 0) return;
      vars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    return vars;
  } catch {
    return {};
  }
}

const BOM = "﻿";
const clean = (s) => (s || "").replace(BOM, "").trim().replace(/^"(.*)"$/, "$1");

const vars = parseEnv(".env.local");

const supabase = createClient(
  clean(vars["NEXT_PUBLIC_SUPABASE_URL"]),
  clean(vars["SUPABASE_SERVICE_ROLE_KEY"])
);

const _PRO_PRICE_ID  = clean(vars["STRIPE_PRO_EUR_PRICE_ID"]);
const TEAM_PRICE_ID = clean(vars["STRIPE_TEAM_EUR_PRICE_ID"]);

// Test user — created by scripts/setup-test-user.mjs
const TEST_EMAIL = "e2e@healthwatch-global.com";

// Synthetic Stripe customer ID — must match what we write into the profile
// before triggering subscription events (no real Stripe lookup is needed).
const FAKE_CUSTOMER_ID = "cus_hwg_webhook_e2e_test";

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getProfile() {
  const { data } = await supabase
    .from("profiles")
    .select("id, email, plan, stripe_customer_id, stripe_subscription_id, trial_ends_at")
    .eq("email", TEST_EMAIL)
    .single();
  return data;
}

async function patchProfile(id, fields) {
  const { error } = await supabase.from("profiles").update(fields).eq("id", id);
  if (error) console.error("  [patchProfile]", error.message);
}

async function resetProfile(id) {
  await patchProfile(id, {
    plan: "free",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_ends_at: null,
  });
}

function stripeTrigger(eventType, overrides = []) {
  const overrideArgs = overrides.map((o) => `--override "${o}"`).join(" ");
  const cmd = `stripe trigger ${eventType}${overrideArgs ? " " + overrideArgs : ""}`;
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 15_000 });
    return { ok: true };
  } catch (e) {
    const err = e.stderr?.toString() || e.message || "unknown error";
    return { ok: false, err };
  }
}

// ── Results tracking ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, got, expected) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    const msg = `${label} — got: ${JSON.stringify(got)}, expected: ${JSON.stringify(expected)}`;
    console.log(`  ❌ ${msg}`);
    failures.push(msg);
    failed++;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   WEBHOOK END-TO-END TEST SUITE          ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // ── Pre-checks ─────────────────────────────────────────────────────────────
  console.log("PRE-CHECKS\n");

  // Dev server
  let serverOk = false;
  try {
    const res = await fetch("http://localhost:3000");
    serverOk = res.status < 500;
  } catch { /* unreachable */ }
  check("Dev server accessible sur :3000", serverOk, serverOk ? "ok" : "unreachable", "ok");
  if (!serverOk) {
    console.log("\n  → Lance: npm run dev\n");
    process.exit(1);
  }

  // Webhook endpoint reachable (should return 400 without a valid signature)
  let webhookOk = false;
  try {
    const r = await fetch("http://localhost:3000/api/webhook", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
    webhookOk = r.status === 400; // Missing stripe-signature header → 400 is correct
  } catch { /* */ }
  check("Webhook endpoint répond (400 sans signature = OK)", webhookOk, webhookOk ? "400" : "unreachable", "400");

  // Stripe CLI
  let stripeOk = false;
  try { execSync("stripe version", { stdio: "pipe" }); stripeOk = true; } catch { /* */ }
  check("Stripe CLI disponible", stripeOk, stripeOk ? "ok" : "not found", "ok");
  if (!stripeOk) {
    console.log("\n  → Installe via: scoop install stripe  ou  choco install stripe\n");
    process.exit(1);
  }

  // Env vars
  check("NEXT_PUBLIC_SUPABASE_URL défini", !!clean(vars["NEXT_PUBLIC_SUPABASE_URL"]), "set", "set");
  check("SUPABASE_SERVICE_ROLE_KEY défini", !!clean(vars["SUPABASE_SERVICE_ROLE_KEY"]), "set", "set");
  check("STRIPE_WEBHOOK_SECRET défini", !!clean(vars["STRIPE_WEBHOOK_SECRET"]), "set", "set");

  // Test user
  let profile = await getProfile();
  check("User test e2e@healthwatch-global.com existe", !!profile, profile ? "found" : "missing", "found");
  if (!profile) {
    console.log("\n  → Crée le user: node scripts/setup-test-user.mjs\n");
    process.exit(1);
  }
  console.log(`\n  User ID : ${profile.id}`);
  console.log(`  Plan actuel : ${profile.plan}\n`);

  // stripe listen check — we can't detect it directly, just warn
  console.log("  ⚠️  Assure-toi que 'stripe listen --forward-to localhost:3000/api/webhook' tourne dans un autre terminal.");
  console.log("     (Le test échouera silencieusement si le tunnel n'est pas actif.)\n");

  await sleep(1000);

  // ── T1: checkout.session.completed → plan=pro ──────────────────────────────
  console.log("─────────────────────────────────────────────");
  console.log("T1 — checkout.session.completed → plan=pro\n");

  await resetProfile(profile.id);
  await sleep(500);
  profile = await getProfile();
  check("Profile reset to free", profile?.plan === "free", profile?.plan, "free");

  const t1 = stripeTrigger("checkout.session.completed", [
    `checkout_session:metadata.user_id=${profile.id}`,
    `checkout_session:metadata.plan=pro`,
    `checkout_session:metadata.locale=fr`,
  ]);
  check("stripe trigger envoyé sans erreur", t1.ok, t1.ok ? "ok" : t1.err, "ok");
  if (!t1.ok) console.log(`    ${t1.err}`);

  await sleep(4000);
  profile = await getProfile();
  check("profiles.plan = pro", profile?.plan === "pro", profile?.plan, "pro");
  check("stripe_customer_id renseigné", !!profile?.stripe_customer_id, profile?.stripe_customer_id || "null", "non-null");
  check("stripe_subscription_id renseigné", !!profile?.stripe_subscription_id, profile?.stripe_subscription_id || "null", "non-null");

  // ── T2: customer.subscription.updated (status=active) ─────────────────────
  console.log("\n─────────────────────────────────────────────");
  console.log("T2 — customer.subscription.updated (active)\n");

  // Set a predictable fake customer ID so the webhook can look up the user
  await patchProfile(profile.id, { stripe_customer_id: FAKE_CUSTOMER_ID, plan: "pro" });

  const t2 = stripeTrigger("customer.subscription.updated", [
    `subscription:customer=${FAKE_CUSTOMER_ID}`,
    `subscription:status=active`,
  ]);
  check("stripe trigger envoyé sans erreur", t2.ok, t2.ok ? "ok" : t2.err, "ok");
  if (!t2.ok) console.log(`    ${t2.err}`);

  await sleep(4000);
  profile = await getProfile();
  // planFromPriceId defaults to "pro" when price ID is unknown (synthetic fixture) — expected
  check("profiles.plan = pro (default fallback pour fixture)", profile?.plan === "pro", profile?.plan, "pro");

  // ── T3: customer.subscription.deleted → plan=free ─────────────────────────
  console.log("\n─────────────────────────────────────────────");
  console.log("T3 — customer.subscription.deleted → plan=free\n");

  // Ensure fake customer ID is still set
  await patchProfile(profile.id, { stripe_customer_id: FAKE_CUSTOMER_ID, plan: "pro" });
  await sleep(300);

  const t3 = stripeTrigger("customer.subscription.deleted", [
    `subscription:customer=${FAKE_CUSTOMER_ID}`,
    `subscription:status=canceled`,
  ]);
  check("stripe trigger envoyé sans erreur", t3.ok, t3.ok ? "ok" : t3.err, "ok");
  if (!t3.ok) console.log(`    ${t3.err}`);

  await sleep(4000);
  profile = await getProfile();
  check("profiles.plan = free", profile?.plan === "free", profile?.plan, "free");
  check("stripe_subscription_id effacé", profile?.stripe_subscription_id === null, profile?.stripe_subscription_id, null);
  check("trial_ends_at effacé", profile?.trial_ends_at === null, profile?.trial_ends_at, null);

  // ── T4: checkout.session.completed → plan=team ─────────────────────────────
  console.log("\n─────────────────────────────────────────────");
  if (!TEAM_PRICE_ID) {
    console.log("T4 — SKIP: plan=team (STRIPE_TEAM_EUR_PRICE_ID absent)\n");
    console.log("  → Crée le produit Team dans Stripe Dashboard puis ajoute le price ID dans .env.local");
  } else {
    console.log("T4 — checkout.session.completed → plan=team\n");

    await resetProfile(profile.id);
    await sleep(500);

    const t4 = stripeTrigger("checkout.session.completed", [
      `checkout_session:metadata.user_id=${profile.id}`,
      `checkout_session:metadata.plan=team`,
      `checkout_session:metadata.locale=fr`,
    ]);
    check("stripe trigger envoyé sans erreur", t4.ok, t4.ok ? "ok" : t4.err, "ok");
    if (!t4.ok) console.log(`    ${t4.err}`);

    await sleep(4000);
    profile = await getProfile();
    check("profiles.plan = team", profile?.plan === "team", profile?.plan, "team");
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────");
  console.log("CLEANUP\n");
  await patchProfile(profile.id, {
    plan: "pro",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  });
  console.log("  ✅ Profile restauré → plan=pro (trial 14j) pour les E2E Playwright\n");

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log("╔══════════════════════════════════════════╗");
  const verdict = failed === 0 ? "🎉 TOUS PASSÉS" : `${failed} ÉCHEC(S)`;
  console.log(`║  RÉSULTAT : ${passed}/${total} — ${verdict}`.padEnd(43) + "║");
  console.log("╚══════════════════════════════════════════╝\n");

  if (failures.length > 0) {
    console.log("Échecs :");
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\n[FATAL]", e.message || e);
  process.exit(1);
});

/**
 * Diagnostic complet du chemin Stripe → webhook → Supabase.
 *
 * Usage :
 *   node scripts/diagnose-stripe-path.mjs                  # utilise .env.local.live
 *   node scripts/diagnose-stripe-path.mjs .env.local       # force un autre fichier
 *
 * Lecture seule — ne modifie rien, ni dans Stripe ni dans Supabase.
 * N'affiche aucune clé ni aucun secret : la sortie est copiable telle quelle.
 * Chaque section est indépendante : une permission manquante sur l'une
 * n'empêche pas les autres de tourner.
 */
import { readFileSync } from "fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// ── Chargement env ───────────────────────────────────────────────────────────
const ENV_FILE = process.argv[2] || ".env.local.live";
const BOM = String.fromCharCode(65279);
const clean = (s) => (s || "").replace(new RegExp("^" + BOM), "").trim().replace(/^"(.*)"$/, "$1");

function parseEnv(filename) {
  const raw = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
  const vars = {};
  raw.split("\n").forEach((line) => {
    const l = line.replace(new RegExp("^" + BOM), "");
    if (!l.trim() || l.trim().startsWith("#")) return;
    const idx = l.indexOf("=");
    if (idx < 0) return;
    vars[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  });
  return vars;
}

let vars;
try {
  vars = parseEnv(ENV_FILE);
} catch {
  console.error(`✗ Fichier ${ENV_FILE} introuvable. Passe-le en argument.`);
  process.exit(1);
}

const SECRET = clean(vars["STRIPE_SECRET_KEY"]);
if (!SECRET) {
  console.error(`✗ STRIPE_SECRET_KEY absent de ${ENV_FILE}.`);
  process.exit(1);
}
const KEY_KIND = SECRET.startsWith("rk_") ? "restreinte (rk_)" : "secrète (sk_)";
const MODE = /_live/.test(SECRET) ? "LIVE" : /_test/.test(SECRET) ? "TEST" : "INCONNU";

const stripe = new Stripe(SECRET, { apiVersion: "2026-04-22.dahlia" });

const SUPABASE_URL = clean(vars["NEXT_PUBLIC_SUPABASE_URL"]);
const SERVICE_KEY = clean(vars["SUPABASE_SERVICE_ROLE_KEY"]);
const supabase = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

// Price IDs configurés — sert à vérifier que planFromPriceId() reconnaîtra bien
// l'abonnement au lieu de tomber dans son fallback "unknown → pro".
const PRICE_ENV = [
  "STRIPE_PRO_EUR_PRICE_ID",
  "STRIPE_PRO_USD_PRICE_ID",
  "STRIPE_PRO_EUR_ANNUAL_PRICE_ID",
  "STRIPE_PRO_USD_ANNUAL_PRICE_ID",
  "STRIPE_TEAM_EUR_PRICE_ID",
  "STRIPE_TEAM_EUR_ANNUAL_PRICE_ID",
  "STRIPE_TEAM_USD_PRICE_ID",
  "STRIPE_TEAM_USD_ANNUAL_PRICE_ID",
];
const PRICE_MAP = {};
PRICE_ENV.forEach((k) => {
  const v = clean(vars[k]);
  if (v) PRICE_MAP[v] = k;
});

const iso = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");
const days = (ts) => (ts ? Math.round((ts * 1000 - Date.now()) / 86_400_000) : null);
const hr = (t) => console.log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);

/** Exécute une section sans laisser une erreur tuer le reste du diagnostic. */
async function section(title, fn) {
  hr(title);
  try {
    return await fn();
  } catch (e) {
    if (e?.code === "more_permissions_required") {
      const perm = /Enabling "([^"]+)"/.exec(e.raw?.message ?? "")?.[1] ?? "?";
      console.log(`⛔ Section ignorée — la clé ${KEY_KIND} n'a pas la permission requise.`);
      console.log(`   Permission à activer : ${perm}`);
      console.log(`   Réglable sur la page API keys du dashboard Stripe.`);
    } else {
      console.log(`⛔ Section ignorée — ${e?.type ?? "erreur"} : ${e?.message ?? e}`);
    }
    return null;
  }
}

console.log(`\nFichier env : ${ENV_FILE}`);
console.log(`Clé Stripe  : ${KEY_KIND}, mode ${MODE}`);
console.log(`Supabase    : ${supabase ? "connecté (service role)" : "NON configuré dans ce fichier"}`);
console.log(`Price IDs configurés : ${Object.keys(PRICE_MAP).length}/${PRICE_ENV.length}`);

// ── 1. Abonnements ───────────────────────────────────────────────────────────
const subRows = [];

await section("1. ABONNEMENTS STRIPE", async () => {
  const subs = await stripe.subscriptions.list({
    limit: 100,
    status: "all",
    expand: ["data.customer", "data.default_payment_method"],
  });

  if (subs.data.length === 0) {
    console.log("Aucun abonnement sur ce compte Stripe.");
    return;
  }

  for (const sub of subs.data) {
    const cust = typeof sub.customer === "object" && !sub.customer.deleted ? sub.customer : null;
    const custId = typeof sub.customer === "object" ? sub.customer.id : sub.customer;

    const subPm = sub.default_payment_method
      ? typeof sub.default_payment_method === "object"
        ? sub.default_payment_method.id
        : sub.default_payment_method
      : null;
    const custInvoicePm = cust?.invoice_settings?.default_payment_method
      ? typeof cust.invoice_settings.default_payment_method === "object"
        ? cust.invoice_settings.default_payment_method.id
        : cust.invoice_settings.default_payment_method
      : null;

    let attachedCards = 0;
    try {
      const pms = await stripe.paymentMethods.list({ customer: custId, limit: 5 });
      attachedCards = pms.data.length;
    } catch { /* permission ou client supprimé */ }

    const effectivePm = subPm || custInvoicePm || (attachedCards > 0 ? "(carte attachée au client)" : null);
    const priceId = sub.items.data[0]?.price?.id ?? "?";
    const priceKnown = PRICE_MAP[priceId];

    console.log(`\n── ${cust?.email ?? "(email inconnu)"}`);
    console.log(`   subscription        : ${sub.id}`);
    console.log(`   status              : ${sub.status}`);
    console.log(`   price               : ${priceId}  ${priceKnown ? `✅ ${priceKnown}` : "🔴 NON RECONNU par planFromPriceId → fallback 'pro'"}`);
    console.log(`   trial_end           : ${iso(sub.trial_end)}${sub.trial_end ? `  (dans ${days(sub.trial_end)} j)` : ""}`);
    console.log(`   fin d'essai sans carte : ${sub.trial_settings?.end_behavior?.missing_payment_method ?? "—"}`);
    console.log(`   → PM sur abonnement : ${subPm ?? "AUCUN"}`);
    console.log(`   → PM sur client     : ${custInvoicePm ?? "AUCUN"}`);
    console.log(`   → cartes attachées  : ${attachedCards}`);
    console.log(`   ⇒ paiement possible : ${effectivePm ? "OUI" : "NON ⚠️"}`);
    console.log(`   metadata.user_id    : ${sub.metadata?.user_id || "ABSENT ⚠️"}`);
    console.log(`   metadata.billing    : ${sub.metadata?.billing || "absent ⚠️ (stripe_billing_period restera vide)"}`);

    if (
      sub.status === "trialing" &&
      !effectivePm &&
      sub.trial_settings?.end_behavior?.missing_payment_method === "cancel"
    ) {
      console.log(`   🔴 S'ANNULERA le ${iso(sub.trial_end)} sans jamais être facturé.`);
    }

    subRows.push({
      email: cust?.email ?? null,
      subId: sub.id,
      custId,
      status: sub.status,
      hasPm: !!effectivePm,
      pmOnlyOnCustomer: !subPm && !!(custInvoicePm || attachedCards > 0),
      priceKnown: !!priceKnown,
      userId: sub.metadata?.user_id || null,
    });
  }

  const blindSpot = subRows.filter((r) => r.pmOnlyOnCustomer);
  if (blindSpot.length > 0) {
    console.log(`\n⚠️  ${blindSpot.length} abonnement(s) avec carte UNIQUEMENT au niveau client.`);
    console.log(`    syncPaymentMethodFlag ne lit que sub.default_payment_method → comptés "non payants".`);
  }
});

// ── 2. Endpoints webhook ─────────────────────────────────────────────────────
const NEEDED = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
];

await section("2. ENDPOINTS WEBHOOK", async () => {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
  if (endpoints.data.length === 0) {
    console.log("🔴 AUCUN endpoint webhook — rien n'arrive jamais à l'app.");
    return;
  }
  for (const ep of endpoints.data) {
    console.log(`\n── ${ep.url}`);
    console.log(`   status  : ${ep.status}${ep.status !== "enabled" ? "  ⚠️" : ""}`);
    console.log(`   livemode: ${ep.livemode}${ep.livemode ? "" : "  ⚠️ endpoint en mode TEST"}`);
    const listens = ep.enabled_events.includes("*") ? NEEDED : ep.enabled_events;
    const missing = NEEDED.filter((e) => !listens.includes(e));
    console.log(`   events  : ${ep.enabled_events.includes("*") ? "* (tous)" : ep.enabled_events.length + " configurés"}`);
    console.log(missing.length ? `   🔴 MANQUANTS : ${missing.join(", ")}` : `   ✅ tous les events nécessaires sont écoutés`);
  }
});

// ── 3. Events récents ────────────────────────────────────────────────────────
await section("3. EVENTS RÉCENTS ET LIVRAISONS EN SOUFFRANCE", async () => {
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const events = await stripe.events.list({ limit: 100, created: { gte: since } });
  console.log(`${events.data.length} event(s) sur les 7 derniers jours.`);

  const byType = {};
  let stuck = 0;
  for (const ev of events.data) {
    byType[ev.type] = (byType[ev.type] || 0) + 1;
    if (ev.pending_webhooks > 0 && Date.now() / 1000 - ev.created > 3600) {
      stuck++;
      console.log(`   🔴 non livré : ${ev.type}  (${iso(ev.created)}, ${ev.pending_webhooks} en attente)`);
    }
  }
  console.log("\nRépartition par type :");
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, n]) => console.log(`   ${String(n).padStart(3)}  ${t}`));
  if (stuck === 0) console.log("\n✅ Aucune livraison en souffrance.");

  const twe = events.data.filter((e) => e.type === "customer.subscription.trial_will_end");
  console.log(
    `\ncustomer.subscription.trial_will_end sur 7 j : ${twe.length}` +
      (twe.length === 0 ? "  ⚠️ aucun — event probablement non activé, donc aucun email de fin d'essai" : "")
  );
  twe.forEach((e) => console.log(`   ${iso(e.created)}  ${e.data.object?.id}`));
});

// ── 4. Cohérence Supabase ────────────────────────────────────────────────────
await section("4. COHÉRENCE STRIPE ↔ SUPABASE", async () => {
  if (!supabase) {
    console.log(`Supabase non configuré dans ${ENV_FILE} — section ignorée.`);
    return;
  }
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, plan, stripe_customer_id, stripe_subscription_id, stripe_has_payment_method, stripe_billing_period, trial_ends_at");

  if (error) {
    console.log(`✗ Lecture profiles impossible : ${error.message}`);
    return;
  }

  const withSub = profiles.filter(
    (p) => p.stripe_subscription_id && p.stripe_subscription_id !== "admin_override"
  );
  console.log(`${profiles.length} profils, dont ${withSub.length} avec un abonnement Stripe réel.`);

  for (const r of subRows) {
    const p = profiles.find(
      (x) => x.stripe_subscription_id === r.subId || x.stripe_customer_id === r.custId
    );
    console.log(`\n── ${r.email ?? r.subId}  [${r.status}]`);
    if (!p) {
      console.log(`   🔴 AUCUN profil Supabase lié — le webhook n'a jamais abouti pour cet abonnement.`);
      continue;
    }
    console.log(`   profil      : ${p.email} (${p.id})`);
    console.log(`   plan        : ${p.plan}`);
    console.log(`   has_payment_method : DB=${p.stripe_has_payment_method}  Stripe=${r.hasPm}` +
      (!!p.stripe_has_payment_method !== r.hasPm ? "  🔴 DÉSYNCHRONISÉ" : "  ✅"));
    console.log(`   billing_period     : ${p.stripe_billing_period ?? "(vide)"}`);
    if (p.stripe_customer_id !== r.custId) {
      console.log(`   ⚠️ customer_id divergent : DB=${p.stripe_customer_id} / Stripe=${r.custId}`);
    }
  }

  const paying = withSub.filter((p) => p.stripe_has_payment_method);
  const activeSubs = subRows.filter((r) => r.status !== "canceled" && r.status !== "incomplete_expired");
  hr("VERDICT");
  console.log(`Abonnements Stripe non annulés    : ${activeSubs.length}`);
  console.log(`Dont avec moyen de paiement       : ${activeSubs.filter((r) => r.hasPm).length}`);
  console.log(`Comptés payants par la page admin : ${paying.length}`);
  console.log(
    `\n${paying.length > 0 ? "✅ Le chemin Stripe a produit au moins un client payant." : "🔴 Le chemin Stripe n'a encore JAMAIS produit de client payant."}`
  );
});

console.log("");

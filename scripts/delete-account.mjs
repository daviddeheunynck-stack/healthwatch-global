/**
 * Supprime un compte de PRODUCTION, par adresse e-mail.
 *
 * Ecrit le 2026-08-26 pour refaire le parcours d'inscription complet depuis une
 * adresse deja utilisee. Aucun script du depot ne faisait ca : la seule
 * suppression existante est /api/user/delete, qui exige une session du
 * proprietaire du compte.
 *
 * Usage :
 *   node scripts/delete-account.mjs <email>           → simulation, n'efface rien
 *   node scripts/delete-account.mjs <email> --apply   → supprime pour de bon
 *
 * Conventions reprises des scripts d'administration existants
 * (target-dossier.mjs, reconfigure-pasteur-ma, provision-hsoc-georgetown) :
 *   - lecture de .env.local.live, JAMAIS de .env.local (qui pointe vers un
 *     projet de developpement — c'est le piege qui a coute une demi-journee sur
 *     extend-trial.ts le 2026-08-26) ;
 *   - parseur tolerant au BOM, que dotenv ne retire pas ;
 *   - refus d'executer si l'URL ne contient pas la reference du projet de
 *     production ;
 *   - SIMULATION PAR DEFAUT, comme cleanup-test-subs.mjs : une suppression en
 *     base est irreversible, on regarde d'abord ce qui partirait.
 *
 * Ce que le script NE fait PAS, volontairement :
 *   - il ne touche pas a Stripe. .env.local.live ne porte aucune cle Stripe, et
 *     une annulation d'abonnement doit etre un geste conscient. Le compte-rendu
 *     affiche stripe_customer_id et stripe_subscription_id : s'ils existent, va
 *     les traiter dans le tableau de bord Stripe AVANT de supprimer, sinon
 *     l'abonnement continue de vivre sans plus aucune ligne qui le relie a
 *     quelqu'un (meme raisonnement que le commentaire de /api/user/delete).
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const PROD_REF = "tqznwmpkokdzrszysbcm";

const email = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!email || email.startsWith("--")) {
  console.error("Usage : node scripts/delete-account.mjs <email> [--apply]");
  process.exitCode = 1;
} else {
  await main(email);
}

async function main(rawEmail) {
  const target = rawEmail.trim().toLowerCase();

  const env = readFileSync(".env.local.live", "utf8");
  const getEnv = (key) => {
    const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
    if (!m) return "";
    return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
  };

  const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL.includes(PROD_REF)) {
    throw new Error("Refus : .env.local.live ne pointe pas vers le projet de production.");
  }
  if (!SERVICE_KEY) {
    throw new Error("Refus : SUPABASE_SERVICE_ROLE_KEY absente de .env.local.live.");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Identite resolue via Auth, pas via profiles.email : Auth est la source de
  // verite du login et la comparaison y est insensible a la casse.
  let user = null;
  for (let page = 1; page <= 20 && !user; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers : ${error.message}`);
    if (!data.users.length) break;
    user = data.users.find((u) => (u.email ?? "").toLowerCase() === target) ?? null;
  }

  if (!user) {
    console.log(`Aucun compte Auth pour ${target} — rien a supprimer.`);
    return;
  }

  const providers = user.app_metadata?.providers ?? [user.app_metadata?.provider].filter(Boolean);

  console.log(`\nCompte trouve`);
  console.log(`  id            ${user.id}`);
  console.log(`  email         ${user.email}`);
  console.log(`  cree le       ${user.created_at}`);
  console.log(`  fournisseur   ${providers.join(", ") || "inconnu"}`);
  console.log(`  derniere connexion ${user.last_sign_in_at ?? "jamais"}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, locale")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    console.log(`\nProfil`);
    console.log(`  plan          ${profile.plan}`);
    console.log(`  essai jusqu'au ${profile.trial_ends_at ?? "—"}`);
    console.log(`  stripe client ${profile.stripe_customer_id ?? "—"}`);
    console.log(`  stripe abo    ${profile.stripe_subscription_id ?? "—"}`);
  } else {
    console.log(`\nProfil : aucune ligne dans profiles.`);
  }

  // Comptage des lignes liees. Une table absente ou sans la colonne attendue
  // est signalee, pas fatale : ce script doit survivre a l'evolution du schema.
  const RELATED = [
    ["user_alert_regions", "user_id"],
    ["outbreak_alert_log", "user_id"],
    ["product_events", "user_id"],
    ["disease_alert_log", "user_id"],
    ["watchlist_alert_log", "user_id"],
    ["weekly_email_send_log", "user_id"],
    ["subscriptions", "email"],
  ];

  console.log(`\nLignes liees`);
  const counts = {};
  for (const [table, column] of RELATED) {
    const value = column === "email" ? user.email : user.id;
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    if (error) {
      console.log(`  ${table.padEnd(24)} n/a (${error.message.slice(0, 60)})`);
      continue;
    }
    counts[table] = count ?? 0;
    console.log(`  ${table.padEnd(24)} ${count ?? 0}`);
  }

  if (!APPLY) {
    console.log(`\nSIMULATION — rien n'a ete supprime.`);
    if (profile?.stripe_subscription_id) {
      console.log(`ATTENTION : un abonnement Stripe existe. Traite-le dans Stripe AVANT --apply.`);
    }
    console.log(`Relance avec --apply pour supprimer.`);
    return;
  }

  const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
  if (delErr) throw new Error(`deleteUser : ${delErr.message}`);
  console.log(`\nCompte Auth supprime.`);

  // Verification apres coup : ce que les FK n'ont pas emporte. Les lignes
  // clefees sur l'e-mail (subscriptions) ne cascadent pas et bloqueraient une
  // reinscription propre.
  console.log(`\nReste apres cascade`);
  for (const [table, column] of RELATED) {
    if (!(table in counts)) continue;
    const value = column === "email" ? user.email : user.id;
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    if (error) continue;
    const flag = (count ?? 0) > 0 ? "  ← a nettoyer a la main" : "";
    console.log(`  ${table.padEnd(24)} ${count ?? 0}${flag}`);
  }
}

// Supprime les lignes de test de la table subscriptions (abonnés digest).
//
// 2026-08-23 : la liste en dur était périmée. Le panel admin comptait 15 abonnés
// digest dont 6 comptes de test, soit 40 % — assez pour fausser tout taux
// d'ouverture ou d'engagement calculé sur cette table. Cinq de ces six
// n'étaient pas dans l'ancienne liste (`stripe-payment-test-20260704@`,
// `test-webhook@`, `e2e@`, `test-e2e-20260618@`, `test-e2e-b-20260618@`).
//
// Deux changements pour que ça ne se reproduise pas :
//   1. Détection par MOTIF plutôt que par liste nominative, pour attraper les
//      adresses horodatées créées par les prochains tests e2e.
//   2. SIMULATION PAR DÉFAUT. Le script n'efface rien sans `--apply`. Une
//      suppression en base est irréversible et un motif trop large ferait des
//      dégâts silencieux : on regarde d'abord ce qui sortirait.
//
// Usage :
//   node scripts/cleanup-test-subs.mjs           → liste ce qui serait supprimé
//   node scripts/cleanup-test-subs.mjs --apply   → supprime pour de bon

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

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

const supabase = createClient(
  clean(vars["NEXT_PUBLIC_SUPABASE_URL"]),
  clean(vars["SUPABASE_SERVICE_ROLE_KEY"])
);

const apply = process.argv.includes("--apply");

// Motifs de test. Volontairement ancrés : `test` doit être un segment
// d'adresse, pas une sous-chaîne — sinon une vraie adresse comme
// `contact@protestant-health.org` serait emportée.
const TEST_PATTERNS = [
  { re: /@example\.com$/i,                    why: "domaine d'exemple réservé (RFC 2606)" },
  { re: /@healthwatch-test\.dev$/i,           why: "domaine de test e2e" },
  { re: /^e2e@/i,                             why: "compte e2e" },
  { re: /^test[-.]/i,                         why: "préfixe test-" },
  { re: /^stripe[-.].*test/i,                 why: "compte de test Stripe" },
  { re: /^[^@]*-test-\d{8}@/i,                why: "compte de test horodaté" },
  { re: /^[^@]*test-e2e/i,                    why: "compte e2e horodaté" },
];

const matchTest = (email) => TEST_PATTERNS.find((p) => p.re.test(String(email || "")));

const { data: subs, error: readErr } = await supabase
  .from("subscriptions")
  .select("id, email, region, locale, active, created_at")
  .order("created_at", { ascending: false });

if (readErr) {
  console.error("Erreur de lecture :", readErr);
  process.exit(1);
}

const flagged = [];
for (const s of subs ?? []) {
  const hit = matchTest(s.email);
  if (hit) flagged.push({ ...s, why: hit.why });
}

console.log(`Abonnés digest en base : ${subs?.length ?? 0}`);
console.log(`Identifiés comme test  : ${flagged.length}`);
console.log("");

if (flagged.length === 0) {
  console.log("Rien à nettoyer.");
  process.exit(0);
}

for (const f of flagged) {
  const state = f.active ? "actif" : "inactif";
  console.log(`  ${f.email}`);
  console.log(`     ${f.why} · ${state} · inscrit le ${String(f.created_at).slice(0, 10)}`);
}
console.log("");

// Garde-fou : si le motif attrape la majorité de la table, c'est le motif qui
// est faux, pas les données. On refuse plutôt que de vider la table.
const share = flagged.length / Math.max(1, subs?.length ?? 0);
if (share > 0.6) {
  console.error(`⛔ ${Math.round(share * 100)} % de la table correspond aux motifs — refus par sécurité.`);
  console.error("   Vérifiez TEST_PATTERNS avant de relancer.");
  process.exit(1);
}

if (!apply) {
  console.log("SIMULATION — rien n'a été supprimé.");
  console.log("Relancez avec --apply pour supprimer ces lignes.");
  process.exit(0);
}

const { error: delErr, count } = await supabase
  .from("subscriptions")
  .delete({ count: "exact" })
  .in("id", flagged.map((f) => f.id));

if (delErr) {
  console.error("Erreur de suppression :", delErr);
  process.exit(1);
}

console.log(`✅ ${count ?? flagged.length} ligne(s) de test supprimée(s).`);
console.log(`   Abonnés digest restants : ${(subs?.length ?? 0) - (count ?? flagged.length)}`);

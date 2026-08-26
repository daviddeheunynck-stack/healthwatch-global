/**
 * Le verrou de déduplication inter-crons fonctionne-t-il, aujourd'hui ?
 *
 * POURQUOI. `outbreak_alert_daily_lock` empêche qu'un même foyer parte trois
 * fois vers la même boîte (watchlist, puis disease, puis regional). Il est
 * conçu pour ÉCHOUER OUVERT : si la réclamation ne peut pas être posée, les
 * alertes partent quand même. C'est le bon choix — mieux vaut un doublon qu'une
 * alerte perdue — mais ça rend la panne invisible.
 *
 * Elle s'est produite deux fois :
 *   · 24/08 au soir : migration présente dans le dépôt, jamais appliquée.
 *   · 25/08 : migration appliquée, mais PostgREST ne voyait pas la table — son
 *     cache de schéma n'avait pas été rechargé. 117 alertes livrées le 25/08
 *     entre 10h et 12h UTC sans une seule réclamation posée.
 *
 * Ce script interroge la table PAR LE MÊME CHEMIN que les crons — l'API REST,
 * pas SQL direct — parce que c'est là que ça casse. Une table qui existe en
 * base mais qu'un `select` REST ne voit pas, c'est précisément le 25/08.
 *
 * Lecture seule. Usage : node scripts/check-alert-lock.mjs [--days=3]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const daysArg = process.argv.find((a) => a.startsWith("--days="));
const DAYS = daysArg ? Number(daysArg.slice("--days=".length)) : 3;

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

const vars = parseEnv(".env.local.live");
const SUPABASE_URL = clean(vars["NEXT_PUBLIC_SUPABASE_URL"]);
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  throw new Error("Refus : ceci ne ressemble pas au projet de production.");
}
const supabase = createClient(SUPABASE_URL, clean(vars["SUPABASE_SERVICE_ROLE_KEY"]), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
const dayOf = (iso) => (iso || "").slice(0, 10);

// ── 1. PostgREST voit-il la table ? ─────────────────────────────────────────
console.log(`\n${"═".repeat(70)}\n1. LA TABLE EST-ELLE VISIBLE DE L'API ?\n${"═".repeat(70)}`);

const probe = await supabase.from("outbreak_alert_daily_lock").select("*").limit(1);

if (probe.error) {
  console.log(`🔴 ${probe.error.message}`);
  if (/schema cache|does not exist|PGRST205/i.test(probe.error.message + (probe.error.code ?? ""))) {
    console.log(`\n   La table existe peut-être en base sans que l'API la voie.`);
    console.log(`   Vérifier, puis recharger le cache, dans l'éditeur SQL Supabase :`);
    console.log(`     select to_regclass('public.outbreak_alert_daily_lock');`);
    console.log(`     notify pgrst, 'reload schema';`);
  }
  console.log(`\n⇒ Le verrou est MUET : les alertes partent sans déduplication.\n`);
  process.exit(1);
}
console.log("✅ Table lisible par l'API REST — le chemin qu'empruntent les crons.");

// ── 2. Le verrou est-il réellement utilisé ? ────────────────────────────────
console.log(`\n${"═".repeat(70)}\n2. RÉCLAMATIONS vs ALERTES LIVRÉES (${DAYS} j)\n${"═".repeat(70)}`);

const { data: locks, error: lockErr } = await supabase
  .from("outbreak_alert_daily_lock")
  .select("*")
  .gte("claimed_at", since);

const { data: sent, error: sentErr } = await supabase
  .from("outbreak_alert_log")
  .select("user_id, outbreak_id, sent_at")
  .gte("sent_at", since);

if (lockErr) console.log(`⚠️  Lecture des verrous : ${lockErr.message}`);
if (sentErr) console.log(`⚠️  Lecture des envois : ${sentErr.message}`);

const byDay = {};
for (const l of locks ?? []) {
  const d = dayOf(l.claimed_at);
  (byDay[d] ??= { locks: 0, sent: 0 }).locks++;
}
for (const s of sent ?? []) {
  const d = dayOf(s.sent_at);
  (byDay[d] ??= { locks: 0, sent: 0 }).sent++;
}

const daysSorted = Object.keys(byDay).sort();
if (daysSorted.length === 0) {
  console.log("Aucune alerte ni réclamation sur la période — rien à conclure.");
  console.log("Relancer après le prochain passage des crons d'alerte.\n");
  process.exit(0);
}

console.log("jour         alertes livrées   réclamations posées");
let silent = 0;
for (const d of daysSorted) {
  const { locks: L, sent: S } = byDay[d];
  const bad = S > 0 && L === 0;
  if (bad) silent++;
  console.log(`${d}   ${String(S).padStart(13)}   ${String(L).padStart(17)}${bad ? "   🔴 VERROU MUET" : ""}`);
}

console.log(`\n${"─".repeat(70)}`);
if (silent > 0) {
  console.log(`🔴 ${silent} jour(s) où des alertes sont parties sans qu'aucune réclamation`);
  console.log(`   soit posée. Un même foyer a pu atteindre une boîte jusqu'à trois fois`);
  console.log(`   (watchlist → disease → regional).`);
} else {
  console.log(`✅ Chaque jour avec des envois porte des réclamations : la déduplication`);
  console.log(`   a fonctionné sur toute la période.`);
}
console.log("");
process.exit(silent > 0 ? 1 : 0);

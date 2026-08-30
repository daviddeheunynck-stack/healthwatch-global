#!/usr/bin/env node
// Refuse un push dont les migrations locales ne sont pas appliquees en base.
//
// Deux incidents en deux jours, meme signature :
//
//   2026-08-24 — `weekly_email_claim` appliquee en prod sans fichier local, sa
//   remplacante `weekly_email_send_log` (le nom que le code utilise) jamais
//   appliquee : le verrou email hebdomadaire etait inoperant en production
//   depuis la veille au soir.
//
//   2026-08-25 — `20260824040000_outbreak_alert_daily_lock` presente dans le
//   depot, absente de la base. Meme consequence : la deduplication inter-crons
//   des trois canaux d'alerte etait inoperante, en silence.
//
// Ce qui rend cette classe d'ecart dangereuse, c'est que les verrous concernes
// ECHOUENT OUVERT (claimOutbreakAlertDaily, claimWeeklyEmailAddress dans
// lib/cron-monitor.ts) : table absente -> erreur -> "autorise, envoie". Un cron
// mal planifie se voit ; une table absente n'apparait nulle part, et le run est
// journalise "ok".
//
// La lecon avait ete tiree le 24 ("verifier `supabase migration list` avant de
// supposer qu'un lot est deploye") mais elle est restee une consigne. Meme
// arbitrage que pour les crons : un mecanisme plutot qu'une bonne intention.
//
// Sur pre-push et NON sur prebuild : le build Vercel n'a ni la CLI Supabase ni
// le lien projet, et un controle qui ne peut pas s'executer la ou il compte ne
// protege personne. Le moment utile est celui ou on publie du code qui suppose
// un schema.
//
// Ne bloque jamais sur une absence d'infrastructure (CLI absente, projet non
// lie, reseau coupe) : il previent et laisse passer. Le seul echec est un ecart
// reellement constate.
//
// Sur l'analyse de la sortie : la premiere version cherchait des cellules
// exactement egales a 14 chiffres et n'a jamais rien reconnu — la CLI entoure
// chaque version de backticks (`20260824040000`). Le contrele s'est donc annonce
// "illisible" et a tout laisse passer, ce qui est le bon repli mais protege
// zero. On extrait desormais la premiere suite de 14 chiffres de la cellule,
// quels que soient les guillemets, et on accepte les separateurs ASCII comme
// box-drawing, pour qu'une mise a jour de la CLI ne le recasse pas en silence.
// La colonne Time contient parfois elle aussi une valeur a 14 chiffres (des
// horodatages mal formes existent dans l'historique) : elle n'est jamais lue.
//
// Usage :
//   npm run check:migrations
//   node scripts/check-migrations-applied.mjs --debug   (affiche la sortie brute)

import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const DEBUG = process.argv.includes("--debug");
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const FILE_RE = /^(\d{14})_(.+)\.sql$/;
const ANSI_RE = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");
const SEPARATOR_RE = /[|│┃]/; // "|" ASCII, et les traits verticaux Unicode
const VERSION_IN_CELL_RE = /(\d{14})/;

function skip(reason) {
  console.warn(`[check-migrations] ignore : ${reason}`);
  console.warn("[check-migrations] aucun ecart verifie — ce n'est PAS un feu vert.");
  if (!DEBUG) console.warn("[check-migrations] pour voir la sortie brute : node scripts/check-migrations-applied.mjs --debug");
  process.exitCode = 0;
}

function run() {
  if (!existsSync(MIGRATIONS_DIR)) return skip("supabase/migrations introuvable");

  const local = new Map();
  for (const file of readdirSync(MIGRATIONS_DIR)) {
    const m = FILE_RE.exec(file);
    if (m) local.set(m[1], m[2]);
  }
  if (local.size === 0) return skip("aucune migration locale");

  // `--linked` interroge le projet reference dans supabase/.temp/project-ref.
  //
  // Commande passee en UNE chaine avec `shell: true`, et non en tableau
  // d'arguments. Les deux autres formes ont ete essayees et echouent :
  //   - tableau + shell:true  -> fonctionne, mais declenche DEP0190 a chaque run ;
  //   - "npx.cmd" sans shell  -> EINVAL sur Windows (Node refuse de spawner un
  //     .cmd hors shell depuis le correctif de securite de Node 20.12).
  // Une chaine unique avec shell:true evite les deux. Aucun risque d'injection :
  // la commande est un litteral, rien n'y est interpole.
  //
  // PAS de `npx` devant `supabase` (trouve le 30/08 : le controle echouait "ignore"
  // a CHAQUE push depuis sa creation le 23/08, jamais une seule execution reelle).
  // La CLI Supabase officielle interdit son propre `npm install -g` — sur cette
  // machine elle est installee via Scoop et vit sur le PATH, jamais dans le cache
  // npm/npx. `npx --no-install supabase ...` ne cherche PAS le PATH : il ne regarde
  // que node_modules/.bin puis le cache npx local, et `--no-install` lui interdit
  // d'aller chercher le paquet npm `supabase` sur le registre pour combler
  // l'absence. Resultat mesure : npx echoue immediatement avec "canceled due to
  // missing packages and no YES option", intercepte plus bas comme une simple
  // absence d'infrastructure (repli volontaire, correct dans son principe) — mais
  // qui se produisait donc SYSTEMATIQUEMENT, jamais seulement en son absence
  // reelle. `supabase migration list --linked` direct (sur le PATH, shell:true
  // gere sa resolution) fonctionne et renvoie la vraie table locale/distante.
  const res = spawnSync("supabase migration list --linked", {
    shell: true,
    encoding: "utf8",
    timeout: 60_000,
  });

  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`.replace(ANSI_RE, "");
  if (DEBUG) {
    console.log("─── sortie brute de `supabase migration list --linked` ───");
    console.log(out);
    console.log("─────────────────────────────────────────────────────────");
  }

  if (res.error || res.status !== 0) {
    return skip(`\`supabase migration list\` a echoue (${res.error?.message ?? `code ${res.status}`})`);
  }

  const localSeen = new Set();
  const remoteSeen = new Set();
  for (const line of out.split(/\r?\n/)) {
    const cols = line.split(SEPARATOR_RE);
    if (cols.length < 2) continue;
    const l = VERSION_IN_CELL_RE.exec(cols[0] ?? "")?.[1];
    const r = VERSION_IN_CELL_RE.exec(cols[1] ?? "")?.[1];
    if (l) localSeen.add(l);
    if (r) remoteSeen.add(r);
  }

  if (localSeen.size === 0 && remoteSeen.size === 0) {
    return skip("sortie de `supabase migration list` illisible (le format a peut-etre change)");
  }

  const missing = [...local.keys()].filter((v) => !remoteSeen.has(v)).sort();
  // L'autre moitie de l'incident du 24 : une migration appliquee en prod dont le
  // fichier n'existe pas ici. Signale sans bloquer — un clone partiel ou un
  // historique repare produisent le meme symptome.
  const orphans = [...remoteSeen].filter((v) => !local.has(v)).sort();

  if (orphans.length > 0) {
    console.warn("");
    console.warn("[check-migrations] appliquees en base, sans fichier local :");
    for (const v of orphans) console.warn(`    ${v}`);
    console.warn("  Verifier qu'aucune n'a ete renommee ou perdue (cf. weekly_email_claim, 24/08).");
  }

  if (missing.length === 0) {
    console.log(`[check-migrations] ${local.size} migration(s) locale(s), toutes appliquees en base.`);
    process.exitCode = 0;
    return;
  }

  console.error("");
  console.error("PUSH REFUSE — migrations presentes dans le depot, absentes de la base :");
  for (const v of missing) console.error(`    ${v}_${local.get(v)}.sql`);
  console.error("");
  console.error("  Le code qui suppose ces tables echouera en production, et les verrous");
  console.error("  concernes echouent OUVERT : la panne sera silencieuse.");
  console.error("");
  console.error("  Appliquer :   supabase db push");
  console.error("  Puis relancer le push.");
  console.error("");
  console.error("  Si l'ecart est voulu :   git push --no-verify");
  console.error("");
  process.exitCode = 1;
}

run();

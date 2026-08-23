// Compare vercel.json au registre canonique docs/cron-registry.md, et fait
// échouer le build en cas d'écart.
//
// Motif : jusqu'au 2026-08-23 il n'existait qu'une seule source pour les horaires
// de cron. Une dérive était donc invisible par construction — rien ne pouvait la
// contredire. Quatre routes (check-mpox-sitrep, sync-africa-cdc, sync-who-afro,
// sync-who-emro) ont tourné tous les jours pendant des semaines en annonçant dans
// leur propre en-tête un rythme bihebdomadaire ou trihebdomadaire. Personne ne
// l'a vu jusqu'à ce qu'on lise les 50 en-têtes à la main.
//
// Branché sur `prebuild`, donc il tourne aussi chez Vercel : un garde-fou qui
// dépend d'un geste manuel n'en est pas un (même raisonnement que
// scripts/setup-git-hooks.mjs).
//
// VOLONTAIREMENT STRICT ET BÊTE. Ne compare que deux chaînes exactes de part et
// d'autre — le chemin et l'expression cron. Ne lit jamais la colonne « Rôle », qui
// est de la prose. Un build ne peut donc pas casser sur une tournure de phrase.
// C'est la condition pour qu'on ose le mettre en bloquant.
//
// Le contrôle d'en-tête plus bas est d'une autre nature : il devine un rythme
// depuis un commentaire en anglais libre. C'est utile mais faillible, donc il
// AVERTIT sans jamais faire échouer. Ne pas le passer en bloquant sans le rendre
// déterministe d'abord (p. ex. un marqueur lisible par machine dans chaque route).

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERCEL = join(repoRoot, "vercel.json");
const REGISTRY = join(repoRoot, "docs", "cron-registry.md");

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function fail(lines) {
  console.error("");
  console.error(red("BUILD REFUSÉ — vercel.json et docs/cron-registry.md divergent."));
  console.error("");
  for (const l of lines) console.error(`  ${l}`);
  console.error("");
  console.error("  Les deux doivent changer dans la même passe. Voir la section");
  console.error("  « Comment ce fichier est tenu » de docs/cron-registry.md.");
  console.error("");
  process.exit(1);
}

// ── Lecture des deux sources ────────────────────────────────────────────────
if (!existsSync(VERCEL)) fail(["vercel.json introuvable."]);
if (!existsSync(REGISTRY)) {
  fail([
    "docs/cron-registry.md introuvable.",
    "Ce fichier est la source de vérité des horaires ; sans lui, ce contrôle n'a rien à comparer.",
  ]);
}

let vercel;
try {
  vercel = JSON.parse(readFileSync(VERCEL, "utf8"));
} catch (err) {
  fail([`vercel.json est illisible : ${err.message}`]);
}

const live = new Map();
for (const c of vercel.crons ?? []) {
  if (live.has(c.path)) {
    fail([`vercel.json déclare deux fois le même chemin : ${c.path}`]);
  }
  live.set(c.path, c.schedule);
}

// Lignes de table de la forme : | `/api/cron/x` | `0 9 * * *` | prose |
// La prose est capturée mais jamais comparée.
const registry = new Map();
const ROW = /^\|\s*`(\/api\/[^`]+)`\s*\|\s*`([^`]+)`\s*\|/;
let inRetired = false;
for (const line of readFileSync(REGISTRY, "utf8").split(/\r?\n/)) {
  // La section « Crons retirés » décrit ce qui ne doit PLUS tourner : ses lignes
  // ne sont pas des entrées actives, et les compter ici les ferait réapparaître
  // comme des manquants dans vercel.json à chaque build.
  if (/^##\s+Crons retirés/i.test(line)) inRetired = true;
  else if (/^##\s/.test(line)) inRetired = false;
  if (inRetired) continue;

  const m = line.match(ROW);
  if (!m) continue;
  const [, path, schedule] = m;
  if (registry.has(path)) {
    fail([`docs/cron-registry.md déclare deux fois le même chemin : ${path}`]);
  }
  registry.set(path, schedule.trim());
}

if (registry.size === 0) {
  fail([
    "Aucune entrée lue dans docs/cron-registry.md.",
    "Format attendu pour chaque ligne de table :",
    "  | `/api/cron/exemple` | `0 9 * * *` | à quoi ça sert |",
  ]);
}

// ── Comparaison ─────────────────────────────────────────────────────────────
const problems = [];

for (const [path, schedule] of live) {
  if (!registry.has(path)) {
    problems.push(`${path}  — dans vercel.json, absent du registre  ${dim(`(${schedule})`)}`);
  } else if (registry.get(path) !== schedule) {
    problems.push(
      `${path}  — horaires contradictoires : vercel.json dit ${red(schedule)}, le registre dit ${red(registry.get(path))}`,
    );
  }
}
for (const [path, schedule] of registry) {
  if (!live.has(path)) {
    problems.push(`${path}  — dans le registre, absent de vercel.json  ${dim(`(${schedule})`)}`);
  }
}

if (problems.length > 0) fail(problems);

// ── Avertissement non bloquant : en-tête de route vs horaire réel ───────────
// Cherche dans les 12 premières lignes un rythme annoncé en toutes lettres qui
// contredit le jour-de-semaine du cron. Heuristique : ne fait qu'avertir.
const DOW_CLAIMS = [
  { re: /\bMon\/Wed\/Fri\b|\bMonday\/Wednesday\/Friday\b/i, label: "Mon/Wed/Fri", dow: "1,3,5" },
  { re: /\bWed\s*\+\s*Sat\b/i, label: "Wed + Sat", dow: "3,6" },
  { re: /\bTwice-weekly\b/i, label: "twice-weekly", dow: "un jour restreint" },
];

const warnings = [];
for (const [path, schedule] of live) {
  const file = join(repoRoot, "app", "api", path.replace(/^\/api\//, ""), "route.ts");
  if (!existsSync(file)) {
    warnings.push(`${path} — aucun route.ts à ${dim(file.replace(repoRoot, "."))}`);
    continue;
  }
  const head = readFileSync(file, "utf8").split(/\r?\n/).slice(0, 12).join(" ");
  const dow = schedule.split(/\s+/)[4];
  if (dow !== "*") continue; // le cron restreint déjà les jours : rien à signaler
  for (const claim of DOW_CLAIMS) {
    if (claim.re.test(head)) {
      warnings.push(
        `${path} — l'en-tête annonce « ${claim.label} » mais le cron est quotidien ` +
          `(${schedule}). Attendu si l'en-tête a raison : jour-de-semaine ${claim.dow}.`,
      );
      break;
    }
  }
}

if (warnings.length > 0) {
  console.warn("");
  console.warn(yellow("Crons — en-têtes à vérifier (non bloquant) :"));
  for (const w of warnings) console.warn(`  ${w}`);
  console.warn("");
  console.warn(dim("  Ces écarts sont suivis dans docs/cron-registry.md, section « Écarts ouverts »."));
  console.warn(dim("  Détection heuristique sur commentaire libre : ne jamais la rendre bloquante en l'état."));
  console.warn("");
}

console.log(`[crons] ${live.size} crons, registre conforme${warnings.length ? `, ${warnings.length} en-tête(s) à vérifier` : ""}.`);

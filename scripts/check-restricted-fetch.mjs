#!/usr/bin/env node
// Refuse qu'une URL d'un éditeur qu'on n'a pas le droit de récupérer
// automatiquement entre dans le code applicatif.
//
// Pourquoi ce script existe : le 2026-08-28, un fetcher de
// polioeradication.org a été ajouté à sync-who-regional pour rattraper le retard
// des lignes cVDPV africaines. La restriction commerciale de ce site était déjà
// documentée depuis le 2026-07-29, mais dans le SKILL.md d'une routine — le
// message de retrait du 2026-09-04 (0df093ae) constate lui-même qu'elle « n'avait
// pas été recroisée au moment de construire ce cron un mois plus tard ». Sept
// jours d'ingestion. Le registre vit désormais dans lib/source-trust.ts
// (RESTRICTED_FETCH_DOMAINS) et ce script le fait respecter.
//
// Ce qu'il regarde : les URL (`scheme://hôte`) qui apparaissent dans un LITTÉRAL
// DE CHAÎNE de app/ ou lib/. Une adresse citée dans un commentaire n'est pas une
// récupération — et le dépôt en contient beaucoup, chaque interdiction étant
// expliquée à côté du code qu'elle concerne. Un nom de domaine nu
// ("polioeradication.org" dans une liste de correspondance de sources, ou dans
// les listes d'éditeurs de source-trust.ts) n'en est pas une non plus : seule une
// adresse qu'un fetch peut atteindre est signalée.
//
// scripts/ n'est délibérément pas balayé : les scripts one-off y sont des
// vérifications faites à la main, ce qui est précisément l'usage autorisé.
//
// Toute occurrence non déclarée dans ACKNOWLEDGED ci-dessous fait sortir en 1.
// Lancé par le hook pre-commit quand le commit touche app/ ou lib/, et par
// `npm run check:sources`.

import { readFileSync, readdirSync, statSync } from "node:fs";
import ts from "typescript";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { RESTRICTED_FETCH_DOMAINS } from "../lib/source-trust.ts";

const repoRoot = join(fileURLToPath(import.meta.url), "..", "..");
const SCAN_DIRS = ["app", "lib"];

// Occurrences connues et assumées, chacune avec son motif. Une entrée ici est une
// décision, pas une exemption commode : elle dit pourquoi cette URL peut rester.
const ACKNOWLEDGED = [
  {
    file:   "app/api/cron/data-quality/route.ts",
    domain: "polioeradication.org",
    why:    "Sonde de couverture polio (section 4j) : lit les noms de pays et la date d'arrêt du bulletin pour repérer un pays que la source rapporte et que la base ne contient pas. N'écrit rien en base et ne recopie aucun chiffre. ⚠️ NON TRANCHÉ — le message de 0df093ae (2026-09-04) affirme « plus aucun code du dépôt ne fetch ce domaine », ce qui est vrai de sync-who-regional et faux du dépôt. Arbitrage juridique laissé à David : garder la sonde, ou la retirer comme le fetcher.",
  },
  {
    file:   "app/api/cron/sync-who-regional/route.ts",
    domain: "reliefweb.int",
    why:    "RELIEFWEB_BASE + queryReliefWeb() : code mort derrière `const reliefWebOk = false` (2026-07-06), gardé en dur pour qu'un appname approuvé ne puisse jamais rallumer l'ingestion en silence. Aucun appel possible.",
  },
  {
    file:   "lib/reliefweb.ts",
    domain: "reliefweb.int",
    why:    "Gabarit de la colonne `source` dans le parseur conservé ; fetchReliefWebOutbreaks() rend [] sans appeler l'API et le module n'a aucun importeur (2026-07-06).",
  },
];

// Les URL qui comptent sont celles qui vivent dans un littéral de chaîne : une
// adresse citée dans un commentaire n'est pas une récupération, et le dépôt en
// contient beaucoup (chaque interdiction est expliquée à côté du code qu'elle
// concerne). Le parseur de TypeScript fait la distinction correctement, y compris
// pour les littéraux de regex — un découpage à la main s'y trompe : la fin de
// /^https?:\/\// contient littéralement "//" et fait passer le reste de la ligne
// pour un commentaire (constaté en écrivant ce script).
function stringLiteralsOf(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, /* setParentNodes */ false);
  const out = [];
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      out.push({
        text: node.text,
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      });
    }
    node.forEachChild(visit);
  };
  sf.forEachChild(visit);
  return out;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(name)) {
      yield full;
    }
  }
}

/** hôte exact ou sous-domaine, jamais une correspondance de sous-chaîne. */
function hostMatches(host, domain) {
  return host === domain || host.endsWith("." + domain);
}

const findings = [];
for (const scanDir of SCAN_DIRS) {
  for (const file of walk(join(repoRoot, scanDir))) {
    const rel = relative(repoRoot, file).split(sep).join("/");
    for (const lit of stringLiteralsOf(rel, readFileSync(file, "utf8"))) {
      for (const match of lit.text.matchAll(/[a-z][a-z0-9+.-]*:\/\/([a-z0-9.-]+)/gi)) {
        const host = match[1].toLowerCase();
        for (const entry of RESTRICTED_FETCH_DOMAINS) {
          if (!hostMatches(host, entry.domain)) continue;
          findings.push({ file: rel, line: lit.line, host, entry, text: lit.text.slice(0, 120) });
        }
      }
    }
  }
}

const isKnown = (f) => ACKNOWLEDGED.some((a) => a.file === f.file && a.domain === f.entry.domain);
const unknown = findings.filter((f) => !isKnown(f));
const known   = findings.filter(isKnown);

console.log(`[restricted-fetch] ${RESTRICTED_FETCH_DOMAINS.length} éditeur(s) non récupérables, ${findings.length} occurrence(s) d'URL dans app/ et lib/.`);

if (known.length > 0) {
  console.log(`\n${known.length} occurrence(s) déclarée(s) :`);
  for (const f of known) {
    const ack = ACKNOWLEDGED.find((a) => a.file === f.file && a.domain === f.entry.domain);
    console.log(`  ${f.file}:${f.line}  ${f.host}`);
    console.log(`      ${ack.why}`);
  }
}

// Une entrée déclarée qui ne correspond plus à rien : le code a bougé, la
// justification est périmée. Signalé sans bloquer — retirer l'entrée.
const stale = ACKNOWLEDGED.filter((a) => !findings.some((f) => f.file === a.file && f.entry.domain === a.domain));
if (stale.length > 0) {
  console.log(`\n${stale.length} déclaration(s) sans occurrence — à retirer de ACKNOWLEDGED :`);
  for (const a of stale) console.log(`  ${a.file}  ${a.domain}`);
}

if (unknown.length === 0) {
  console.log("\nAucune URL non déclarée. OK.");
  process.exit(0);
}

console.error(`\n❌ ${unknown.length} URL(s) sur un éditeur qu'on n'a pas le droit de récupérer automatiquement :`);
for (const f of unknown) {
  console.error(`\n  ${f.file}:${f.line}`);
  console.error(`    ${f.text}`);
  console.error(`    ${f.entry.domain} — interdit d'ingestion automatique depuis le ${f.entry.since}`);
  console.error(`    ${f.entry.why}`);
}
console.error(`
Une vérification humaine qui lit le bulletin et recopie un chiffre reste
autorisée pour ces éditeurs — c'est la récupération automatique qui ne l'est
pas. Si cette URL n'est pas un fetch (code mort neutralisé, gabarit de colonne
\`source\`, sonde en lecture seule), déclare-la dans ACKNOWLEDGED en haut de
scripts/check-restricted-fetch.mjs avec son motif.
`);
process.exit(1);

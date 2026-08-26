// Contrôle de la couverture régionale annoncée aux utilisateurs.
//
// `lib/region-coverage.ts` dérive de `lib/geo-data.ts` le nombre de pays de
// chaque région d'alerte, et ce chiffre s'affiche dans le sélecteur du compte
// et en pied des e-mails d'alerte. Un chiffre faux à cet endroit-là est pire
// que pas de chiffre du tout : c'est la première chose qu'un épidémiologiste
// ira vérifier, et tout l'argument de vente porte sur la vérifiabilité.
//
// Ce script RE-DÉRIVE la couverture indépendamment, en lisant geo-data.ts comme
// du texte, sans importer region-coverage.ts. C'est délibéré : deux chemins qui
// tombent d'accord valent une vérification, un seul chemin qui se vérifie
// lui-même ne vaut rien.
//
// Usage: node scripts/check-region-coverage.mjs
// Sort en code 1 si quelque chose cloche — branchable sur prebuild si besoin.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "lib", "geo-data.ts"), "utf8");

const REGIONS = ["africa", "asia", "americas", "europe", "oceania"];
const NOT_A_COUNTRY = new Set(["Global", "Multiple countries", "EU/EEA"]);
const isRealCountry = (en) => !NOT_A_COUNTRY.has(en) && !/\(regional\)$/i.test(en);

const ENTRY = /^\s*"([^"]+)":\s*\{[^}]*region:\s*"(\w+)"[^}]*name_en:\s*"([^"]+)"/gm;

const entries = [];
let m;
while ((m = ENTRY.exec(src)) !== null) {
  entries.push({ key: m[1], region: m[2], en: m[3] });
}

const problems = [];
if (entries.length < 150) {
  problems.push(`Seulement ${entries.length} entrées lues dans geo-data.ts — le format a probablement changé et cette regex ne le suit plus.`);
}

// 1. Toute région rencontrée doit être une des cinq régions d'abonnement.
const unknown = [...new Set(entries.map((e) => e.region))].filter((r) => !REGIONS.includes(r));
if (unknown.length) {
  problems.push(`Régions inconnues dans geo-data.ts : ${unknown.join(", ")}. Elles ne correspondent à aucune valeur de user_alert_regions.region.`);
}

// 2. Un même pays ne doit pas être classé dans deux régions différentes.
//    (Arrive quand on ajoute une variante OMS en recopiant la mauvaise ligne.)
const regionOf = new Map();
for (const e of entries) {
  const prev = regionOf.get(e.en);
  if (prev && prev !== e.region) {
    problems.push(`"${e.en}" est classé à la fois en ${prev} et en ${e.region}.`);
  }
  regionOf.set(e.en, e.region);
}

// 3. Les pseudo-entrées connues ne doivent jamais entrer dans un décompte.
//    Si geo-data en gagne une nouvelle, elle sera comptée comme un pays et le
//    chiffre affiché deviendra faux en silence — d'où ce garde-fou explicite.
// Attention à ne pas être trop large : "UAE", "Chad" ou "Cuba" sont des pays.
// On ne signale que trois formes reconnaissables d'agrégat.
const SUSPECT_WORD = /^(global|multiple countries|unknown|other|worldwide|international)$/i;
const SUSPECT_REGIONAL = /\bregional\b/i;
const SUSPECT_ACRONYM = /^[A-Z]{2,6}(\/[A-Z]{2,6})+$/; // "EU/EEA"
const uncounted = [...new Set(entries.map((e) => e.en))].filter((en) => !isRealCountry(en));
const suspicious = [...new Set(entries.map((e) => e.en))].filter(
  (en) =>
    isRealCountry(en) &&
    (SUSPECT_WORD.test(en) || SUSPECT_REGIONAL.test(en) || SUSPECT_ACRONYM.test(en)),
);
if (suspicious.length) {
  problems.push(
    `Entrées comptées comme des pays alors qu'elles ressemblent à des agrégats : ${suspicious.join(", ")}. ` +
    `Si c'en sont, ajoutez-les à NOT_A_COUNTRY dans lib/region-coverage.ts ET ici.`,
  );
}

// 4. Décompte final, dédoublonné sur name_en (les variantes OMS partagent un nom).
const counts = Object.fromEntries(REGIONS.map((r) => [r, new Set()]));
for (const e of entries) {
  if (!isRealCountry(e.en)) continue;
  counts[e.region]?.add(e.en);
}

const EXPECTED_MIN = { africa: 50, asia: 40, americas: 20, europe: 30, oceania: 15 };
for (const r of REGIONS) {
  const n = counts[r].size;
  if (n < EXPECTED_MIN[r]) {
    problems.push(`${r} ne compte que ${n} pays (attendu ≥ ${EXPECTED_MIN[r]}) — une suppression est passée inaperçue.`);
  }
}

console.log("───────── Couverture régionale annoncée ─────────");
for (const r of REGIONS) {
  console.log(`${r.padEnd(9)} ${String(counts[r].size).padStart(3)} pays`);
}
console.log(`\nentrées lues : ${entries.length}`);
console.log(`noms uniques : ${regionOf.size}`);
console.log(`non comptées (agrégats, fourre-tout) : ${uncounted.join(", ") || "aucune"}`);
console.log("─────────────────────────────────────────────────");

if (problems.length) {
  console.error("\n❌ Problèmes :");
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}
console.log("\n✅ Couverture cohérente.");

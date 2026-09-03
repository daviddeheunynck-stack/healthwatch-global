// Génère marketing/qa/claimable-facts.json : la liste fermée des chiffres qu'un
// message sortant a le droit d'avancer.
//
// Principe : un agent ne « se souvient » pas d'un chiffre, il le cite depuis ce
// fichier ou il ne le cite pas. check-outreach-message.mjs refuse tout nombre du
// brouillon qui n'existe pas ici (ou dans le fil de discussion fourni).
//
// Lecture seule côté Supabase. À lancer au début de chaque routine d'outreach,
// avant la rédaction, jamais après.
//
// Usage :
//   node scripts/build-claimable-facts.mjs                 # prod (.env.local.live)
//   node scripts/build-claimable-facts.mjs .env.local      # projet dev
//
// Node >= 22.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { normalizeDisease } from "../lib/disease-data.ts";

const OUT = "marketing/qa/claimable-facts.json";

// Au-delà, un chiffre est considéré comme périmé : il peut avoir été révisé par
// un bulletin plus récent que la base n'a pas encore intégré.
const STALE_AFTER_DAYS = 10;

const envFile = process.argv[2] ?? ".env.local.live";
const env = readFileSync(envFile, "utf-8");
const getEnv = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^["']|["']$/g, "");
};

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(`ABORT — ${envFile} n'a pas NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.`);
  process.exit(1);
}

const select =
  "id,disease,disease_en,country,country_en,cases,deaths,date,source,active,source_priority,updated_at,source_confirmed_at,is_seed,response_phase";
const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?select=${select}&limit=5000`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
if (!res.ok) {
  console.error(`ABORT — Supabase ${res.status} : ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();

const now = new Date();
const ageDays = (iso) => (iso ? Math.floor((now - new Date(iso)) / 86_400_000) : Infinity);

// Fraîcheur canonique, dispositif déployé le 2026-08-24 : `updated_at` est un
// horodatage d'ÉCRITURE, pas de vérification. Un cron qui relit la source et
// constate qu'elle n'a pas bougé tamponne `source_confirmed_at` sans toucher
// `updated_at` (un trigger l'en empêche). Mesurer l'ancienneté sur `updated_at`
// seul fait donc passer pour figée une ligne vérifiée ce matin.
//
// Le tampon est AUTO-INVALIDANT et cette règle n'est pas optionnelle : il ne
// compte que tant que `source_confirmed_at >= date`. Si un cron avance `date`
// juste après qu'un autre a tamponné, la comparaison cesse de tenir d'elle-même
// et la ligne retombe en vieillissement ordinaire. C'est la définition portée
// par isConfirmedCurrent() / isSourceConfirmed() ; la redériver autrement ici
// ferait honorer au registre un tampon que le site lui-même ignore.
//
// Depuis le 2026-08-31 la règle a une SECONDE condition, et le registre la suit
// pour la même raison : le tampon périme au bout de CONFIRMATION_MAX_AGE_DAYS
// (60 j, = STALE_DAYS, voir lib/source-confirmed.ts). L'auto-invalidation
// ci-dessus ne joue en effet que si `date` avance — c'est-à-dire seulement
// quand le cron d'ingestion marche. S'il tombe, `date` se fige et le dernier
// tampon écrit avant la panne vaut certificat de fraîcheur indéfiniment. Un
// registre de faits citables ne peut pas s'appuyer sur ça.
const CONFIRMATION_MAX_AGE_MS = 60 * 86_400_000;
const isConfirmedCurrent = (o) =>
  Boolean(o.source_confirmed_at) &&
  Boolean(o.date) &&
  new Date(o.source_confirmed_at).getTime() >= new Date(o.date).getTime() &&
  Date.now() - new Date(o.source_confirmed_at).getTime() <= CONFIRMATION_MAX_AGE_MS;

const confirmedAt = (o) => {
  const dates = [o.updated_at];
  if (isConfirmedCurrent(o)) dates.push(o.source_confirmed_at);
  const valid = dates.filter(Boolean).map((d) => new Date(d));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid)).toISOString();
};

// Seules les lignes réellement affichées sur le site sont citables : citer une
// ligne d'archive à un épidémiologiste, c'est lui donner un chiffre que le site
// ne montre pas et qu'il ne pourra pas retrouver.
//
// Et JAMAIS une ligne de seed. `is_seed = true` marque une donnée de peuplement
// non vérifiée : l'audit du 2026-06-15 interdit de la citer comme fait établi
// (les anciennes lignes UNVERIFIED). Elle peut rester affichée sur le site sans
// être défendable dans un message à un épidémiologiste.
const sixtyDaysAgo = new Date(now - 60 * 86_400_000).toISOString().split("T")[0];
// `response_phase === "contained"` est un signal de clôture explicite (l'autorité
// compétente a déclaré l'événement terminé), à distinguer du « pas encore de
// bulletin frais » que couvre la fenêtre de grâce de 60 j ci-dessous. Le site
// l'applique depuis le 02/08 dans isDisplayActive() (lib/outbreaks.ts), mais ce
// registre — écrit après — ne l'avait jamais repris : il était donc PLUS permissif
// que le site et exposait comme « citables » des foyers que le site n'affiche
// plus. Trouvé le 03/09 sur exactement les lignes que le correctif du 02/08
// nommait déjà : Ebola/Ouganda (clos le 28/07, Ouganda certifié exempt par l'OMS
// le 26/08), Ebola/Allemagne et Nipah/Inde. Une routine LinkedIn pouvait citer
// comme en cours un foyer clos depuis plus d'un mois.
const isDisplayed = (o) =>
  o.is_seed !== true &&
  (o.active === true ||
    (o.response_phase !== "contained" &&
      (o.source_priority ?? 0) >= 3 &&
      (confirmedAt(o) ?? "") >= sixtyDaysAgo &&
      (o.date ?? "") >= sixtyDaysAgo));

// Ligne fantôme trouvée le 28/08 : ce filtre reprend l'éligibilité par ligne
// mais pas la règle de sœurs de filterDisplayActive() (lib/outbreaks.ts) — celle
// qui fait qu'une ligne close (`active=false`) ne s'affiche JAMAIS sur le site
// tant qu'une ligne sœur `active=true` existe pour la même maladie/pays, quelle
// que soit sa propre fraîcheur. Repéré sur Ebola/RD Congo : la ligne close du
// 07/08 (4 120/1 887) passait `isDisplayed` (priority 5, confirmedAt et date
// dans les 60 j) et entrait au registre à côté de la ligne active du 24/08
// (5 656/2 715) — deux chiffres "citables" pour le même foyer, dont un que le
// site n'a jamais montré. Repéré à répétition par les routines sociales sur
// plusieurs jours sans que la cause soit identifiée (la ligne close semblait
// "réapparaître" alors qu'elle n'avait en réalité jamais quitté le registre).
//
// ⚠️ Le dédoublonnage « garder la ligne la plus récente par paire » de
// getOutbreaksCached() (utilisé pour la liste globale du site) est délibérément
// PAS reproduit ici : il collapse aussi des lignes `active=true` entre elles,
// ce qui est correct pour une liste agrégée mais faux pour ce registre. Vérifié
// sur Avian Influenza/United States : deux lignes actives distinctes
// (aphis.usda.gov#idaho, 176 cas ; #utah, 29 cas) s'affichent TOUTES LES DEUX
// sur /country/united-states (getCountryOutbreaks() + filterDisplayActive(), qui
// ne s'excluent jamais mutuellement entre lignes actives) — un premier essai de
// ce correctif basé sur getOutbreaksCached() les aurait fait disparaître toutes
// les deux du registre alors qu'un lecteur du site verrait les deux chiffres.
// La règle qui suit reproduit exactement filterDisplayActive() : une ligne
// active n'est jamais exclue par une sœur ; une ligne inactive l'est dès qu'une
// sœur active existe pour la même clé.
const displayed = rows.filter(isDisplayed);
const activeKeys = new Set();
for (const o of displayed) {
  if (o.active !== true) continue;
  const diseaseKey = normalizeDisease(o.disease_en || o.disease || "").name_en.toLowerCase();
  const countryKey = (o.country_en || o.country || "").toLowerCase();
  activeKeys.add(`${diseaseKey}|${countryKey}`);
}
const survivesSiblingRule = (o) => {
  if (o.active === true) return true;
  const diseaseKey = normalizeDisease(o.disease_en || o.disease || "").name_en.toLowerCase();
  const countryKey = (o.country_en || o.country || "").toLowerCase();
  return !activeKeys.has(`${diseaseKey}|${countryKey}`);
};

const facts = [];
for (const o of displayed.filter(survivesSiblingRule)) {
  const confirmed = confirmedAt(o);
  const stale = ageDays(confirmed) > STALE_AFTER_DAYS;
  const base = {
    outbreakId: o.id,
    disease: o.disease_en || o.disease,
    diseaseFr: o.disease,
    country: o.country_en || o.country,
    countryFr: o.country,
    active: o.active === true,
    asOf: o.date,
    updatedAt: o.updated_at,
    sourceConfirmedAt: o.source_confirmed_at ?? null,
    sourceConfirmedHonoured: isConfirmedCurrent(o),
    // Ancienneté depuis la dernière VÉRIFICATION de la source, pas depuis la
    // dernière écriture : c'est ce chiffre qui doit être cité.
    confirmedAt: confirmed,
    ageDays: ageDays(confirmed),
    stale,
    source: o.source,
  };
  if (Number.isFinite(o.cases) && o.cases > 0) facts.push({ ...base, kind: "cases", value: o.cases });
  if (Number.isFinite(o.deaths) && o.deaths > 0) facts.push({ ...base, kind: "deaths", value: o.deaths });
  // Le CFR n'est pas stocké : on le calcule ici pour qu'un message qui l'avance
  // soit contrôlé sur la même base que les cas et les décès.
  //
  // Deux exclusions, ajoutées après le premier run réel du 24/08 :
  //   - deaths = 0 produisait un fait de valeur 0, et 69 sur 128 CFR étaient dans
  //     ce cas. Un « 0 » citable ouvre un trou dans le contrôle : n'importe quel
  //     zéro d'un brouillon trouvait alors un fait correspondant.
  //   - sous 20 cas, un CFR n'a pas de sens (1 décès sur 3 cas = 33 %, un chiffre
  //     vrai et trompeur). Le message doit citer les cas et les décès bruts.
  const CFR_MIN_CASES = 20;
  if (
    Number.isFinite(o.cases) && o.cases >= CFR_MIN_CASES &&
    Number.isFinite(o.deaths) && o.deaths > 0
  ) {
    facts.push({ ...base, kind: "cfr_percent", value: Math.round((o.deaths / o.cases) * 1000) / 10 });
  }
}

const seedsExcluded = rows.filter((o) => o.is_seed === true).length;

const payload = {
  generatedAt: now.toISOString(),
  envFile,
  staleAfterDays: STALE_AFTER_DAYS,
  displayedRows: rows.filter(isDisplayed).length,
  totalRows: rows.length,
  seedsExcluded,
  facts,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");

const staleCount = facts.filter((f) => f.stale).length;
console.log(`${OUT} écrit — ${facts.length} faits citables sur ${payload.displayedRows} lignes affichées.`);
if (seedsExcluded > 0) {
  console.log(`${seedsExcluded} ligne(s) is_seed exclue(s) : donnée de peuplement non vérifiée, jamais citable (audit du 2026-06-15).`);
}
if (staleCount > 0) {
  console.log(
    `${staleCount} fait(s) marqué(s) périmé(s) (> ${STALE_AFTER_DAYS} j sans mise à jour) : citables uniquement avec la date, jamais au présent.`
  );
}

// Une ligne affichée comme active mais figée depuis un mois est un problème de
// base, pas un problème de message : c'est l'effet de bord source_priority = 10
// documenté dans hwg-social-policy.md §8 (aucun cron n'écrit au-dessus de 5, donc
// une ligne promue à 10 cesse de se rafraîchir seule et silencieusement).
const frozen = [...new Map(
  facts.filter((f) => f.active && f.ageDays > 30).map((f) => [f.outbreakId, f])
).values()];

if (frozen.length > 0) {
  // Regroupé par maladie : un même événement multipays (le lot « infant formula »
  // en compte onze) occupait onze lignes et noyait le reste. Pas d'emoji non plus,
  // PowerShell les rend en carrés sur cette machine.
  const groups = new Map();
  for (const f of frozen) {
    const g = groups.get(f.disease) ?? { disease: f.disease, maxAge: 0, updatedAt: f.updatedAt, countries: [] };
    g.maxAge = Math.max(g.maxAge, f.ageDays);
    g.countries.push(f.country);
    groups.set(f.disease, g);
  }
  const sorted = [...groups.values()].sort((a, b) => b.maxAge - a.maxAge);
  const short = (s) => (s.length > 52 ? s.slice(0, 51) + "…" : s);

  console.log(`\n/!\\  ${frozen.length} foyer(s) actif(s) sans vérification de source depuis plus de 30 jours,`);
  console.log(`     sur ${sorted.length} événement(s) distinct(s) :`);
  for (const g of sorted.slice(0, 12)) {
    const where =
      g.countries.length <= 3
        ? g.countries.join(", ")
        : `${g.countries.length} pays : ${g.countries.slice(0, 3).join(", ")}, …`;
    console.log(`   ${String(g.maxAge).padStart(3)} j  ${short(g.disease).padEnd(52)}  ${where}`);
  }
  if (sorted.length > 12) console.log(`   … et ${sorted.length - 12} autre(s) événement(s).`);
  console.log(`     Ancienneté mesurée sur max(updated_at, source_confirmed_at), pas sur la seule écriture.
     À re-sourcer côté base (morning-don-check ou session interactive), pas à contourner côté message.`);
}

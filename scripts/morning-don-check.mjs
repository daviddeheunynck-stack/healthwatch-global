// Routine matinale HealthWatch Global — voir .claude/scheduled-tasks/morning-don-check/SKILL.md pour la procédure complète.
// Ce script couvre les étapes 1-5 (fetch DON, pull DB, scan doublons/périmé/gel/traductions,
// cadence hebdo des lignes manuelles). La vérification contre la source primaire (WebFetch/WebSearch),
// les corrections ciblées et le récap restent pilotés par l'agent.
import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
}
const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) throw new Error("Pas la prod — arrêt.");

const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

// Faux positifs connus des heuristiques ci-dessous — voir SKILL.md section 4.
// Grippe aviaire US : une ligne par État (source APHIS), pas des doublons du même événement.
const DUP_SCAN_EXCLUDE = new Set(["avian influenza|united states"]);
// Seeds polio PK/AF gardés actifs à dessein (PHEIC), date 2023-01-01 structurelle — pas des résidus périmés.
const SUSPICIOUS_DATE_EXCLUDE_IDS = new Set([
  "ab4cd321-0aa6-4598-86ac-b0a04d346465", // Polio Pakistan
  "b0f473be-a367-464e-ab32-3cdc43aa7815", // Polio Afghanistan
]);
// Table de référence des clusters de seeds légitimes (mise à jour 2026-07-20, total=25).
// Sert à diffier "le compte a-t-il changé" plutôt qu'à re-justifier ligne par ligne chaque matin.
// Comptes = seeds ACTIFS attendus par cluster. Baissés le 2026-07-17 après les
// audits source_priority=3 : les lignes retirées ont été désactivées (pas
// supprimées), elles gardent is_seed=true et ne comptent plus ici.
//   Chikungunya 21→7  : 14 pays clôturés (RRA v2 + NY State Global Health Update)
//   MERS-CoV     2→1  : France désactivée (aucun cas depuis le cluster déc. 2025)
//   Choléra      5→4  : Tchad désactivé (absent de la Table 1 de l'Epi Update #38)
//   Diphtérie   1→0  : cluster retiré le 2026-07-20. Le fix c3a1d4d (19/07) a
//     délibérément remis is_seed=FALSE sur Diphtérie/Haïti (le true était le
//     résidu de la collision GHO/PAHO, pas une protection voulue). La ligne
//     Haïti reste active, sourcée PAHO, mise à jour par sync-paho-alerts —
//     ce n'est plus un seed. Voir project_diphtheria_haiti_source_priority_collision.
const KNOWN_SEED_CLUSTERS = [
  { label: "Chikungunya (DON581, multi-pays)", diseaseMatch: /chikungunya/i, expectedCount: 7 },
  { label: "MERS-CoV (DON591)", diseaseMatch: /mers-cov/i, expectedCount: 1 },
  { label: "Choléra (DON579, multi-pays)", diseaseMatch: /cholera/i, expectedCount: 4 },
  { label: "Polio PHEIC (Afghanistan/Pakistan/Palestine)", diseaseMatch: /polio/i, expectedCount: 3 },
  { label: "Cereulide / lait infantile (DON596, multi-pays)", diseaseMatch: /cereulide/i, expectedCount: 10 },
];

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

// --- 1. DON récents (<90 jours) ---
const donRes = await fetchJson(
  "https://www.who.int/api/news/diseaseoutbreaknews?sf_culture=en&$format=json&$orderby=PublicationDateAndTime%20desc&$top=40"
);
const donItems = (donRes.value || donRes).map((d) => ({
  title: d.Title,
  date: (d.PublicationDateAndTime || "").slice(0, 10),
  url: d.ItemDefaultUrl || d.UrlName,
}));
const cutoff = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
const recentDons = donItems.filter((i) => i.date >= cutoff);

console.log(`=== DON récents (<90j): ${recentDons.length} ===`);
recentDons.forEach((i) => console.log(`${i.date} | ${i.title} | ${i.url}`));

// --- 2. Foyers actifs en DB ---
const active = await fetchJson(
  `${SUPABASE_URL}/rest/v1/outbreaks?active=eq.true&select=id,disease,disease_en,country,country_en,region,cases,deaths,date,active,is_seed,source,source_priority,updated_at&order=updated_at.asc`,
  { headers: h }
);
console.log(`\n=== Foyers actifs: ${active.length} ===`);

// --- 3. Rapprochement DON du jour <-> DB (par mot-clé maladie) ---
const donKeywords = [...new Set(recentDons.flatMap((d) => d.title.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]{4,}/g) || []))];
console.log("\n=== Lignes actives potentiellement liées aux DON récents (à vérifier contre who.int) ===");
for (const o of active) {
  const key = `${o.disease_en || o.disease || ""} ${o.disease || ""}`.toLowerCase();
  if (donKeywords.some((k) => key.includes(k) && k.length > 5)) {
    console.log(
      `[${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | cases=${o.cases} deaths=${o.deaths} | date=${(o.date || "").slice(0, 10)} | seed=${o.is_seed} | src=${(o.source || "").slice(0, 60)}`
    );
  }
}

// --- 4a. is_seed=true AND active=true, comparé à la table de référence ---
const seeds = active.filter((o) => o.is_seed);
const expectedSeedTotal = KNOWN_SEED_CLUSTERS.reduce((n, c) => n + c.expectedCount, 0);
console.log(`\n=== is_seed=true AND active=true: ${seeds.length} (référence: ${expectedSeedTotal}) ===`);
const unclassified = [...seeds];
for (const cluster of KNOWN_SEED_CLUSTERS) {
  const matched = seeds.filter((o) => cluster.diseaseMatch.test(o.disease_en || o.disease || ""));
  const status = matched.length === cluster.expectedCount ? "OK" : "⚠️ ÉCART";
  console.log(`  ${status} ${cluster.label}: ${matched.length}/${cluster.expectedCount}`);
  for (const m of matched) {
    const idx = unclassified.indexOf(m);
    if (idx >= 0) unclassified.splice(idx, 1);
  }
}
if (unclassified.length) {
  console.log("  ⚠️ Seeds non classés (nouveaux ou résidus potentiels — vérifier manuellement) :");
  unclassified.forEach((o) =>
    console.log(`    [${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | date=${(o.date || "").slice(0, 10)} | src=${(o.source || "").slice(0, 60)}`)
  );
} else {
  console.log("  Aucun seed hors des clusters connus.");
}

// --- 4b. Doublons (même disease_en+country_en, 2+ actifs), hors faux positifs connus ---
console.log("\n=== Doublons potentiels (même disease_en+country_en, 2+ actifs) ===");
const byKey = new Map();
for (const o of active) {
  const k = `${(o.disease_en || o.disease || "").toLowerCase()}|${(o.country_en || o.country || "").toLowerCase()}`;
  if (DUP_SCAN_EXCLUDE.has(k)) continue;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(o);
}
let dupFound = false;
for (const [k, rows] of byKey) {
  if (rows.length > 1) {
    dupFound = true;
    console.log(`DUP: ${k}`);
    rows.forEach((o) =>
      console.log(`   [${o.id}] date=${(o.date || "").slice(0, 10)} seed=${o.is_seed} prio=${o.source_priority} src=${(o.source || "").slice(0, 50)}`)
    );
  }
}
if (!dupFound) console.log("Aucun.");

// --- 4c. Dates suspectes (1er janvier), hors faux positifs connus ---
console.log("\n=== Dates suspectes (1er janvier) ===");
const suspicious = active.filter((o) => /-01-01$/.test((o.date || "").slice(0, 10)) && !SUSPICIOUS_DATE_EXCLUDE_IDS.has(o.id));
if (suspicious.length) {
  suspicious.forEach((o) =>
    console.log(`[${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | date=${(o.date || "").slice(0, 10)} seed=${o.is_seed} | src=${(o.source || "").slice(0, 50)}`)
  );
} else {
  console.log("Aucune (hors faux positifs connus : seeds polio PK/AF).");
}

// --- 4d. Lignes gelées à source_priority=10 et non couvertes par un cluster de seeds connu ---
// prio=10 bloque toute écriture de cron (guards `.lte(source_priority, N)` partout) — légitime
// pour les seeds de clusters (déjà suivis en 4a), mais un résidu is_seed=false à prio=10 signifie
// qu'une ligne s'est figée sans que personne ne le sache (vécu : Ebola/RDC 16-17/07, Ebola/France
// et Ebola/Allemagne jusqu'au 23/07, Choléra/Tchad jusqu'au 22/07). Cadence hebdo (>7j) comme la
// section 5 : ne jamais déverrouiller sans vérifier pourquoi la ligne a été mise à ce niveau, voir
// SKILL.md section "5 bis" pour la procédure (pas de fetch pré-construit, recherche au cas par cas).
console.log("\n=== Lignes actives à source_priority=10, hors clusters de seeds connus (>7j = à vérifier) ===");
const frozenNonSeed = active.filter((o) => o.source_priority === 10 && !o.is_seed);
if (frozenNonSeed.length) {
  frozenNonSeed.forEach((o) => {
    const ageDays = Math.round((Date.now() - new Date(o.updated_at).getTime()) / 864e5);
    const status = ageDays > 7 ? "À VÉRIFIER" : "skip (vérifiée récemment)";
    console.log(`[${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | ${ageDays}j — ${status} | date=${(o.date || "").slice(0, 10)} | src=${(o.source || "").slice(0, 50)}`);
  });
} else {
  console.log("Aucune.");
}

// --- 4d-bis. Lignes gelées à source_priority=10 DANS un cluster de seeds connu ---
// Contrairement à 4d, ces lignes sont suivies en 4a pour la cohérence de classification (le
// compte du cluster est-il toujours correct), mais rien ne vérifie qu'une édition plus récente
// du bulletin multi-pays cité en `source` n'est pas parue depuis. Cadence 14j (bulletins
// typiquement mensuels, pas hebdo) — voir SKILL.md section "5 bis".
console.log("\n=== Lignes actives à source_priority=10, DANS un cluster de seeds (>14j = vérifier édition plus récente) ===");
const frozenSeed = active.filter((o) => o.source_priority === 10 && o.is_seed);
if (frozenSeed.length) {
  frozenSeed.forEach((o) => {
    const ageDays = Math.round((Date.now() - new Date(o.updated_at).getTime()) / 864e5);
    const status = ageDays > 14 ? "À VÉRIFIER (édition plus récente ?)" : "skip (vérifiée récemment)";
    console.log(`[${o.id}] ${o.disease_en || o.disease} | ${o.country_en || o.country} | ${ageDays}j — ${status} | src=${(o.source || "").slice(0, 60)}`);
  });
} else {
  console.log("Aucune.");
}

// --- 4e. Traductions partielles (description_fr/es/ar/id incohérents) ---
// sync-outbreaks ne backfillait que sur description_fr IS NULL — un fr écrit à la main sans les
// 3 autres langues restait invisible pour toujours à ce gate (corrigé le 2026-07-23, commit
// ca8e30c). Ce signal reste utile si un autre chemin d'écriture recrée le même trou.
const partialTranslationRows = await fetchJson(
  `${SUPABASE_URL}/rest/v1/outbreaks?active=eq.true&description=not.is.null&description=neq.&select=id,disease_en,country_en,description_fr,description_es,description_ar,description_id`,
  { headers: h }
);
const partial = partialTranslationRows.filter((o) => {
  const flags = [o.description_fr, o.description_es, o.description_ar, o.description_id].map((v) => !!v);
  return flags.some(Boolean) && flags.some((v) => !v);
});
console.log("\n=== Traductions partielles (au moins une langue remplie, au moins une manquante) ===");
if (partial.length) {
  partial.forEach((o) =>
    console.log(`[${o.id}] ${o.disease_en} | ${o.country_en} | fr=${o.description_fr ? "OK" : "NULL"} es=${o.description_es ? "OK" : "NULL"} ar=${o.description_ar ? "OK" : "NULL"} id=${o.description_id ? "OK" : "NULL"}`)
  );
} else {
  console.log("Aucune.");
}

// --- 4f. Nulls silencieux : pays câblés dans une map de source mais absents de la base ---
// Trouvé le 2026-07-27 en creusant le trou Tchad/choléra du 21-22/07 : la République
// centrafricaine est câblée dans CHOLERA_ISO3 (app/api/cron/sync-who-regional/route.ts)
// mais n'a JAMAIS produit de ligne — indistinguable en l'état d'un simple "pas de cas
// actuel" (le cas documenté de Cameroun/Syrie/Liban/Népal, cf. commentaire du fetcher).
// Scope volontairement restreint à CHOLERA_ISO3 pour l'instant (le cas confirmé) — étendre
// à d'autres maps pays de crons (Mpox, Dengue...) seulement si ce scan s'avère utile.
// Garder CHOLERA_ISO3_COUNTRIES synchronisé avec la vraie const du fetcher si elle change.
const CHOLERA_ISO3_COUNTRIES = [
  "Somalia", "Zimbabwe", "Afghanistan", "Mozambique", "Kenya", "Cameroon", "Syria",
  "Malawi", "Lebanon", "Central African Republic", "Nepal", "Nigeria", "Tanzania", "Zambia",
];
// Nulls documentés comme attendus (commentaire du fetcher, sync-who-regional/route.ts) —
// pas de cas actuel dans le flux ArcGIS, pas un bug. Ne pas re-signaler ces 4.
const CHOLERA_EXPECTED_NULLS = ["Cameroon", "Syria", "Lebanon", "Nepal"];

const choleraRows = await fetchJson(
  `${SUPABASE_URL}/rest/v1/outbreaks?disease_en=eq.Cholera&select=country_en`,
  { headers: h }
);
const choleraCountriesPresent = new Set(choleraRows.map((o) => o.country_en));
console.log("\n=== Choléra — pays câblés dans CHOLERA_ISO3 mais aucune ligne en base (hors nulls attendus) ===");
const silentNulls = CHOLERA_ISO3_COUNTRIES.filter(
  (c) => !choleraCountriesPresent.has(c) && !CHOLERA_EXPECTED_NULLS.includes(c)
);
if (silentNulls.length) {
  silentNulls.forEach((c) => console.log(`[${c}] À VÉRIFIER — câblé dans CHOLERA_ISO3, zéro ligne Choléra en base`));
} else {
  console.log("Aucun (hors nulls attendus : Cameroun, Syrie, Liban, Népal).");
}

// --- 4g. Incidents de rattrapage : lignes ingérées très longtemps après leur date signalée ---
// Signal interne uniquement (David, 27/07 : trop rare pour justifier une surface Pro — voir
// marketing/product-ideas-log.md item 3 du 27/07). Utile pour repérer une ligne mal étiquetée
// (is_seed/is_backfill oubliés) avant que ça ne fausse un audit — c'est l'usage qui a fait
// naître ce calcul (lib/reporting-lag.ts, jamais branché côté client). Duplique volontairement
// la logique de lib/reporting-lag.ts ici (ce script est du JS brut, pas de build TS) — garder
// les deux synchronisés si l'un change.
const catchupRows = await fetchJson(
  `${SUPABASE_URL}/rest/v1/outbreaks?select=id,disease_en,country_en,date,created_at,updated_at,is_seed,is_backfill`,
  { headers: h }
);
const CATCHUP_UPDATE_TOLERANCE_MS = 60_000;
const CATCHUP_THRESHOLD_DAYS = 7;
function computeCatchupDays(o) {
  if (o.is_seed || o.is_backfill || !o.date || !o.created_at) return null;
  const createdMs = new Date(o.created_at).getTime();
  if (o.updated_at) {
    const updatedMs = new Date(o.updated_at).getTime();
    if (!Number.isNaN(createdMs) && !Number.isNaN(updatedMs) && updatedMs - createdMs > CATCHUP_UPDATE_TOLERANCE_MS) return null;
  }
  const reported = new Date(`${o.date}T00:00:00Z`).getTime();
  if (Number.isNaN(reported) || Number.isNaN(createdMs)) return null;
  const days = Math.round((createdMs - reported) / 86_400_000);
  return days >= 0 ? days : null;
}
console.log("\n=== Incidents de rattrapage (ingérées >7j après leur date signalée — signal interne, jamais client) ===");
const catchupIncidents = catchupRows
  .map((o) => ({ ...o, days: computeCatchupDays(o) }))
  .filter((o) => o.days !== null && o.days > CATCHUP_THRESHOLD_DAYS);
if (catchupIncidents.length) {
  catchupIncidents.forEach((o) =>
    console.log(`[${o.id}] ${o.disease_en} | ${o.country_en} | ${o.days}j après la date signalée | is_seed=${o.is_seed} is_backfill=${o.is_backfill}`)
  );
} else {
  console.log("Aucun.");
}

// --- 5. Lignes manuelles (section 5 du SKILL.md) dues pour vérif hebdo (>7j) ---
const MANUAL_ROWS = {
  "e856b352-747b-4db0-b0d1-c9e55f6c53aa": "Diphtérie/Australie",
  "5ffa5759-37c6-438f-b7dc-ddaa1bbddd77": "Dengue/Brésil",
  "b17d4fda-c38c-41c0-9b26-e60a54c1851b": "Marburg/Ouganda",
  // Rougeole/États-Unis (7d519ce6-…) retirée le 2026-07-26 : plus orpheline, la
  // ligne est maintenue par sync-paho-alerts (SitRep OPS bimensuel, priority=5).
  // Ne pas la remettre ici, et surtout ne pas la rafraîchir avec les chiffres
  // CDC — cadrage différent, cf. section 5 du SKILL.md.
  "8a4072ab-c0be-4567-8ba4-cdcedeccced8": "Polio/Palestine",
};
console.log("\n=== Lignes manuelles (section 5) — dues pour vérif hebdo (updated_at > 7j) ===");
const now = Date.now();
let anyDue = false;
for (const o of active) {
  const label = MANUAL_ROWS[o.id];
  if (!label) continue;
  const ageDays = Math.round((now - new Date(o.updated_at).getTime()) / 864e5);
  if (ageDays > 7) {
    anyDue = true;
    console.log(`${label} [${o.id}] : ${ageDays}j — À VÉRIFIER (cases=${o.cases} deaths=${o.deaths} date=${(o.date || "").slice(0, 10)})`);
  } else {
    console.log(`${label} [${o.id}] : ${ageDays}j — skip (vérifiée récemment)`);
  }
}
if (!anyDue) console.log("(aucune ligne due cette semaine)");

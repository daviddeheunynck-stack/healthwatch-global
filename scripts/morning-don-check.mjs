// Routine matinale HealthWatch Global — voir .claude/scheduled-tasks/morning-don-check/SKILL.md pour la procédure complète.
// Ce script couvre les étapes 1-4 (fetch DON, pull DB, scan doublons/périmé). La vérification contre
// la source primaire (WebFetch/WebSearch), les corrections ciblées et le récap restent pilotés par l'agent.
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
// Table de référence des clusters de seeds légitimes (mise à jour 2026-07-14, total=41).
// Sert à diffier "le compte a-t-il changé" plutôt qu'à re-justifier ligne par ligne chaque matin.
const KNOWN_SEED_CLUSTERS = [
  { label: "Chikungunya (DON581, multi-pays)", diseaseMatch: /chikungunya/i, expectedCount: 21 },
  { label: "MERS-CoV (DON591)", diseaseMatch: /mers-cov/i, expectedCount: 2 },
  { label: "Choléra (DON579, multi-pays)", diseaseMatch: /cholera/i, expectedCount: 5 },
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
console.log(`\n=== is_seed=true AND active=true: ${seeds.length} (référence: 41) ===`);
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

// --- 5. Lignes manuelles (section 5 du SKILL.md) dues pour vérif hebdo (>7j) ---
const MANUAL_ROWS = {
  "e856b352-747b-4db0-b0d1-c9e55f6c53aa": "Diphtérie/Australie",
  "5ffa5759-37c6-438f-b7dc-ddaa1bbddd77": "Dengue/Brésil",
  "b17d4fda-c38c-41c0-9b26-e60a54c1851b": "Marburg/Ouganda",
  "7d519ce6-c281-4945-a2ef-ebead0600b67": "Rougeole/États-Unis",
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

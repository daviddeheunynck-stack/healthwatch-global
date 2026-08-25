// coverage-cholera.mjs — DIAGNOSTIC EN LECTURE SEULE. N'ÉCRIT RIEN, NULLE PART.
//
// Pourquoi ce script existe
// -------------------------
// Le dépôt mesure très bien deux choses : la FRAÎCHEUR d'une ligne (staleOutbreakDays,
// source_confirmed_at, les six sections de morning-don-check) et la CONFIANCE dans sa
// source (lib/source-trust.ts, ses listes blanches, check-source-trust.mjs). Il ne mesure
// nulle part la COUVERTURE : quels pays ont une épidémie déclarée par une source
// autoritaire et n'ont aucune ligne chez nous. Un chiffre périmé se voit ; un pays absent
// ne se voit pas — il est indistinguable d'un pays sans cas.
//
// Le seul filet existant est la section 4f de morning-don-check, et elle est doublement
// limitée : elle ne couvre que le choléra, et elle compare la base à une COPIE codée en
// dur de CHOLERA_ISO3, avec un commentaire demandant de la tenir synchronisée à la main.
//
// Ce que ce script compare
// ------------------------
//   (a) la couche de surveillance mondiale choléra de l'OMS (ArcGIS `cholera_adm0_week_view`,
//       hebdomadaire, par pays) — la même source que fetchCholeraGlobalSurveillance() dans
//       app/api/cron/sync-who-regional/route.ts, mais interrogée SANS filtre de pays ;
//   (b) la constante CHOLERA_ISO3 réelle, lue directement dans le fichier de la route (pas
//       recopiée : une copie dérive, c'est le défaut de la section 4f) ;
//   (c) les lignes choléra effectivement en base.
//
// Il en sort trois questions, dans cet ordre d'importance :
//   1. Quels pays l'OMS déclare-t-elle et que le cron n'interroge même pas ? → trou d'acquisition.
//   2. Quels pays sont câblés sans aucune donnée OMS ? → câblage mort, ou vraie absence de cas.
//   3. Pour les pays déclarés, que dit notre base ? → ligne absente, écart de chiffres, ou alignée.
//
// Ce qu'il ne fait PAS, délibérément
// ----------------------------------
// Il ne propose aucune écriture et n'en fait aucune. Élargir CHOLERA_ISO3 revient à laisser
// sync-who-regional écrire sur des lignes qui peuvent être verrouillées à source_priority=10
// et sourcées autrement (le cluster de seeds DON579 : Congo, RD Congo, Soudan du Sud, Soudan,
// rafraîchis à la main depuis le Weekly Epidemiological Record). Écraser un chiffre WER par un
// chiffre ArcGIS sans vérifier que les deux comptent la même chose, c'est exactement le piège
// documenté pour Choléra/Somalie (233 « choléra » au WER contre 2 168 « AWD/choléra » ailleurs)
// et pour Rougeole/États-Unis (CDC contre OPS). Ce script sert à décider pays par pays, pas à
// appliquer.
//
// Usage : node scripts/coverage-cholera.mjs

import { readFileSync } from "fs";

// ── Environnement (même convention que les autres scripts du dossier) ────────
const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim().replace(/^"(.*)"$/, "$1");
}
const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY  = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) throw new Error("Pas la prod — arrêt.");

const YEAR = new Date().getUTCFullYear();
const UA   = "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)";

// ── (b) CHOLERA_ISO3, lue dans la vraie source plutôt que recopiée ───────────
// La section 4f de morning-don-check maintient une copie manuelle de cette liste et prévient
// elle-même qu'il faut « garder CHOLERA_ISO3_COUNTRIES synchronisé avec la vraie const du
// fetcher si elle change ». Une copie qui doit être synchronisée à la main finit toujours par
// diverger — et un scan de couverture qui diverge de ce qu'il est censé auditer ne vaut rien.
// On lit donc le bloc directement dans le fichier de la route.
const ROUTE = "app/api/cron/sync-who-regional/route.ts";
function readWiredIso3() {
  const src = readFileSync(ROUTE, "utf-8");
  const block = src.match(/const CHOLERA_ISO3: Record<string, string> = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error(`CHOLERA_ISO3 introuvable dans ${ROUTE} — la const a été renommée ou déplacée.`);
  const wired = new Map(); // iso3 -> country_en
  for (const m of block[1].matchAll(/"([^"]+)"\s*:\s*"([A-Z]{3})"/g)) wired.set(m[2], m[1]);
  return wired;
}

// ── ISO3 → country_en tel qu'écrit dans lib/geo-data.ts ──────────────────────
// Uniquement pour les pays QUE L'OMS DÉCLARE et que CHOLERA_ISO3 ne connaît pas : pour les
// autres, le nom vient de CHOLERA_ISO3 elle-même. Un code absent d'ici est signalé plutôt
// qu'ignoré silencieusement — c'est le genre de trou que ce script est censé rendre visible.
const ISO3_TO_NAME = {
  AGO: "Angola",
  BDI: "Burundi",
  COD: "Democratic Republic of the Congo",
  COG: "Republic of the Congo",
  ETH: "Ethiopia",
  HTI: "Haiti",
  IND: "India",
  MMR: "Myanmar",
  NAM: "Namibia",
  PAK: "Pakistan",
  RWA: "Rwanda",
  SDN: "Sudan",
  SSD: "South Sudan",
  TCD: "Chad",
  YEM: "Yemen",
  ZAF: "South Africa",
};

// Alias de rapprochement base ↔ ISO3.
//
// La première version de ce script comparait `country_en` au nom canonique par égalité
// stricte sur la chaîne en minuscules. Résultat au premier passage réel : COD et COG
// ressortaient « AUCUNE LIGNE EN BASE » alors que les deux lignes existent bel et bien
// (cluster DON579, rafraîchi le 10/08 — Congo 767/49, RD Congo 32193/908). Cinq des
// 23 lignes choléra de la base n'étaient rattachées à aucun pays.
//
// C'est exactement le faux négatif que ce script est censé débusquer, reproduit à
// l'intérieur du script : un pays présent, compté comme absent. D'où deux garde-fous —
// une table d'alias, et surtout la section 4 en bas qui liste toute ligne de la base
// qu'on n'a PAS su rattacher. Un audit de couverture qui peut se tromper en silence ne
// vaut rien ; celui-ci doit dire ce qu'il n'a pas compris.
const NAME_ALIASES = {
  COD: ["democratic republic of the congo", "democratic republic of congo", "dr congo", "drc",
        "congo kinshasa", "congo dr", "rd congo"],
  COG: ["republic of the congo", "congo", "congo brazzaville", "republic of congo"],
  TZA: ["tanzania", "united republic of tanzania"],
  CAF: ["central african republic", "car"],
  ZAF: ["south africa"],
  SSD: ["south sudan"],
  SDN: ["sudan"],
  SYR: ["syria", "syrian arab republic"],
};

// Normalisation volontairement agressive : minuscules, diacritiques retirés, ponctuation
// et articles supprimés. « Côte d'Ivoire », « Cote dIvoire » et « cote d ivoire » doivent
// se rejoindre — un rapprochement de couverture ne doit pas échouer sur une apostrophe.
function norm(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|of|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── (a) Couche OMS, tous pays confondus, avec pagination ─────────────────────
const ARCGIS = "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/cholera_adm0_week_view/FeatureServer/0/query";

async function fetchWhoCholera() {
  const where = `date_wk>=TIMESTAMP '${YEAR}-01-01 00:00:00' AND date_wk<TIMESTAMP '${YEAR + 1}-01-01 00:00:00'`;
  const perPage = 2000;
  const agg = new Map(); // iso3 -> { cases, deaths, lastWeek, weeks }
  let offset = 0;

  for (let page = 0; page < 50; page++) {
    const url = `${ARCGIS}?where=${encodeURIComponent(where)}`
      + `&outFields=${encodeURIComponent("iso_3_code,date_wk,cases,deaths")}`
      + `&orderByFields=${encodeURIComponent("date_wk ASC")}`
      + `&resultOffset=${offset}&resultRecordCount=${perPage}&returnGeometry=false&f=json`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`);
    const json = await res.json();
    // ArcGIS renvoie volontiers un HTTP 200 avec un corps { error: ... } — le fetcher de
    // sync-who-regional documente déjà ce piège pour les littéraux de date. Ne pas le traiter
    // comme « zéro résultat ».
    if (json.error) throw new Error(`ArcGIS: ${JSON.stringify(json.error).slice(0, 300)}`);
    const feats = json.features ?? [];
    for (const f of feats) {
      const a = f.attributes;
      const iso = a.iso_3_code;
      if (!iso) continue;
      const cur = agg.get(iso) ?? { cases: 0, deaths: 0, lastWeek: 0, weeks: 0 };
      cur.cases  += a.cases  ?? 0;
      cur.deaths += a.deaths ?? 0;
      cur.weeks  += 1;
      if (a.date_wk && a.date_wk > cur.lastWeek) cur.lastWeek = a.date_wk;
      agg.set(iso, cur);
    }
    if (!json.exceededTransferLimit || feats.length === 0) break;
    offset += feats.length;
  }
  return agg;
}

// ── (c) Lignes choléra en base ───────────────────────────────────────────────
async function fetchDbCholera() {
  const select = "id,disease_en,country_en,cases,deaths,date,active,is_seed,source,source_priority,updated_at,source_confirmed_at";
  const url = `${SUPABASE_URL}/rest/v1/outbreaks?disease_en=ilike.*cholera*&select=${select}`;
  const res = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Exécution ────────────────────────────────────────────────────────────────
const wired = readWiredIso3();
const who   = await fetchWhoCholera();
const rows  = await fetchDbCholera();

// Index normalisé nom → ISO3, construit à partir des trois sources de noms.
const nameToIso = new Map();
const register = (iso, name) => { const k = norm(name); if (k) nameToIso.set(k, iso); };
for (const [iso, name] of wired) register(iso, name);
for (const [iso, name] of Object.entries(ISO3_TO_NAME)) register(iso, name);
for (const [iso, list] of Object.entries(NAME_ALIASES)) for (const a of list) register(iso, a);

// Rattachement des lignes de la base, en gardant trace de ce qui n'a pas été rattaché.
const byIso = new Map();
const unmatched = [];
for (const r of rows) {
  const iso = nameToIso.get(norm(r.country_en));
  if (!iso) { unmatched.push(r); continue; }
  if (!byIso.has(iso)) byIso.set(iso, []);
  byIso.get(iso).push(r);
}
const rowsForIso = (iso) => byIso.get(iso) ?? [];
const nameFor = (iso) => wired.get(iso) ?? ISO3_TO_NAME[iso] ?? null;
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "—");

console.log(`=== Couverture choléra ${YEAR} — OMS (ArcGIS) vs CHOLERA_ISO3 vs base ===`);
console.log(`Pays déclarés par l'OMS en ${YEAR} : ${who.size}`);
console.log(`Pays câblés dans CHOLERA_ISO3      : ${wired.size}`);
console.log(`Lignes choléra en base             : ${rows.length}\n`);

// 1. Le trou d'acquisition.
const unwired = [...who.entries()]
  .filter(([iso]) => !wired.has(iso))
  .sort((a, b) => b[1].cases - a[1].cases);
console.log(`--- 1. Déclarés par l'OMS mais ABSENTS de CHOLERA_ISO3 (${unwired.length}) ---`);
if (!unwired.length) console.log("Aucun.");
for (const [iso, v] of unwired) {
  const name = nameFor(iso);
  const rowsFor = rowsForIso(iso);
  const enBase = rowsFor.length
    ? rowsFor.map((r) => `${r.cases}c/${r.deaths ?? "—"}d au ${(r.date || "").slice(0, 10)} sp=${r.source_priority}${r.is_seed ? " seed" : ""}${r.active ? "" : " INACTIVE"}`).join(" | ")
    : "AUCUNE LIGNE EN BASE";
  const nom = name ?? `⚠️ ${iso} absent d'ISO3_TO_NAME — ajouter l'entrée`;
  console.log(`${iso} ${nom}\n    OMS : ${v.cases}c/${v.deaths}d sur ${v.weeks} semaines, dernière ${day(v.lastWeek)}\n    base: ${enBase}`);
}

// 2. Le câblage mort.
const dead = [...wired.entries()].filter(([iso]) => !who.has(iso));
console.log(`\n--- 2. Câblés dans CHOLERA_ISO3 sans donnée OMS ${YEAR} (${dead.length}) ---`);
if (!dead.length) console.log("Aucun.");
for (const [iso, name] of dead) {
  const rowsFor = rowsForIso(iso);
  console.log(`${iso} ${name} — ${rowsFor.length ? `${rowsFor.length} ligne(s) en base, alimentées par autre chose` : "aucune ligne en base"}`);
}

// 3. Les pays câblés ET déclarés : écart de chiffres.
const both = [...wired.entries()].filter(([iso]) => who.has(iso));
console.log(`\n--- 3. Câblés ET déclarés — écart OMS / base (${both.length}) ---`);
for (const [iso, name] of both) {
  const v = who.get(iso);
  const rowsFor = rowsForIso(iso).filter((r) => r.active);
  if (!rowsFor.length) {
    console.log(`${iso} ${name} : OMS ${v.cases}c/${v.deaths}d (${day(v.lastWeek)}) — AUCUNE LIGNE ACTIVE malgré le câblage`);
    continue;
  }
  for (const r of rowsFor) {
    const ecart = (r.cases ?? 0) === v.cases ? "aligné" : `ÉCART ${r.cases} en base vs ${v.cases} OMS`;
    console.log(`${iso} ${name} : ${ecart} | base ${r.cases}c/${r.deaths ?? "—"}d au ${(r.date || "").slice(0, 10)} sp=${r.source_priority}${r.is_seed ? " seed" : ""} | OMS ${v.cases}c/${v.deaths}d au ${day(v.lastWeek)}`);
  }
}

// 4. Ce que le script n'a pas su rattacher — le contrôle du contrôle.
console.log(`\n--- 4. Lignes choléra en base non rattachées à un ISO3 (${unmatched.length}) ---`);
if (!unmatched.length) console.log("Aucune — les 23 lignes sont toutes rapprochées.");
for (const r of unmatched) {
  console.log(`[${r.id}] country_en="${r.country_en}" | ${r.cases}c/${r.deaths ?? "—"}d au ${(r.date || "").slice(0, 10)} sp=${r.source_priority}${r.is_seed ? " seed" : ""}${r.active ? "" : " INACTIVE"}`);
}
if (unmatched.length) console.log("→ ajouter ces libellés à NAME_ALIASES : tant qu'ils sont ici, les sections 1 et 3 les comptent comme absents.");

console.log("\nRappel : ce script n'écrit rien. Élargir CHOLERA_ISO3 se décide pays par pays,");
console.log("en regardant d'abord la section 3 — un « ÉCART » sur une ligne sp=10 ou is_seed");
console.log("signifie deux cadrages différents, pas forcément une base en retard.");

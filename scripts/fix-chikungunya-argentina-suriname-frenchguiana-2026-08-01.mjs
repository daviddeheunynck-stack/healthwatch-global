// 2026-08-01 — demande explicite de David, suite au trou de couverture repéré
// pendant le refresh du cluster Chikungunya (voir
// fix-chikungunya-cluster-refresh-2026-08-01.mjs et
// project_chikungunya_cluster_stale_awaiting_arbitration_2026_08_01.md) :
// l'Argentine (11 986 cas 2026) n'avait aucune ligne, Suriname (7 484) et
// Guyane française (1 053) avaient des lignes inactives à cases=0 (créées à
// partir de pages CDC Travel Notice génériques sans chiffre réel) — les
// trois dépassent Cuba (1 457) qui est pourtant suivie comme active.
//
// Source pour les 3 : PAHO via NY State DOH Global Health Update du
// 30/07/2026 (même édition que le refresh Brésil/Bolivie/Maurice du même
// jour). Argentine = nouvelle ligne (aucune ligne Chikungunya/Argentine
// n'existe en base). Suriname et Guyane française = réactivation des lignes
// existantes (id connus), pas de nouvelle ligne, pour ne pas dupliquer.
//
// Alignées sur le reste du cluster : is_seed=true, source_priority=10
// (même cadence de mise à jour hebdo NY DOH, même protection contre le
// balayage de péremption 60j). Rejoint donc le cluster Chikungunya, qui
// passe de 5 à 8 lignes seed actives — la table de référence du skill
// morning-don-check et KNOWN_SEED_CLUSTERS dans scripts/morning-don-check.mjs
// devront être mis à jour en conséquence (fait dans le même run que ce
// script).
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
console.log("DB:", SUPABASE_URL);

const SOURCE =
  "https://globalhealthreports.health.ny.gov/sites/default/files/2026-07/Global%20Health%20Update%207.30.26%20-%20Final.pdf";
const DATE = "2026-07-30";
const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function translateDescription(text) {
  const empty = { fr: null, es: null, ar: null, id: null };
  if (!text?.trim()) return empty;
  const base = "https://api.mymemory.translated.net/get";
  const pairs = [
    { key: "fr", langpair: "en|fr" },
    { key: "es", langpair: "en|es" },
    { key: "ar", langpair: "en|ar" },
    { key: "id", langpair: "en|id" },
  ];
  const results = { ...empty };
  const calls = pairs.map(({ langpair }) => {
    const url = new URL(base);
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", langpair);
    return fetch(url.toString()).then((r) => (r.ok ? r.json() : null));
  });
  const responses = await Promise.all(calls);
  for (let i = 0; i < pairs.length; i++) {
    if (Number(responses[i]?.responseStatus) !== 200) continue;
    const t = responses[i]?.responseData?.translatedText ?? null;
    if (t && t !== text) results[pairs[i].key] = t;
  }
  return results;
}

async function withTranslations(description) {
  const t = await translateDescription(description);
  return {
    description,
    description_fr: t.fr,
    description_es: t.es,
    description_ar: t.ar,
    description_id: t.id,
  };
}

// ------------------------------------------------------------ Argentina (INSERT)
{
  const check = await fetch(
    `${SUPABASE_URL}/rest/v1/outbreaks?disease_en=eq.Chikungunya&country_en=eq.Argentina&active=eq.true&select=id`,
    { headers: h }
  );
  const existing = await check.json();
  if (existing.length > 0) {
    console.error(`ARRÊT : ligne active déjà existante pour Chikungunya/Argentina (id ${existing[0].id})`);
    process.exit(1);
  }

  const description =
    "PAHO data via NY State DOH Global Health Update (30 July 2026): Argentina has reported 11,986 chikungunya cases (2,920 lab-confirmed) and 2 deaths in 2026, the third-highest total in the Americas region behind Brazil and Bolivia. Since the previous update, 25 new cases and 44 new confirmed cases were reported.";
  const t = await withTranslations(description);

  const body = {
    disease: "Chikungunya",
    disease_en: "Chikungunya",
    disease_ar: "حمى التشيكونغونيا",
    country: "Argentine",
    country_en: "Argentina",
    country_ar: "الأرجنتين",
    region: "americas",
    lat: -38.42,
    lng: -63.62,
    cases: 11986,
    deaths: 2,
    recovered: null,
    risk_level: "medium",
    date: DATE,
    source: SOURCE,
    active: true,
    is_seed: true,
    is_backfill: false,
    is_pheic: false,
    verification_status: "confirmed",
    response_phase: "monitoring",
    source_priority: 10,
    first_seen_at: DATE,
    ...t,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  if (!res.ok) {
    console.error("ÉCHEC insertion Argentine", res.status, JSON.stringify(out));
    process.exit(1);
  }
  console.log(`OK inserted: Chikungunya / Argentina — cases=${out[0].cases} deaths=${out[0].deaths} id=${out[0].id}`);
}

// ------------------------------------------------------------ Suriname (réactivation, id connu)
{
  const description =
    "PAHO data via NY State DOH Global Health Update (30 July 2026): Suriname has reported 7,484 chikungunya cases (3,389 lab-confirmed) in 2026, no deaths reported — the country has the highest cumulative incidence per capita in the Americas region (1,160 cases per 100,000 population).";
  const t = await withTranslations(description);

  const patch = {
    cases: 7484,
    deaths: 0,
    date: DATE,
    source: SOURCE,
    active: true,
    is_seed: true,
    source_priority: 10,
    verification_status: "confirmed",
    ...t,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.048f847d-0125-4dc0-b8b9-38850fe462dd`, {
    method: "PATCH",
    headers: { ...h, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  const body = await res.json();
  console.log(`Suriname — status ${res.status}`, res.status !== 200 ? JSON.stringify(body) : "");
}

// ------------------------------------------------------------ Guyane française (réactivation, id connu)
{
  const description =
    "PAHO data via NY State DOH Global Health Update (30 July 2026): French Guiana has reported 1,053 chikungunya cases (all lab-confirmed) in 2026, no deaths reported.";
  const t = await withTranslations(description);

  const patch = {
    cases: 1053,
    deaths: 0,
    date: DATE,
    source: SOURCE,
    active: true,
    is_seed: true,
    source_priority: 10,
    verification_status: "confirmed",
    ...t,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.fc4f5fa6-ab40-4749-aaa2-0649b8d491b8`, {
    method: "PATCH",
    headers: { ...h, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  const body = await res.json();
  console.log(`Guyane française — status ${res.status}`, res.status !== 200 ? JSON.stringify(body) : "");
}

console.log("\nTerminé.");

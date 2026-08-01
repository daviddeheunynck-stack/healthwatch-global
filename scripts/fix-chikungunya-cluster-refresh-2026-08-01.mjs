// Refresh du cluster Chikungunya (5 lignes is_seed=true/source_priority=10),
// figé au 27/05/2026 alors que les sources ont significativement bougé
// (Brésil +31 883 cas/+23 décès, Bolivie décès x3.9, Maurice x4.7) — voir
// project_chikungunya_cluster_stale_awaiting_arbitration_2026_08_01.md.
// Écarté du refresh automatique par David : Cuba (inchangé, 1 457/2).
// Ciblé par id, jamais par WHERE disease+country (cf. section 6 du skill
// morning-don-check). Régénère les 4 description* via MyMemory (celles en
// base étaient des résidus DON581/CDC nav-menu sans rapport avec la ligne).
import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
const getEnv = (k) =>
  (env.match(new RegExp(`^${k}=(.*)$`, "m")) || ["", ""])[1]
    .replace(/^﻿/, "")
    .replace(/[\r\n]+$/, "")
    .trim()
    .replace(/^"(.*)"$/, "$1");

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) throw new Error("Pas la prod — arrêt.");

const NYDOH_0730 =
  "https://globalhealthreports.health.ny.gov/sites/default/files/2026-07/Global%20Health%20Update%207.30.26%20-%20Final.pdf";

const UPDATES = [
  {
    id: "fc0e1153-89b1-4295-bf2d-f82571a7c93c", // Brazil
    cases: 110569,
    deaths: 50,
    date: "2026-07-30",
    source: NYDOH_0730,
    description:
      "PAHO data via NY State DOH Global Health Update (30 July 2026): Brazil has reported 110,569 chikungunya cases (46,654 lab-confirmed) and 50 deaths in 2026, the highest total in the Americas region. Since the previous update, 2,949 new cases and 4 new deaths were reported.",
  },
  {
    id: "ebdf6d1a-67eb-4687-b3a6-943b7fd00d78", // Bolivia
    cases: 41944,
    deaths: 27,
    date: "2026-07-30",
    source: NYDOH_0730,
    description:
      "PAHO data via NY State DOH Global Health Update (30 July 2026): Bolivia has reported 41,944 chikungunya cases (11,407 lab-confirmed) and 27 deaths in 2026, the second-highest total in the Americas region behind Brazil.",
  },
  {
    id: "ebf85801-ec64-4101-ab76-0f96479eec9c", // Mayotte
    cases: 1396,
    deaths: 0,
    date: "2026-07-24",
    source:
      "https://www.santepubliquefrance.fr/regions-et-territoires/ocean-indien/bulletin-regional/surveillance-sanitaire-a-mayotte-bulletin-du-24-juillet-2026",
    description:
      "French Public Health Agency (SPF) regional bulletin (24 July 2026, week 29): Mayotte has reported 1,396 confirmed chikungunya cases since the start of 2026, with only 1 new case recorded in week 29 — incidence continues to decline sharply since the April peak.",
  },
  {
    id: "e88523cf-3993-4520-ae9f-075c23fa04d8", // Mauritius
    cases: 6675,
    deaths: 0,
    date: "2026-07-12",
    source: NYDOH_0730,
    description:
      "Africa CDC data via NY State DOH Global Health Update (30 July 2026): Mauritius has reported 6,675 confirmed chikungunya cases in 2026 (6,583 on Mauritius island, 92 on Rodrigues) as of 12 July, most occurring between April and May. No deaths have been reported.",
  },
];

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

const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

for (const u of UPDATES) {
  const t = await translateDescription(u.description);
  const patch = {
    cases: u.cases,
    deaths: u.deaths,
    date: u.date,
    source: u.source,
    description: u.description,
    description_fr: t.fr,
    description_es: t.es,
    description_ar: t.ar,
    description_id: t.id,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${u.id}`, {
    method: "PATCH",
    headers: { ...h, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  const body = await res.json();
  const missing = ["fr", "es", "ar", "id"].filter((k) => !t[k]);
  console.log(
    `${u.id} — status ${res.status}${missing.length ? ` — traductions manquantes: ${missing.join(",")}` : " — 4 traductions ok"}`
  );
  if (res.status !== 200) console.log("  ", JSON.stringify(body));
  await new Promise((r2) => setTimeout(r2, 500));
}

console.log("\nCuba (1 457 cas / 2 décès) inchangé — pas d'écart avec la source, aucune écriture.");

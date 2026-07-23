// Backfill ponctuel des 7 lignes actives coincées derrière l'ancien piège de
// sync-outbreaks (description_fr rempli à la main, gate .is("description_fr", null)
// jamais retriggée pour es/ar/id). Le gate et l'écriture ont été corrigés dans
// app/api/cron/sync-outbreaks/route.ts (2026-07-23) pour empêcher la récidive ;
// ce script traite juste l'arriéré déjà bloqué. N'écrase JAMAIS description_fr
// existant — ne comble que les champs réellement null, via lib/translate.ts
// (même helper MyMemory que le cron).
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

const IDS = [
  "63ba952c-1965-473a-999f-705921159e87", // Ebola / Uganda
  "906bf26a-8867-4a9c-ad7c-976e4e2c5bab", // West Nile fever / France
  "b17d4fda-c38c-41c0-9b26-e60a54c1851b", // Marburg / Uganda
  "0648cc06-4150-4688-aa19-ce130ea50385", // Meningitis / Burkina Faso
  "efe89b1b-715e-4c95-a35b-64c1e78cac12", // Meningitis / South Sudan
  "02859af1-01f6-45f1-8b83-fa84c9160dab", // Meningitis / Nigeria
  "0ef12940-1715-4573-b33f-ef4b041738d8", // Meningitis / Chad
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

for (const id of IDS) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${id}&select=id,disease_en,country_en,description,description_fr,description_es,description_ar,description_id`,
    { headers: h }
  );
  const [row] = await r.json();
  if (!row) { console.log(id, "introuvable"); continue; }

  const t = await translateDescription(row.description);
  const patch = {};
  if (row.description_fr === null && t.fr) patch.description_fr = t.fr;
  if (row.description_es === null && t.es) patch.description_es = t.es;
  if (row.description_ar === null && t.ar) patch.description_ar = t.ar;
  if (row.description_id === null && t.id) patch.description_id = t.id;

  if (Object.keys(patch).length === 0) {
    console.log(`${row.disease_en} / ${row.country_en} — rien à combler (déjà complet ou MyMemory a échoué)`);
    continue;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...h, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  const body = await res.json();
  console.log(`${row.disease_en} / ${row.country_en} — comblé: ${Object.keys(patch).join(", ")} — status ${res.status}`, res.status !== 200 ? JSON.stringify(body) : "");
  await new Promise((r2) => setTimeout(r2, 400));
}

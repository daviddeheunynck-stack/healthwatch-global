// Ebola/France et Ebola/Allemagne — déverrouillage source_priority 10→5, demandé par David le 2026-07-23.
// Chiffres inchangés (France: 1/0, Allemagne: 2/0), déjà corroborés par ECDC et DON613 ce matin.
//
// Note de prudence (voir memory project_ebola_drc_priority10_frozen_no_autofeed_2026_07_16 pour le
// précédent RDC) : contrairement à la RDC, passer ces deux lignes à prio=5 ne les rend PAS
// auto-alimentées en pratique. sync-ecdc-threats (app/api/cron/sync-ecdc-threats/route.ts:359-382)
// exclut explicitement les pays européens des `targetCountries` dès qu'un pays non-européen est cité
// dans le même article (le cas ici : la page ECDC RDC/Ouganda cite la France et l'Allemagne dans le
// corps de texte, pas dans le titre). Donc aucun cron ne réécrira ces lignes tant que ce comportement
// n'est pas changé côté code, ou qu'un article ECDC dédié France/Allemagne n'apparaît. Le déverrouillage
// lève le gel en principe (plus de protection artificielle contre une future écriture légitime), sans
// créer d'auto-alimentation immédiate — à surveiller si le sujet revient.
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
  "020b129c-d283-4a2c-a95b-3827322a77c1", // France
  "5f87a5bb-93f9-4c6b-a1f6-b731936df1c3", // Germany
];

for (const id of IDS) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ source_priority: 5 }),
  });
  const body = await res.json();
  console.log(id, "status", res.status, JSON.stringify(
    Array.isArray(body)
      ? body.map((o) => ({ id: o.id, country_en: o.country_en, cases: o.cases, deaths: o.deaths, source_priority: o.source_priority }))
      : body
  ));
}

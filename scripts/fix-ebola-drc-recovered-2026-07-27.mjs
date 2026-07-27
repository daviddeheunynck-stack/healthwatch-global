// x-hwg-monitoring 2026-07-27 — Ebola / DR Congo : restauration du champ `recovered`
//
// Ce matin, fix-ebola-drc-2026-07-27.mjs a porté la ligne à 3 200 cas / 1 405 décès
// (données gouvernementales du 26/07, arrêtées au 25/07) et a mis `recovered` à null,
// les sous-chiffres disponibles à ce moment-là venant du communiqué périmé du 24/07.
//
// Le sitrep officiel « Rapport de situation Ebola – 25 juillet 2026 », publié le 27/07
// à 7h32 par le Ministère de la Communication et des Médias (compte gouvernemental
// officiel, texte du post et non lecture d'image), donne les sous-chiffres arrêtés à
// la MÊME date que les totaux déjà en base :
//   3 200 cas confirmés · 773 en isolement/hospitalisation · 571 guéris · 1 405 décès
//   CFR 43,9 % · suivi des contacts 77,8 %
// Totaux identiques à ceux déjà en base : les guéris sont donc cohérents avec la ligne,
// pas un mélange de deux points de mesure.
//
// Seul `recovered` est modifié (null -> 571). cases/deaths/date/source/descriptions
// inchangés : la source du post reste l'Al Jazeera du 27/07 pour les totaux.
// Source du sous-chiffre : https://x.com/Com_mediasRDC/status/2081613613337309544
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

const ID = "bd1c3a46-a921-49b7-b79e-10ad715c4c38";

// Garde-fou : ne rien écrire si les totaux ont bougé depuis la lecture (3200/1405).
const check = await fetch(
  `${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}&select=cases,deaths,recovered`,
  { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
);
const [before] = await check.json();
if (before.cases !== 3200 || before.deaths !== 1405) {
  console.error(
    `ARRÊT : totaux changés depuis la vérification (cases=${before.cases} deaths=${before.deaths}). Revérifier avant d'écrire.`
  );
  process.exit(1);
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}`, {
  method: "PATCH",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({ recovered: 571 }),
});
const out = await res.json();
if (!res.ok) {
  console.error("ÉCHEC", res.status, JSON.stringify(out));
  process.exit(1);
}
const [row] = out;
console.log(
  `OK ${row.disease_en} / ${row.country_en} : cases=${row.cases} deaths=${row.deaths} recovered=${before.recovered} -> ${row.recovered} date=${row.date}`
);

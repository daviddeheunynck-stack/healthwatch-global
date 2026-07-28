// One-off: David's standing directive (2026-07-28) — "il nous faut les données les
// plus récentes possibles dans tous les cas", extended to rows previously left
// frozen/protected on the assumption that their lock made them exempt from a
// freshness check. Verified each against a primary/official source before writing.
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

const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

async function patch(id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${id}`, { method: "PATCH", headers: h, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Afghanistan — was frozen at "6 cases in 2023" (WHO GHO annual reference indicator,
// structurally years behind by design). Verified 2026-07-28 via GPEI's weekly case
// count (cited by Outbreak News Today, week of 19 July 2026): 11 WPV1 cases in
// Afghanistan since the start of 2026 (4 new in Hirat, Hilmand, Nangarhar the week
// of the report). Switches this row from the annual-reference framing to a
// current-tracking framing — the whole point of today's fix.
const afg = await patch("b0f473be-a367-464e-ab32-3cdc43aa7815", {
  cases: 11,
  date: "2026-07-19",
  source: "https://polioeradication.org/ (GPEI weekly wild poliovirus case count, week of 19 July 2026)",
  description:
    "Poliomyelitis (wild poliovirus, WPV1) in Afghanistan — 11 confirmed WPV1 cases reported since the start of 2026 (as of 19 July 2026), per GPEI's weekly case count, including 4 new cases the week of the report across Hirat, Hilmand, and Nangarhar provinces. Afghanistan remains one of two countries with endemic wild poliovirus transmission; the WHO Polio IHR Emergency Committee continues to classify this a Public Health Emergency of International Concern (PHEIC). Source: Global Polio Eradication Initiative (GPEI).",
  description_fr: null, description_es: null, description_ar: null, description_id: null,
});
console.log("Afghanistan:", JSON.stringify(afg));

// Pakistan — same pattern. Verified 2026-07-28: 3 WPV1 cases in Pakistan since the
// start of 2026, confirmed independently both by GPEI (via Outbreak News Today,
// week of 19 July 2026) and Pakistan's own official National Emergency Operation
// Centre tracker (endpolio.com.pk), which also states "3 Cases" as the current 2026
// total.
const pak = await patch("ab4cd321-0aa6-4598-86ac-b0a04d346465", {
  cases: 3,
  date: "2026-07-19",
  source: "https://www.endpolio.com.pk/polioin-pakistan/district-wise-polio-cases (Pakistan National Emergency Operation Centre for Polio Eradication)",
  description:
    "Poliomyelitis (wild poliovirus, WPV1) in Pakistan — 3 confirmed WPV1 cases reported since the start of 2026 (as of 19 July 2026), per Pakistan's National Emergency Operation Centre for Polio Eradication, corroborated by GPEI's weekly case count for the same period. Pakistan remains one of two countries with endemic wild poliovirus transmission; the WHO Polio IHR Emergency Committee continues to classify this a Public Health Emergency of International Concern (PHEIC). Source: Pakistan National Emergency Operation Centre / GPEI.",
  description_fr: null, description_es: null, description_ar: null, description_id: null,
});
console.log("Pakistan:", JSON.stringify(pak));

// Réunion — the specific named 2025 chikungunya epidemic (54,500 cases / 45 deaths)
// is over: WHO's own 24 April 2026 Rapid Risk Assessment already called it "waning"
// (only 30 cases Jan-27 Mar 2026), and Santé publique France's bulletin of 19 June
// 2026 confirms just 48 cumulative chikungunya cases on La Réunion since the start
// of 2026 — two full orders of magnitude below the 2025 figure this row still shows
// as "active, high risk". Multiple sources independently describe the 2025 epidemic
// as having formally ended (24 June 2025). Deactivating rather than overwriting in
// place: 54,500/45 is a real, distinct, concluded historical event, not the same
// ongoing situation at a lower number — updating the count in place would blur that
// a real epidemic ended, not just shrank. A much smaller distinct 2026 uptick (48
// cases through mid-June) exists but isn't written here — including it as a new
// tracked row is a scope/inclusion call for David, not a pure freshness fix.
const reunion = await patch("5fa64d12-8597-4c62-bc9d-e85f33986261", {
  active: false,
  description:
    "Chikungunya in La Réunion — the 2025 epidemic (54,500 confirmed cases, 45 deaths, the region's largest outbreak and the island's first autochthonous transmission since 2010) was declared over on 24 June 2025. WHO's Rapid Risk Assessment of 24 April 2026 already assessed the situation as waning (only 30 cases reported 1 January-27 March 2026). Santé publique France's surveillance bulletin of 19 June 2026 confirms just 48 cumulative chikungunya cases on La Réunion since the start of 2026 — a much smaller, distinct level of activity, not a continuation of the 2025 epidemic. Archived rather than shown as an active, high-risk outbreak. Source: WHO Rapid Risk Assessment (24 April 2026); Santé publique France, Surveillance sanitaire à La Réunion, bulletin du 19 juin 2026.",
  description_fr: null, description_es: null, description_ar: null, description_id: null,
});
console.log("Réunion:", JSON.stringify(reunion));

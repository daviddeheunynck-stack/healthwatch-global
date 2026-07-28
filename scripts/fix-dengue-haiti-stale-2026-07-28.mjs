// One-off: Dengue/Haiti (b5da428e-8734-423b-8f81-aa36182b26c5) sat "active" showing
// 2022 case figures for 1,493 days — David flagged this as a core-promise violation
// (2026-07-28). Verified live against WHO's own xmart ARBOV dataset before touching
// anything: querying V_DENGUE_GLOBAL_VALIDATED_PUBLIC for ISO3=HTI with CASES ne null
// returns ZERO rows for 2023, 2024, 2025, and 2026 — WHO itself has published no real
// dengue figure for Haiti since 2022. Checked PAHO's 2026 regional dengue updates and
// searched for an MSPP/Haiti-specific bulletin — found none with a Haiti case count
// (PAHO's Haiti-specific documents found are about the humanitarian crisis generally,
// which explicitly notes surveillance for dengue is "severely constrained"). No
// fresher primary source exists to replace this with, so the honest fix is to stop
// presenting 4-year-old figures as a currently tracked outbreak, not to delete a real
// historical event.
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
const ID = "b5da428e-8734-423b-8f81-aa36182b26c5";

const patch = {
  active: false,
  description:
    "Dengue in Haiti — WHO's Global Dengue Surveillance dataset last reported real case " +
    "figures for Haiti in 2022 (3,316 cumulative cases as of the period starting 2022-06-26). " +
    "Verified 2026-07-28: WHO's own ARBOV dataset has published no case data for Haiti for " +
    "2023, 2024, 2025, or 2026, and no more recent country-specific figure was found in PAHO's " +
    "regional dengue updates. Marked archived rather than presented as a currently tracked " +
    "outbreak, since these 2022 figures cannot be confirmed current.",
  description_fr: null, description_es: null, description_ar: null, description_id: null,
};

const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}`, {
  method: "PATCH", headers: h, body: JSON.stringify(patch),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const updated = await res.json();
console.log("Mis à jour:", JSON.stringify(updated, null, 2));

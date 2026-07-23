// fix-ebola-congo-phantom-2026-07-21.mjs
// Deactivates a phantom "Ebola virus disease / Congo (Republic of the Congo)" row
// created by sync-africa-cdc mis-attributing a DRC-only Bundibugyo article to
// Republic of the Congo.
//
// Root cause: findMentionedAfricanCountries() matches "congo" via indexOf, and
// "congo" is a substring of "Democratic Republic of the Congo". On the article
// https://africacdc.org/news-item/drc-activates-emergency-delivery-plan-to-break-bundibugyo-ebola-transmission/
// (exclusively about DRC — 2011 cases / 754 deaths — RoC never mentioned) the
// parser produced country_en="Congo" with RoC coordinates (lat -0.2, lng 15.8).
// Result: a nonexistent RoC Ebola outbreak + double-count of the DRC totals on
// aggregate pages, on top of the authoritative WHO DON613 row (DR Congo,
// 2124/828, bd1c3a46). Verified against WHO DON613 (2026-07-17): only DRC,
// Uganda, France, Germany — no Republic of the Congo.
//
// Data-only fix (deactivate by id). The cron code bug is flagged to David
// separately (not fixed here — verify != fix on revenue-critical crons).

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

const ID = "0867397e-43a3-462c-b4e0-2e75e862ea65";
const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

const r = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}`, {
  method: "PATCH",
  headers: h,
  body: JSON.stringify({ active: false }),
});
const out = await r.json();
console.log("HTTP", r.status);
console.log(JSON.stringify(out.map((x) => ({ id: x.id, disease_en: x.disease_en, country_en: x.country_en, active: x.active })), null, 2));

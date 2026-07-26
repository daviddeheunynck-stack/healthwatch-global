// Delete the phantom "Congo" (Republic of Congo) Ebola row created by the
// substring-matcher bug fixed 2026-07-21 (see project_ebola_congo_roc_phantom_substring_fixed_2026_07_21).
// No real Ebola outbreak has ever been declared in the Republic of Congo in this dataset;
// 2344 cases/930 deaths is a DRC case count mis-attributed here during the bug window.
// Verified before deleting (2026-07-27):
//   - id 0867397e-43a3-462c-b4e0-2e75e862ea65, active=false, source_priority=0
//   - zero references in alert_notifications, outbreak_notes, user_watchlist,
//     outbreak_tripwires, outbreak_subscribers, outbreak_alert_log
//   - 3 rows in outbreak_snapshots (19-21/07, bug window) — outbreak_snapshots.outbreak_id
//     is ON DELETE CASCADE, so these are removed automatically, no manual cleanup needed.
// Deletion left as David's call since 2026-07-22 (product-feedback.md); re-verified live
// on /fr/disease/ebola 2026-07-27 that it still tops "Historical outbreaks" above the real
// DR Congo row (1460 cases) and inflates "Countries affected" — applying now.
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
const h = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${ID}`, {
  method: "DELETE",
  headers: h,
});
const body = await res.json();
console.log("Status:", res.status);
console.log("Deleted rows:", JSON.stringify(body, null, 2));
if (!Array.isArray(body) || body.length !== 1) {
  throw new Error("Expected exactly 1 row deleted — check before assuming success.");
}

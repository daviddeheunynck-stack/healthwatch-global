import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1]
    .replace(/^﻿/, "")
    .replace(/[\r\n]+$/, "")
    .trim()
    .replace(/^"(.*)"$/, "$1");
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
console.log("Target project:", SUPABASE_URL);
if (!SUPABASE_URL.includes("tqznwmpkokdzrszysbcm")) {
  throw new Error("Refusing to run: this does not look like the production project.");
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function patch(id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${id} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function insert(body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`INSERT ${body.country_en} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function del(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=eq.${id}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error(`DELETE ${id} failed: ${res.status} ${await res.text()}`);
}

// Root-cause fix for the multi-country DON fan-out bug (see lib/who-api.ts,
// lib/outbreak-parser.ts, lib/geo-data.ts) is now live. This reconciles the
// prod data for the DON that surfaced the bug (2025-DON579, "Cholera –
// Multi-country with a focus on countries experiencing current surges").
//
// Figures below come directly from parseWHODONItems() run against the live
// DON579 page today (2026-07-05) — the same fan-out function the cron now
// uses — not hand-typed, and independently cross-checked against the DON's
// "Overview of selected countries" section at who.int.
const DESCRIPTION =
  "The global cholera situation continues to deteriorate, driven by conflict and poverty, posing a significant public health challenge across multiple WHO regions. Between 1 January and 17 August 2025, a total of 409 222 cholera/Acute Watery Diarrhoea (AWD) cases and 4738 deaths were reported globally, from 31 countries, with six of the 31 countries reporting case fatality rates above 1%, indicating";
const SOURCE = "https://www.who.int/emergencies/disease-outbreak-news/item/2025-DON579";
const DATE = "2025-08-29";

const COMMON = {
  disease: "Choléra", disease_en: "Cholera", disease_ar: "الكوليرا",
  region: "africa", risk_level: "high", date: DATE, source: SOURCE, description: DESCRIPTION,
  active: true, is_seed: true, source_priority: 3,
  admin1: null, admin1_lat: null, admin1_lng: null, recovered: 0,
};

// 1. Sudan already exists (manually backfilled 2026-07-05, id 527d4257) with
// exactly these verified figures — reactivate it and mark is_seed so the
// 60-day staleness sweep (keyed on `date`, not `updated_at` — DON579's date
// is already >60 days old and always will be) stops immediately
// deactivating it again, without blocking future updates from a fresher DON
// (source_priority stays 3, so the normal upsert path can still refresh it).
const sudan = await patch("527d4257-c321-4f09-8c08-97f42bc9a2e0", {
  cases: 48768, deaths: 1094, active: true, is_seed: true, description: DESCRIPTION,
});
console.log("1. Sudan (527d4257) reactivated + is_seed:", sudan.map((r) => `active=${r.active} is_seed=${r.is_seed}`));

// 2-5. Chad, Republic of Congo, DR Congo, South Sudan never had a cholera
// row at all — DON579 is the only WHO report covering this wave for them,
// and the old aggregation bug swallowed all four into the single "Plusieurs
// pays" row alongside Sudan.
const newRows = [
  { ...COMMON, country: "Tchad", country_en: "Chad", country_ar: "تشاد", lat: 15.5, lng: 18.7, cases: 776, deaths: 53 },
  { ...COMMON, country: "Congo", country_en: "Congo", country_ar: "جمهورية الكونغو", lat: -0.2, lng: 15.8, cases: 457, deaths: 35 },
  { ...COMMON, country: "RD Congo", country_en: "DR Congo", country_ar: "الكونغو الديمقراطية", lat: -4, lng: 21.8, cases: 46800, deaths: 1362 },
  { ...COMMON, country: "Soudan du Sud", country_en: "South Sudan", country_ar: "جنوب السودان", lat: 6.9, lng: 31.3, cases: 71825, deaths: 1194 },
];
for (const row of newRows) {
  const inserted = await insert(row);
  console.log(`2. ${row.country_en} inserted:`, inserted.map((r) => `id=${r.id} cases=${r.cases} deaths=${r.deaths}`));
}

// 6. Delete the two stale/duplicate "Plusieurs pays" aggregate rows this DON
// produced under the old bug — both are superseded by the 5 per-country rows
// above and would otherwise sit alongside them as a confusing extra pin.
for (const id of ["543371f5-1078-4428-8bf7-668854fcd4d5", "d877c4ae-4fde-4c09-b3b8-d1bcda9a016c"]) {
  await del(id);
  console.log(`3. Deleted superseded aggregate row ${id}`);
}

// 7. Gaza/oPt polio row (separately backfilled 2026-07-05 from the Polio IHR
// Emergency Committee statement, not a classic DON — see project memory).
// Same staleness mechanics as Sudan: its date (2026-03-04) is already >60
// days old, so it was auto-deactivated within a minute of being inserted.
// Reactivate + is_seed for the same reason.
const gaza = await patch("8a4072ab-c0be-4567-8ba4-cdcedeccced8", { active: true, is_seed: true });
console.log("4. Palestine/Polio (8a4072ab) reactivated + is_seed:", gaza.map((r) => `active=${r.active} is_seed=${r.is_seed}`));

import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim();
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function fetchTable(table, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// The fictional is_seed=true row of each confirmed duplicate pair.
const FAKE_SOURCES = [
  "https://www.who.int/emergencies/disease-outbreak-news/item/mpox-drc-2024",
  "https://www.who.int/emergencies/disease-outbreak-news/item/cholera-haiti-2024",
  "https://www.who.int/emergencies/disease-outbreak-news/item/h5n1-cambodia-2024",
];

const select = "id,disease_en,country_en,cases,deaths,source,is_seed,active";

const targets = [];
for (const src of FAKE_SOURCES) {
  const rows = await fetchTable("outbreaks", `select=${select}&source=eq.${encodeURIComponent(src)}`);
  targets.push(...rows);
}

console.log("=== Rows to deactivate ===");
for (const r of targets) {
  console.log(`  ${r.id} | ${r.disease_en} | ${r.country_en} | cases=${r.cases} deaths=${r.deaths} | seed=${r.is_seed} | active=${r.active}`);
}

const ids = targets.map((r) => r.id);
const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=in.(${ids.join(",")})`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ active: false }),
});
if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`);
const updated = await res.json();
console.log(`\nDeactivated ${updated.length} rows.`);

console.log("\n=== Remaining active rows for these disease+country groups ===");
const groups = [
  { disease: "mpox", country: "congo" },
  { disease: "cholera", country: "haiti" },
  { disease: "influenza h5n1", country: "cambodia" },
];
for (const g of groups) {
  const rows = await fetchTable(
    "outbreaks",
    `select=${select}&disease_en=ilike.*${g.disease}*&country_en=ilike.*${g.country}*&active=eq.true`
  );
  for (const r of rows) {
    console.log(`  ${r.disease_en} | ${r.country_en} | cases=${r.cases} deaths=${r.deaths} | source=${r.source}`);
  }
}

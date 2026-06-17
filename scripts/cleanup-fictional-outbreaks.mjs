import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim();
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

const APPLY = process.argv.includes("--apply");

async function fetchTable(table, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

const select = "id,disease_en,country_en,cases,deaths,date,source,is_seed,risk_level";
const allActive = await fetchTable(
  "outbreaks",
  `select=${select}&active=eq.true&order=country_en`
);

// Real WHO DON article: https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606
// Fake seed URLs follow https://www.who.int/.../item/{disease}-{country}-2024 (no DON id)
const REAL_DON = /^https:\/\/www\.who\.int\/emergencies\/disease-outbreak-news\/item\/\d{4}-DON\d+$/i;

const keep = [];
const deactivate = [];
for (const row of allActive) {
  if (REAL_DON.test(row.source || "")) keep.push(row);
  else deactivate.push(row);
}

console.log(`Total active: ${allActive.length}`);

console.log(`\n=== KEEP (${keep.length}) — real WHO DON source ===`);
for (const r of keep) {
  console.log(
    `  ${r.disease_en.padEnd(28)} | ${r.country_en.padEnd(28)} | cases=${r.cases} deaths=${r.deaths} | seed=${r.is_seed} | ${r.date} | ${r.source}`
  );
}

console.log(`\n=== DEACTIVATE (${deactivate.length}) — no real WHO DON source ===`);
for (const r of deactivate) {
  console.log(
    `  ${r.disease_en.padEnd(28)} | ${r.country_en.padEnd(28)} | cases=${r.cases} deaths=${r.deaths} | seed=${r.is_seed} | ${r.date} | ${r.source}`
  );
}

if (!APPLY) {
  console.log(`\nDry run only. Re-run with --apply to set active=false on the ${deactivate.length} rows above.`);
} else {
  const ids = deactivate.map((r) => r.id);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/outbreaks?id=in.(${ids.join(",")})`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ active: false }),
  });
  if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`);
  console.log(`\nDeactivated ${ids.length} rows.`);
}

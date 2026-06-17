import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
function getEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].replace(/^﻿/, "").replace(/[\r\n]+$/, "").trim();
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

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

const select = "id,disease_en,country_en,cases,deaths,date,source,active,is_seed,risk_level";

const seedRows = await fetchTable("outbreaks", `select=${select}&is_seed=eq.true&order=country_en`);
console.log(`=== is_seed=true rows (${seedRows.length}) ===`);
for (const row of seedRows) {
  console.log(`${row.active ? "ACTIVE  " : "inactive"} | ${row.disease_en.padEnd(25)} | ${row.country_en.padEnd(30)} | cases=${row.cases} deaths=${row.deaths} | risk=${row.risk_level} | date=${row.date} | source=${row.source}`);
}

const allActive = await fetchTable("outbreaks", `select=${select}&active=eq.true&order=country_en`);
console.log(`\n=== Total active=true rows: ${allActive.length} ===`);

// Look for other duplicate disease+country pairs among active rows
const byKey = new Map();
for (const row of allActive) {
  const k = `${row.disease_en.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim()}|${row.country_en.toLowerCase()}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(row);
}
console.log("\n=== Potential duplicate disease+country groups (active) ===");
for (const [k, rows] of byKey) {
  if (rows.length > 1) {
    console.log(`\n${k}:`);
    for (const r of rows) {
      console.log(`  - "${r.disease_en}" | cases=${r.cases} deaths=${r.deaths} | seed=${r.is_seed} | date=${r.date} | source=${r.source}`);
    }
  }
}

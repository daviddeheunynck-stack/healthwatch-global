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

const select = "id,disease_en,country_en,cases,deaths,date,source,description,active,is_seed,risk_level,created_at,updated_at";

const mpox = await fetchTable("outbreaks", `select=${select}&disease_en=ilike.*mpox*&country_en=ilike.*congo*`);
const dengue = await fetchTable("outbreaks", `select=${select}&disease_en=ilike.*dengue*&country_en=ilike.*brazil*`);

console.log("=== MPOX / CONGO ===");
for (const row of mpox) {
  console.log(JSON.stringify(row, null, 2));
}

console.log("\n=== DENGUE / BRAZIL ===");
for (const row of dengue) {
  console.log(JSON.stringify(row, null, 2));
}

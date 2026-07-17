import { readFileSync } from "fs";

const env = readFileSync(".env.local.live", "utf-8");
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

const rows = await fetchTable(
  "site_config",
  `select=key,value&key=like.cron:run:*&order=key`
);

console.log(`=== cron:run:* entries (${rows.length}) ===`);
const now = Date.now();
for (const row of rows) {
  const v = JSON.parse(row.value);
  const ageH = ((now - new Date(v.ts).getTime()) / 3_600_000).toFixed(1);
  const name = row.key.replace("cron:run:", "");
  console.log(`${name.padEnd(28)} | ${v.status.padEnd(7)} | rows=${String(v.rows).padEnd(5)} | age=${ageH}h | ts=${v.ts}${v.error ? ` | error=${v.error}` : ""}`);
}

console.log("\n=== pilot-follow-up specifically ===");
const pf = rows.find(r => r.key === "cron:run:pilot-follow-up");
console.log(pf ? JSON.stringify(JSON.parse(pf.value), null, 2) : "NO ENTRY FOUND — cron has never logged a run");

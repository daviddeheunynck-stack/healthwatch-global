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
};

async function get(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Comptes fondateur/test/ami déjà identifiés dans l'audit du 2026-07-06 — exclus de l'échantillon
const EXCLUDED_EMAILS = new Set([
  "david.deheunynck@gmail.com",
  "e2e@healthwatch-global.com",
  "davy_skye@yahoo.fr",
  "clarence_skye@yahoo.fr",
  "r.endangrukmanams@gmail.com",
  "elyan.delaunay@proton.me",
]);

const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers });
if (!authRes.ok) throw new Error(`auth admin users failed: ${authRes.status} ${await authRes.text()}`);
const { users: authUsers } = await authRes.json();
const emailById = new Map(authUsers.map(u => [u.id, u.email]));
const lastSignInById = new Map(authUsers.map(u => [u.id, u.last_sign_in_at]));
const createdAtAuthById = new Map(authUsers.map(u => [u.id, u.created_at]));

const profiles = await get("profiles?select=id,plan,trial_ends_at,created_at&order=created_at.asc");

console.log(`\nTotal profiles: ${profiles.length}, total auth users: ${authUsers.length}`);

const results = [];
for (const p of profiles) {
  const email = emailById.get(p.id) ?? "?";
  if (EXCLUDED_EMAILS.has(email)) continue;
  const [regions, diseases] = await Promise.all([
    get(`user_alert_regions?user_id=eq.${p.id}&select=region`),
    get(`user_alert_diseases?user_id=eq.${p.id}&select=disease_en`),
  ]);
  const created = createdAtAuthById.get(p.id) ?? p.created_at;
  const lastSignIn = lastSignInById.get(p.id) ?? null;
  const returned = lastSignIn && created && new Date(lastSignIn).getTime() - new Date(created).getTime() > 5 * 60_000;
  results.push({ email, plan: p.plan, trial_ends_at: p.trial_ends_at, created, regionCount: regions.length, diseaseCount: diseases.length, returned });
}

console.log("\nemail | plan | created | revenu après signup? | regions | maladies");
for (const r of results) {
  console.log(`${r.email} | ${r.plan} | ${r.created?.slice(0, 10)} | ${r.returned ? "oui" : "non"} | ${r.regionCount} | ${r.diseaseCount}`);
}

const everHadTrialOrPaid = results.filter(r => r.trial_ends_at || ["pro", "team", "enterprise", "starter"].includes(r.plan));
const zeroRegions = everHadTrialOrPaid.filter(r => r.regionCount === 0);
console.log(`\n=== Résumé (comptes réels, hors test/fondateur) ===`);
console.log(`Total comptes réels : ${results.length}`);
console.log(`Comptes ayant eu un trial/plan payant à un moment : ${everHadTrialOrPaid.length}`);
console.log(`...dont 0 région d'alerte configurée jamais : ${zeroRegions.length}`);
console.log(`...dont 0 maladie suivie configurée jamais : ${everHadTrialOrPaid.filter(r => r.diseaseCount === 0).length}`);
console.log(`...dont revenus après signup ET 0 région configurée : ${everHadTrialOrPaid.filter(r => r.returned && r.regionCount === 0).length}`);
console.log(`...dont jamais revenus ET 0 région configurée : ${everHadTrialOrPaid.filter(r => !r.returned && r.regionCount === 0).length}`);
